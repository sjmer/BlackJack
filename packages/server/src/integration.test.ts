import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as createClientSocket, type Socket } from 'socket.io-client';
import { HIDDEN_CARD, getHandValue } from '@bj/game';
import type { ChatMessage, TableView } from '@bj/game';
import { createApp, type AppHandle } from './index';

// Fast-forward every server timer so a full round completes in ~1s. The seat
// timeout stays comfortably above the 160ms recycle: on a loaded machine a
// 400ms idle window could fire spuriously and race the test polls.
const FAST_TIMINGS = { dealing: 60, seatTimeout: 1500, offlineSeatTimeout: 30, roundRecycle: 160 };

let handle: AppHandle;
let port: number;

beforeAll(async () => {
  handle = createApp({ timings: FAST_TIMINGS });
  await new Promise<void>((resolve) => {
    handle.http.listen(0, '127.0.0.1', resolve);
  });
  port = (handle.http.address() as { port: number }).port;
});

afterAll(async () => {
  await handle.close();
});

class Player {
  readonly socket: Socket;
  lastView: TableView | null = null;
  readonly chatLog: ChatMessage[] = [];
  kicked = false;
  private readonly history: TableView[] = [];

  constructor() {
    this.socket = createClientSocket(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    this.socket.on('state', (view: TableView) => {
      this.lastView = view;
      this.history.push(view);

      if (this.history.length > 200) {
        this.history.shift();
      }
    });
    this.socket.on('chat', (message: ChatMessage) => {
      this.chatLog.push(message);

      if (this.chatLog.length > 100) {
        this.chatLog.shift();
      }
    });
    this.socket.on('chat:history', (messages: ChatMessage[]) => {
      this.chatLog.splice(0, this.chatLog.length, ...messages);
    });
    this.socket.on('room:kicked', () => {
      this.kicked = true;
    });
  }

  create(name: string): Promise<{ roomId: string; playerId: string }> {
    return new Promise((resolve) => {
      this.socket.emit('room:create', { name }, (info: { roomId: string; playerId: string }) => resolve(info));
    });
  }

  join(
    roomId: string,
    name: string,
    playerId?: string,
  ): Promise<{ roomId?: string; playerId?: string; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('room:join', { roomId, name, playerId }, (info: Record<string, string>) => resolve(info));
    });
  }

  intent(type: string, extra: Record<string, unknown> = {}): void {
    this.socket.emit('intent', { type, ...extra });
  }

  chat(text: string): void {
    this.socket.emit('chat', { text });
  }

  kick(seatIndex: number): void {
    this.socket.emit('room:kick', { seatIndex });
  }

  async waitForChat(
    predicate: (message: ChatMessage) => boolean,
    timeoutMs = 4000,
  ): Promise<ChatMessage> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const found = this.chatLog.find(predicate);

      if (found) {
        return found;
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error('waitForChat timed out');
  }

  /**
   * Wait until a matching view shows up. Transient phases (round-over is
   * recycled within ~160ms here) may already be gone from the current
   * snapshot, so transient waits also scan recent history.
   */
  async waitFor(
    predicate: (view: TableView) => boolean,
    timeoutMs = 4000,
    options: { transient?: boolean } = {},
  ): Promise<TableView> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (this.lastView && predicate(this.lastView)) {
        return this.lastView;
      }

      if (options.transient) {
        const seen = this.history.find(predicate);

        if (seen) {
          return seen;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error(`waitFor timed out; last phase=${this.lastView?.phase}`);
  }

  close(): void {
    this.socket.disconnect();
  }

  /**
   * Drop remembered views. Needed between re-deals: a transient scan for
   * "round-over" would keep matching the previous (failed) deal's snapshot
   * forever and burn every retry instantly.
   */
  forgetHistory(): void {
    this.history.length = 0;
  }
}

async function seatTwoPlayers() {
  const p1 = new Player();
  const info1 = await p1.create('Alice');

  const p2 = new Player();
  const info2 = await p2.join(info1.roomId, 'Bob');

  expect(info2.error).toBeUndefined();
  p1.intent('ready');

  await p2.waitFor((view) => view.seats[0]?.ready === true);

  return { p1, p2, info1, info2 };
}

/**
 * The server deals from a freshly shuffled deck, so seat 0 may open with a
 * natural (~9%) and never receive a turn at all (both naturals settle the
 * round instantly). Re-deal whole rounds until Alice actually holds the
 * first turn — the caller's turn-based assertions can then rely on it.
 */
async function dealUntilSeat0Turn(p1: Player, p2: Player): Promise<TableView> {
  for (let attempt = 0; attempt < 16; attempt++) {
    // Stale snapshots from earlier (failed) deals must not satisfy the
    // transient scan below — start every attempt with a clean memory.
    p1.forgetHistory();
    p2.forgetHistory();

    p1.intent('ready');
    p2.intent('ready');

    const view = await p1.waitFor(
      (candidate) => candidate.phase === 'player-turn' || candidate.phase === 'round-over',
      4000,
      { transient: true },
    );

    if (view.phase === 'player-turn' && view.startSeat === 0 && view.turnSeat === 0) {
      return view;
    }

    if (view.phase === 'player-turn') {
      p1.intent('stand', { roundId: view.roundId });
      p2.intent('stand', { roundId: view.roundId });
      await new Promise((resolve) => setTimeout(resolve, 35));
      p1.intent('stand', { roundId: view.roundId });
      p2.intent('stand', { roundId: view.roundId });
    }

    await p1.waitFor((candidate) => candidate.phase === 'lobby', 8000);
  }

  throw new Error('seat 0 never drew a playable hand in 16 deals');
}

describe('online room integration', () => {
  it('plays a full duel round with rotating hole cards masked per viewer', { timeout: 15_000 }, async () => {
    const { p1, p2, info1 } = await seatTwoPlayers();

    // The deck is shuffled per deal: retry until Alice (seat 0) actually
    // holds a turn — a natural opening would skip her turn entirely.
    const p1View = await dealUntilSeat0Turn(p1, p2);
    const p2View = await p2.waitFor((view) => view.phase === 'player-turn');

    // Sanitisation: your own hand travels in full; every opponent's latest
    // card is the constant placeholder and their total counts visible cards
    // only. Only the remaining deck size travels, never the deck itself.
    expect(p1View.seats[0].cards).toHaveLength(2);
    expect(p1View.seats[0].cards.every((card) => card.id !== HIDDEN_CARD.id)).toBe(true);
    expect(p1View.seats[0].hiddenCount).toBe(0);
    expect(p1View.seats[1].cards.at(-1)?.id).toBe(HIDDEN_CARD.id);
    expect(p1View.seats[1].hiddenCount).toBe(1);
    expect(p1View.seats[1].value.total).toBe(
      getHandValue(p1View.seats[1].cards.filter((card) => card.id !== HIDDEN_CARD.id)).total,
    );

    expect(p2View.seats[1].cards.every((card) => card.id !== HIDDEN_CARD.id)).toBe(true);
    expect(p2View.seats[0].cards.at(-1)?.id).toBe(HIDDEN_CARD.id);

    expect(typeof p1View.deckRemaining).toBe('number');
    expect(p1View.yourSeatIndex).toBe(0);
    expect(p2View.yourSeatIndex).toBe(1);

    // Turn ownership: the second player cannot hit during seat 0's turn.
    p2.intent('hit', { roundId: p1View.roundId });
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(p1.lastView?.turnSeat).toBe(0);
    expect(p1.lastView?.seats[1].cards).toHaveLength(2);

    // Both players stand; the duel settles as soon as the last hand finishes.
    p1.intent('stand', { roundId: p1View.roundId });

    // Bob may hold a natural: then the round settles with no turn of his.
    const next = await p2.waitFor(
      (view) => (view.phase === 'player-turn' && view.turnSeat === 1) || view.phase === 'round-over',
      4000,
      { transient: true },
    );

    if (next.phase === 'player-turn') {
      p2.intent('stand', { roundId: p1View.roundId });
    }

    const settled = await p1.waitFor((view) => view.phase === 'round-over', 4000, { transient: true });

    // Showdown: every hole card is revealed to everyone.
    expect(settled.holeRevealed).toBe(true);
    expect(settled.seats.every((seat) => seat.cards.every((card) => card.id !== HIDDEN_CARD.id))).toBe(true);
    expect(settled.seats.every((seat) => seat.hiddenCount === 0)).toBe(true);

    const seated = settled.seats.filter((seat) => seat.cards.length > 0);
    expect(seated).toHaveLength(2);
    expect(seated.every((seat) => seat.outcome !== null)).toBe(true);

    // One winner one loser, or a shared push — nothing else is possible.
    const outcomes = seated
      .map((seat) => seat.outcome ?? '')
      .sort()
      .join(',');
    expect(['loss,win', 'push,push']).toContain(outcomes);

    // The table recycles back to the lobby with clean seats.
    const lobby = await p1.waitFor((view) => view.phase === 'lobby', 8000);
    expect(lobby.seats.every((seat) => seat.cards.length === 0)).toBe(true);
    expect(lobby.seats[0].name).toBe('Alice');

    p1.close();
    p2.close();
    expect(info1.roomId).toMatch(/^[A-Z2-9]{4}$/);
  });

  it('marks disconnected seats and restores them on rejoin', { timeout: 15_000 }, async () => {
    const { p1, p2, info1 } = await seatTwoPlayers();
    // Deal until a real turn exists (a double natural settles instantly).
    await dealUntilSeat0Turn(p1, p2);
    await p2.waitFor((view) => view.phase === 'round-over', 4000, { transient: true });

    p1.socket.disconnect();
    await p2.waitFor((view) => view.seats[0].connected === false);

    // Stand up for the next round so the seat survives the recycle.
    p2.waitFor((view) => view.phase === 'lobby').then(() => p2.intent('ready'));
    await p2.waitFor((view) => view.phase === 'lobby', 8000);

    const returning = new Player();
    const rejoined = await returning.join(info1.roomId, 'Alice', info1.playerId);
    expect(rejoined.error).toBeUndefined();

    const restored = await returning.waitFor((view) => view.seats[0].connected === true && view.seats[0].occupied);
    expect(restored.seats[0].name).toBe('Alice');
    expect(restored.yourSeatIndex).toBe(0);

    returning.close();
    p2.close();
    p1.close();
  });

  it('rejects joining an unknown room', async () => {
    const stranger = new Player();
    const result = await stranger.join('ZZZZ', 'Nobody');
    expect(result.error).toBe('房间不存在或已关闭');
    stranger.close();
  });

  it('ignores stale intents from a previous round', { timeout: 15_000 }, async () => {
    const { p1, p2 } = await seatTwoPlayers();

    const first = await dealUntilSeat0Turn(p1, p2);
    p1.intent('stand', { roundId: first.roundId });

    // Bob may hold a natural: then the round settles with no turn of his.
    const next = await p2.waitFor(
      (view) => (view.phase === 'player-turn' && view.turnSeat === 1) || view.phase === 'round-over',
      4000,
      { transient: true },
    );

    if (next.phase === 'player-turn') {
      p2.intent('stand', { roundId: first.roundId });
    }

    await p1.waitFor((view) => view.phase === 'round-over', 4000, { transient: true });
    // The 160ms recycle timer can slip under heavy machine load; be generous.
    await p1.waitFor((view) => view.phase === 'lobby', 8000);

    // A hit carrying the finished round's id must not leak into the lobby.
    p1.intent('hit', { roundId: first.roundId });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(p1.lastView?.phase).toBe('lobby');
    expect(p1.lastView?.turnSeat).toBeNull();

    p1.close();
    p2.close();
  });

  it('readopts a disconnected seat for a same-name joiner without a playerId', { timeout: 15_000 }, async () => {
    const { p1, p2, info1, info2 } = await seatTwoPlayers();

    p1.socket.disconnect();
    await p2.waitFor((view) => view.seats[0].connected === false);

    // Fresh tab, no stored identity: the name alone reclaims the dead seat.
    const returning = new Player();
    const rejoined = await returning.join(info1.roomId, 'Alice');
    expect(rejoined.error).toBeUndefined();
    expect(rejoined.playerId).toBe(info1.playerId);

    const restored = await returning.waitFor(
      (view) => view.seats[0].connected === true && view.seats[0].occupied,
    );
    expect(restored.seats[0].name).toBe('Alice');
    expect(restored.yourSeatIndex).toBe(0);

    // A *connected* player's name is never matched: the clone becomes a
    // brand-new spectator instead of hijacking Bob's seat.
    const clone = new Player();
    const cloneInfo = await clone.join(info1.roomId, 'Bob');
    expect(cloneInfo.playerId).not.toBe(info2.playerId);
    const cloneView = await clone.waitFor((view) => view.phase === 'lobby');
    expect(cloneView.yourSeatIndex).not.toBe(1);

    clone.close();
    returning.close();
    p2.close();
    p1.close();
  });

  it('lets the host kick a player: seat freed, target notified, system chat', { timeout: 15_000 }, async () => {
    const { p1, p2 } = await seatTwoPlayers();

    // Bob is not the host: his kick attempt is silently ignored.
    p2.kick(0);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(p1.lastView?.seats[0].occupied).toBe(true);

    // Alice (creator) kicks Bob.
    p1.kick(1);
    await p1.waitFor((view) => view.seats[1].occupied === false);
    expect(p1.lastView?.seats[1].name).toBe('');

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(p2.kicked).toBe(true);

    const notice = await p1.waitForChat((message) => message.kind === 'system' && message.text.includes('Bob'));
    expect(notice.text).toContain('被房主移出');

    p1.close();
    p2.close();
  });

  it('passes host duties to the next connected player and back on return', { timeout: 15_000 }, async () => {
    const { p1, p2, info1 } = await seatTwoPlayers();

    // Host drops: Bob (seat 1) takes over.
    p1.socket.disconnect();
    await p2.waitFor((view) => view.seats[0].connected === false);
    await p2.waitFor((view) => view.seats[1].isHost === true);

    // Host returns with their original id: they reclaim the role.
    const returning = new Player();
    await returning.join(info1.roomId, 'Alice', info1.playerId);
    await p2.waitFor((view) => view.seats[0].isHost === true && view.seats[1].isHost === false);

    // The acting host (Alice again) removes a dead seat: kick works.
    returning.socket.disconnect();
    await p2.waitFor((view) => view.seats[0].connected === false);
    await p2.waitFor((view) => view.seats[1].isHost === true);
    p2.kick(0);
    await p2.waitFor((view) => view.seats[0].occupied === false);

    returning.close();
    p1.close();
    p2.close();
  });

  it('chats within the room: broadcast, rate limit, history replay for late joiners', { timeout: 15_000 }, async () => {
    const { p1, p2, info1 } = await seatTwoPlayers();

    p1.chat('你好，祝你好运');
    const received = await p2.waitForChat((message) => message.text === '你好，祝你好运');
    expect(received.kind).toBe('player');
    expect(received.name).toBe('Alice');

    // Firing again inside the cooldown window: silently dropped everywhere.
    p1.chat('刷屏');
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(p2.chatLog.some((message) => message.text === '刷屏')).toBe(false);
    expect(p1.chatLog.some((message) => message.text === '刷屏')).toBe(false);

    // A late joiner receives the backlog via chat:history on attach.
    const late = new Player();
    await late.join(info1.roomId, 'Carol');
    await late.waitForChat((message) => message.text === '你好，祝你好运');

    late.close();
    p1.close();
    p2.close();
  });

  it('auto-stands an offline player quickly instead of freezing their turn', { timeout: 15_000 }, async () => {
    const { p1, p2 } = await seatTwoPlayers();
    // Retry until Alice holds the turn (a natural opening would skip it).
    await dealUntilSeat0Turn(p1, p2);

    // Alice drops while holding the turn: the short offline grace fires and
    // the round moves on to Bob without waiting the full seat timeout. Bob
    // may hold a natural, in which case the round settles outright.
    p1.socket.disconnect();

    await p2.waitFor(
      (view) => (view.phase === 'player-turn' && view.turnSeat === 1) || view.phase === 'round-over',
      4000,
      { transient: true },
    );
    await p2.waitFor((view) => view.seats[0].connected === false);

    // The showdown keeps every hand: Alice's two cards were never hit
    // (auto-stand, not a draw) and the round did not freeze on her.
    const settled = await p2.waitFor((view) => view.phase === 'round-over', 4000, { transient: true });
    expect(settled.seats[0].cards).toHaveLength(2);
    expect(settled.seats[0].outcome).not.toBeNull();

    p1.close();
    p2.close();
  });

  it('supports double down intent, settles chips and broadcasts phaseDurationMs', { timeout: 15_000 }, async () => {
    const { p1, p2 } = await seatTwoPlayers();
    const turnView = await dealUntilSeat0Turn(p1, p2);

    expect(turnView.phaseDurationMs).toBe(FAST_TIMINGS.seatTimeout);
    expect(turnView.seats[0].canDouble).toBe(true);
    expect(turnView.seats[0].bet).toBe(100);
    expect(turnView.seats[0].chips).toBe(900);

    p1.intent('double', { roundId: turnView.roundId });

    const next = await p2.waitFor(
      (view) => (view.phase === 'player-turn' && view.turnSeat === 1) || view.phase === 'round-over',
      4000,
      { transient: true },
    );

    if (next.phase === 'player-turn') {
      expect(next.seats[0].doubled).toBe(true);
      expect(next.seats[0].bet).toBe(200);
      expect(next.seats[0].cards).toHaveLength(3);
      p2.intent('stand', { roundId: turnView.roundId });
    }

    const settled = await p1.waitFor((view) => view.phase === 'round-over', 4000, { transient: true });
    expect(settled.seats[0].doubled).toBe(true);
    expect(settled.seats[0].chipDelta).not.toBeNull();
    expect([200, 250, 0, -200]).toContain(settled.seats[0].chipDelta);

    p1.close();
    p2.close();
  });

  it('auto-seats a waiting spectator as soon as a seat opens up', { timeout: 15_000 }, async () => {
    const players = Array.from({ length: 5 }, () => new Player());
    const info0 = await players[0].create('P0');

    for (let i = 1; i < 5; i++) {
      await players[i].join(info0.roomId, `P${i}`);
    }

    // 6th player joins while all 5 seats are occupied -> spectator.
    const spectator = new Player();
    await spectator.join(info0.roomId, 'Spec');
    const specView = await spectator.waitFor((view) => view.phase === 'lobby');
    expect(specView.yourSeatIndex).toBeNull();

    // Seat 2 leaves the table -> spectator automatically takes seat 2.
    players[2].intent('standUp');
    const seatedView = await spectator.waitFor((view) => view.yourSeatIndex === 2);
    expect(seatedView.seats[2].name).toBe('Spec');
    expect(seatedView.seats[2].occupied).toBe(true);

    spectator.close();
    for (const p of players) {
      p.close();
    }
  });
});
