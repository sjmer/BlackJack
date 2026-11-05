import { randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io';
import {
  CHAT_HISTORY_LIMIT,
  CHAT_MIN_INTERVAL_MS,
  DEALING_DURATION_MS,
  OFFLINE_SEAT_TIMEOUT_MS,
  SEAT_TURN_TIMEOUT_MS,
  canStartRound,
  createDeck,
  createInitialTable,
  isSeatOccupied,
  sanitizeChatText,
  shuffleDeck,
  tableReducer,
  viewForTable,
} from '@bj/game';
import type { ChatMessage, TableAction, TableState } from '@bj/game';

export const ROUND_RECYCLE_MS = 8_000;
export const INTENT_MIN_INTERVAL_MS = 100;
export const ROOM_IDLE_TTL_MS = 10 * 60_000;

/**
 * Only rapid in-hand actions are rate limited. Lobby intents are rare and
 * idempotent, so swallowing one to fight spam would only create bugs.
 */
const RATE_LIMITED_INTENTS = new Set<IntentType>(['hit', 'stand']);

/** Injectable pacing so tests can fast-forward the table. */
export interface RoomTimings {
  dealing: number;
  seatTimeout: number;
  /** Shorter grace for an acting seat whose player is offline. */
  offlineSeatTimeout: number;
  roundRecycle: number;
}

export const DEFAULT_TIMINGS: RoomTimings = {
  dealing: DEALING_DURATION_MS,
  seatTimeout: SEAT_TURN_TIMEOUT_MS,
  offlineSeatTimeout: OFFLINE_SEAT_TIMEOUT_MS,
  roundRecycle: ROUND_RECYCLE_MS,
};

export type IntentType = 'ready' | 'unready' | 'hit' | 'stand' | 'standUp';

export interface Intent {
  type: IntentType;
  roundId?: number;
}

/**
 * One table. Owns the authoritative TableState: every mutation goes through
 * `apply`, which broadcasts sanitized views and re-arms the phase timers.
 * The engine's own phase guards make stray or duplicate timer callbacks
 * no-ops, so scheduling can simply restart on every state change.
 */
export class Room {
  readonly id: string;
  state: TableState = createInitialTable();

  private readonly timings: RoomTimings;
  private readonly sockets = new Map<string, Socket>(); // playerId -> socket
  private readonly attachAt = new Map<string, number>(); // playerId -> last attach time
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly lastIntentAt = new Map<string, number>(); // socket.id -> timestamp
  private readonly lastChatAt = new Map<string, number>(); // socket.id -> timestamp
  private readonly chatLog: ChatMessage[] = [];
  /** playerId of the room creator; succession is computed on demand. */
  private hostPlayerId: string | null = null;
  private lastActivityAt = Date.now();

  constructor(
    id: string,
    timings: Partial<RoomTimings> = {},
  ) {
    this.id = id;
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
  }

  get connectedCount(): number {
    return this.sockets.size;
  }

  get idleMs(): number {
    return Date.now() - this.lastActivityAt;
  }

  hasSeat(playerId: string): boolean {
    return this.state.seats.some((seat) => seat.playerId === playerId);
  }

  /**
   * Identity without accounts: a joiner whose name matches a *disconnected*
   * seat inherits that seat's player id, so the whole existing reconnect
   * path (PLAYER_RECONNECT, stats, an in-flight hand) applies unchanged.
   * The room code is the gate; a still-connected player's name is never
   * matched, so nobody can be cloned while online.
   */
  findReadoptablePlayerId(name: string): string | null {
    const seat = this.state.seats.find(
      (candidate) => isSeatOccupied(candidate) && !candidate.connected && candidate.name === name,
    );
    return seat ? seat.playerId : null;
  }

  attach(socket: Socket, playerId: string): void {
    // The first attached socket is the room creator: they become the host.
    if (this.hostPlayerId === null) {
      this.hostPlayerId = playerId;
    }

    // One live connection per player: a second tab replaces the first. A
    // replacement arriving mere moments after the previous attach is almost
    // always the *same page* reconnecting its transport (the old half-open
    // socket lingers until the heartbeat timeout) — silently swap it instead
    // of shouting "replaced" at a page that is only talking to itself again.
    const previous = this.sockets.get(playerId);

    if (previous && previous !== socket) {
      const replacedQuickly = Date.now() - (this.attachAt.get(playerId) ?? 0) < 1_000;
      previous.data.playerId = undefined;

      if (!replacedQuickly) {
        previous.emit('room:replaced');
      }

      previous.disconnect(true);
      this.sockets.delete(playerId);
    }

    this.sockets.set(playerId, socket);
    this.attachAt.set(playerId, Date.now());
    socket.data.playerId = playerId;
    socket.data.roomId = this.id;
    this.touch();

    this.apply({ type: 'PLAYER_RECONNECT', playerId });

    const freeSeat = this.state.seats.find((seat) => seat.playerId === '' && seat.name === '');

    if (freeSeat && (this.state.phase === 'lobby' || this.state.phase === 'round-over')) {
      this.apply({
        type: 'SIT',
        seatIndex: freeSeat.seatIndex,
        playerId,
        name: typeof socket.data.name === 'string' && socket.data.name ? socket.data.name : '玩家',
      });
    }

    // Late joiners catch up on what was said before them.
    socket.emit('chat:history', [...this.chatLog]);
    this.sendStateTo(socket);
  }

  detach(socket: Socket): void {
    const playerId = socket.data?.playerId;

    if (typeof playerId !== 'string' || this.sockets.get(playerId) !== socket) {
      return;
    }

    this.sockets.delete(playerId);
    this.attachAt.delete(playerId);
    this.lastIntentAt.delete(socket.id);
    this.lastChatAt.delete(socket.id);
    this.touch();
    this.apply({ type: 'PLAYER_DISCONNECT', playerId });
  }

  handleIntent(socket: Socket, intent: Intent): void {
    const playerId = socket.data?.playerId;

    if (typeof playerId !== 'string' || this.sockets.get(playerId) !== socket) {
      return;
    }

    const now = Date.now();

    if (RATE_LIMITED_INTENTS.has(intent.type)) {
      const last = this.lastIntentAt.get(socket.id) ?? 0;

      if (now - last < INTENT_MIN_INTERVAL_MS) {
        return;
      }

      this.lastIntentAt.set(socket.id, now);
    }

    this.touch();

    // A hit/stand from a previous round is stale by definition.
    if ((intent.type === 'hit' || intent.type === 'stand') && intent.roundId !== this.state.roundId) {
      return;
    }

    const seatIndex = this.seatOf(playerId);

    switch (intent.type) {
      case 'ready':
        this.apply({ type: 'SET_READY', playerId, ready: true });
        this.tryAutoStart();
        break;
      case 'unready':
        this.apply({ type: 'SET_READY', playerId, ready: false });
        break;
      case 'hit':
        if (seatIndex !== null) {
          this.apply({ type: 'HIT', seatIndex });
        }
        break;
      case 'stand':
        if (seatIndex !== null) {
          this.apply({ type: 'STAND', seatIndex });
        }
        break;
      case 'standUp':
        this.apply({ type: 'STAND_UP', playerId });
        break;
    }
  }

  /**
   * The acting host: the creator while their seat is occupied and connected,
   * otherwise the lowest seated connected player. Computed on demand, so a
   * returning host reclaims the role automatically.
   */
  private effectiveHostId(): string | null {
    const hostSeat = this.hostPlayerId === null
      ? undefined
      : this.state.seats.find((seat) => seat.playerId === this.hostPlayerId);

    if (hostSeat && hostSeat.connected) {
      return this.hostPlayerId;
    }

    const fallback = this.state.seats.find((seat) => isSeatOccupied(seat) && seat.connected);
    return fallback ? fallback.playerId : this.hostPlayerId;
  }

  /** Host-only removal of another seat. Silent on any unauthorized call. */
  handleKick(socket: Socket, seatIndex: unknown): void {
    const playerId = socket.data?.playerId;

    if (typeof playerId !== 'string' || this.sockets.get(playerId) !== socket) {
      return;
    }

    if (typeof seatIndex !== 'number' || !Number.isInteger(seatIndex)) {
      return;
    }

    const hostId = this.effectiveHostId();

    if (hostId === null || playerId !== hostId) {
      return;
    }

    const target = this.state.seats[seatIndex];

    if (!target || !isSeatOccupied(target) || target.playerId === playerId) {
      return;
    }

    const targetPlayerId = target.playerId;
    const before = this.state;
    this.apply({ type: 'KICK', seatIndex, byPlayerId: playerId });

    if (this.state === before) {
      return; // Rejected by the engine.
    }

    this.pushSystemMessage(`${target.name} 被房主移出了房间`);

    const targetSocket = this.sockets.get(targetPlayerId);

    if (targetSocket) {
      targetSocket.emit('room:kicked');
    }
  }

  /** One chat line from a client: sanitize, rate limit, broadcast. */
  handleChat(socket: Socket, raw: unknown): void {
    const playerId = socket.data?.playerId;

    if (typeof playerId !== 'string' || this.sockets.get(playerId) !== socket) {
      return;
    }

    const text = sanitizeChatText(raw);

    if (text === '') {
      return;
    }

    const now = Date.now();
    const last = this.lastChatAt.get(socket.id) ?? 0;

    if (now - last < CHAT_MIN_INTERVAL_MS) {
      return; // Same silent-drop policy as hit/stand.
    }

    this.lastChatAt.set(socket.id, now);
    this.touch();

    const seat = this.state.seats.find((candidate) => candidate.playerId === playerId);
    const name = seat && isSeatOccupied(seat)
      ? seat.name
      : typeof socket.data.name === 'string' && socket.data.name ? socket.data.name : '玩家';

    this.pushChat({ id: randomUUID(), kind: 'player', playerId, name, text, ts: now });
  }

  private pushChat(message: ChatMessage): void {
    this.chatLog.push(message);

    if (this.chatLog.length > CHAT_HISTORY_LIMIT) {
      this.chatLog.splice(0, this.chatLog.length - CHAT_HISTORY_LIMIT);
    }

    for (const socket of this.sockets.values()) {
      socket.emit('chat', message);
    }
  }

  /** Room-wide notice (kick, …) that renders as a chat line. */
  private pushSystemMessage(text: string): void {
    this.pushChat({
      id: randomUUID(),
      kind: 'system',
      playerId: null,
      name: '系统',
      text,
      ts: Date.now(),
    });
  }

  dispose(): void {
    this.clearTimers();

    for (const socket of this.sockets.values()) {
      socket.emit('room:closed');
    }

    this.sockets.clear();
  }

  private seatOf(playerId: string): number | null {
    const seat = this.state.seats.find((candidate) => candidate.playerId === playerId);
    return seat ? seat.seatIndex : null;
  }

  private tryAutoStart(): void {
    if (!canStartRound(this.state)) {
      return;
    }

    this.apply({ type: 'START_ROUND', deck: shuffleDeck(createDeck()) });
  }

  private apply(action: TableAction): void {
    const next = tableReducer(this.state, action);

    if (next === this.state) {
      return; // Rejected by the engine's phase guards.
    }

    this.state = next;
    this.clearTimers();
    this.broadcast();
    this.schedule();
  }

  private schedule(): void {
    const { phase } = this.state;

    if (phase === 'dealing') {
      this.timer(this.timings.dealing, () => this.apply({ type: 'DEAL_COMPLETE' }));
      return;
    }

    if (phase === 'player-turn') {
      // An offline seat owes its turn too, but nobody wants to stare at a
      // frozen table for the full 30s: give absent players a short grace
      // window, then auto-stand for them (their auto-pilot).
      const turnSeat = this.state.turnSeat;
      const actingSeat = turnSeat !== null ? this.state.seats[turnSeat] : undefined;
      const offline = actingSeat !== undefined && isSeatOccupied(actingSeat) && !actingSeat.connected;

      this.timer(offline ? this.timings.offlineSeatTimeout : this.timings.seatTimeout, () => {
        const seatIndex = this.state.turnSeat;

        if (this.state.phase === 'player-turn' && seatIndex !== null) {
          this.apply({ type: 'SEAT_TIMEOUT', seatIndex });
        }
      });
      return;
    }

    if (phase === 'round-over') {
      this.timer(this.timings.roundRecycle, () => this.apply({ type: 'BACK_TO_LOBBY' }));
    }
  }

  private broadcast(): void {
    for (const socket of this.sockets.values()) {
      this.sendStateTo(socket);
    }
  }

  private sendStateTo(socket: Socket): void {
    const playerId = typeof socket.data?.playerId === 'string' ? socket.data.playerId : null;
    socket.emit('state', viewForTable(this.state, playerId, this.id, this.effectiveHostId()));
  }

  private touch(): void {
    this.lastActivityAt = Date.now();
  }

  private timer(delayMs: number, fn: () => void): void {
    const handle = setTimeout(() => {
      this.timers.delete(handle);
      fn();
    }, delayMs);

    this.timers.add(handle);
  }

  private clearTimers(): void {
    for (const handle of this.timers) {
      clearTimeout(handle);
    }

    this.timers.clear();
  }
}
