import { drawCard, drawMany } from './deck';
import {
  duelRank,
  recordDuelRound,
  BUST_RANK,
  MAX_HAND_CARDS,
  NATURAL_RANK,
} from './duel';
import type { DuelOutcome } from './duel';
import { getHandValue, isBlackjack } from './hand';
import { resetStats } from './stats';
import type { Card, Stats } from './types';

/** Maximum number of player seats at one table. */
export const SEAT_COUNT = 5;

export type TablePhase = 'lobby' | 'dealing' | 'player-turn' | 'round-over';

/** A duel needs at least two hands to compare at settlement. */
export const MIN_DUEL_PLAYERS = 2;

/** Starting chip stack granted on sit (and restored on bankruptcy relief). */
export const INITIAL_CHIPS = 1_000;
/** Mandatory base stake deducted at the start of every dealt hand. */
export const BASE_ANTE = 100;
/** Bonus chips awarded on top of the 1:1 payout for a Natural or 5-Card Charlie win. */
export const SPECIAL_WIN_BONUS = 50;

/**
 * A seat is "occupied" while `playerId` is non-empty. A seat whose owner left
 * mid-round keeps its cards until the round ends (`playerId === ''` with a
 * non-empty `name`) so the hand can still be settled; it is cleared on
 * BACK_TO_LOBBY.
 */
export interface Seat {
  seatIndex: number;
  playerId: string;
  name: string;
  connected: boolean;
  ready: boolean;
  cards: Card[];
  acted: boolean;
  outcome: DuelOutcome | null;
  stats: Stats;
  chips: number;
  bet: number;
  doubled: boolean;
  chipDelta: number | null;
  rebuyCount: number;
  /** True once this player has been dealt into at least one round at this table. */
  veteran: boolean;
}

export interface TableState {
  phase: TablePhase;
  roundId: number;
  deck: Card[];
  /**
   * False while a round is being played: every seat's latest card stays
   * hidden from the other players (rotating hole card). Flips to true at
   * settlement so every hand is revealed for the showdown.
   */
  holeRevealed: boolean;
  seats: Seat[];
  turnSeat: number | null;
  /** Seat index that acts first in the current round (rotates each deal). */
  startSeat: number | null;
  /** Player ID of the room creator (first seated player); used for host succession. */
  hostPlayerId: string | null;
}

export type TableAction =
  | { type: 'SIT'; seatIndex: number; playerId: string; name: string }
  | { type: 'STAND_UP'; playerId: string }
  | { type: 'SET_READY'; playerId: string; ready: boolean }
  | { type: 'START_ROUND'; deck: Card[] }
  | { type: 'DEAL_COMPLETE' }
  | { type: 'HIT'; seatIndex: number }
  | { type: 'STAND'; seatIndex: number }
  | { type: 'DOUBLE'; seatIndex: number }
  | { type: 'SEAT_TIMEOUT'; seatIndex: number }
  | { type: 'PLAYER_DISCONNECT'; playerId: string }
  | { type: 'PLAYER_RECONNECT'; playerId: string }
  | { type: 'KICK'; seatIndex: number; byPlayerId: string }
  | { type: 'BACK_TO_LOBBY' };

function emptySeat(seatIndex: number): Seat {
  return {
    seatIndex,
    playerId: '',
    name: '',
    connected: false,
    ready: false,
    cards: [],
    acted: false,
    outcome: null,
    stats: resetStats(),
    chips: INITIAL_CHIPS,
    bet: 0,
    doubled: false,
    chipDelta: null,
    rebuyCount: 0,
    veteran: false,
  };
}

export function createInitialTable(): TableState {
  return {
    phase: 'lobby',
    roundId: 0,
    deck: [],
    holeRevealed: true,
    seats: Array.from({ length: SEAT_COUNT }, (_, index) => emptySeat(index)),
    turnSeat: null,
    startSeat: null,
    hostPlayerId: null,
  };
}

export function isSeatOccupied(seat: Seat): boolean {
  return seat.playerId !== '';
}

export function occupiedSeatCount(state: TableState): number {
  return state.seats.filter(isSeatOccupied).length;
}

/**
 * The acting host: the room creator while seated and connected, otherwise the
 * lowest-index seated connected player.
 */
export function effectiveHostId(
  state: TableState,
  creatorId: string | null = state.hostPlayerId,
): string | null {
  const hostSeat =
    creatorId === null
      ? undefined
      : state.seats.find((seat) => seat.playerId === creatorId);

  if (hostSeat && hostSeat.connected) {
    return creatorId;
  }

  const fallback = state.seats.find((seat) => isSeatOccupied(seat) && seat.connected);
  return fallback ? fallback.playerId : creatorId;
}

/**
 * Non-host players who have already played at least one round at this table
 * (`veteran === true`) are automatically readied after a round ends, while
 * first-time joiners and the acting host must manually ready up.
 */
function autoReadyAfterRound(seat: Seat, actingHostId: string | null): boolean {
  return isSeatOccupied(seat) && seat.connected && seat.veteran && seat.playerId !== actingHostId;
}

/**
 * A duel may start in the lobby (or directly from round-over via early ready)
 * with at least two *connected* seated players, all of them ready. A
 * disconnected seat neither blocks the start nor counts toward the minimum.
 */
export function canStartRound(state: TableState): boolean {
  if (state.phase !== 'lobby' && state.phase !== 'round-over') {
    return false;
  }

  const active = state.seats.filter((seat) => isSeatOccupied(seat) && seat.connected);
  return active.length >= MIN_DUEL_PLAYERS && active.every((seat) => seat.ready);
}

function findSeatByPlayer(state: TableState, playerId: string): Seat | undefined {
  return state.seats.find((seat) => seat.playerId === playerId);
}

/** A seat that still owes an action: seated, dealt in, not busted, not done. */
function isActionable(seat: Seat): boolean {
  return isSeatOccupied(seat) && seat.cards.length > 0 && !seat.acted && seat.outcome === null;
}

/** Whether the seat may Double Down right now (2-card opening hand, enough chips). */
export function canDoubleSeat(state: TableState, seatIndex: number): boolean {
  if (state.phase !== 'player-turn' || state.turnSeat !== seatIndex) {
    return false;
  }

  const seat = state.seats[seatIndex];

  if (!seat || !isActionable(seat)) {
    return false;
  }

  return seat.cards.length === 2 && !seat.doubled && seat.chips >= BASE_ANTE && state.deck.length > 0;
}

function cyclicSeatsFrom(seats: Seat[], startIndex: number): Seat[] {
  const count = seats.length;
  const normalized = ((startIndex % count) + count) % count;
  return Array.from({ length: count }, (_, offset) => seats[(normalized + offset) % count]);
}

function firstActor(state: TableState): number | null {
  const seat = cyclicSeatsFrom(state.seats, state.startSeat ?? 0).find(isActionable);
  return seat ? seat.seatIndex : null;
}

function relieveIfBankrupt(seat: Seat): Seat {
  if (!isSeatOccupied(seat) || seat.chips >= BASE_ANTE) {
    return seat;
  }

  return {
    ...seat,
    chips: INITIAL_CHIPS,
    rebuyCount: seat.rebuyCount + 1,
  };
}

/**
 * Rank every dealt hand; the strongest hand wins outright unless it is tied
 * (or everyone busted), in which case the strongest hands push. Mid-round
 * busts do NOT pre-settle: the opponent might bust too, so all outcomes are
 * decided here and only here.
 */
function settleAllSeats(state: TableState): TableState {
  const dealt = state.seats.filter((seat) => seat.cards.length > 0);
  const ranks = dealt.map((seat) => duelRank(seat.cards));
  const best = dealt.length > 0 ? Math.max(...ranks) : NATURAL_RANK;
  const bestCount = ranks.filter((rank) => rank === best).length;
  const sharedTop = best === BUST_RANK || bestCount > 1;
  const actingHostId = effectiveHostId(state);

  // Zero-sum pot: collect all bets lost by non-top hands so winners take the pot.
  const losersPot = dealt
    .filter((seat) => duelRank(seat.cards) !== best)
    .reduce((sum, seat) => sum + seat.bet, 0);
  const topSeats = dealt.filter((seat) => duelRank(seat.cards) === best);
  const totalTopBet = topSeats.reduce((sum, seat) => sum + seat.bet, 0);

  return {
    ...state,
    phase: 'round-over',
    turnSeat: null,
    holeRevealed: true,
    seats: state.seats.map((seat) => {
      const nextReady = autoReadyAfterRound(seat, actingHostId);

      if (seat.cards.length === 0) {
        return { ...seat, ready: nextReady };
      }

      const isTop = duelRank(seat.cards) === best;
      const outcome: DuelOutcome = isTop ? (sharedTop ? 'push' : 'win') : 'loss';

      // Sole winner takes the entire losers' pot (or at least 1:1 on their own
      // doubled bet in heads-up). Tied top hands split the eliminated players'
      // pot proportionally to their stake.
      const potShare =
        outcome === 'win'
          ? Math.max(losersPot, seat.bet)
          : outcome === 'push' && losersPot > 0 && totalTopBet > 0
            ? Math.floor((losersPot * seat.bet) / totalTopBet)
            : 0;

      const chipDelta = outcome === 'loss' ? -seat.bet : potShare;
      const payout = outcome === 'loss' ? 0 : seat.bet + potShare;

      return {
        ...seat,
        ready: nextReady,
        outcome,
        chipDelta,
        chips: seat.chips + payout,
        stats: recordDuelRound(seat.stats, outcome),
      };
    }),
  };
}

/**
 * Move the turn to the next actionable seat in cyclic order starting after
 * the current actor. Once nobody can act anymore the duel settles immediately.
 */
function advanceTurn(state: TableState): TableState {
  const searchFrom =
    state.turnSeat !== null ? (state.turnSeat + 1) % SEAT_COUNT : (state.startSeat ?? 0);
  const next = cyclicSeatsFrom(state.seats, searchFrom).find(isActionable);

  if (next) {
    return { ...state, turnSeat: next.seatIndex };
  }

  return settleAllSeats(state);
}

function startRound(state: TableState, deck: Card[]): TableState {
  if (!canStartRound(state)) {
    return state;
  }

  // Clean up any ghost seats left over from round-over and top up bankrupt players.
  const preparedSeats = state.seats.map((seat) =>
    isSeatOccupied(seat) ? relieveIfBankrupt(seat) : emptySeat(seat.seatIndex),
  );

  // Connected players are ready by the canStartRound gate. A disconnected
  // player only participates when they readied before dropping; one who was
  // absent at deal time sits the hand out entirely (no cards, no turns).
  const participants = preparedSeats.filter(
    (seat) => isSeatOccupied(seat) && (seat.connected || seat.ready),
  );
  const needed = participants.length * 2;

  if (deck.length < needed) {
    return state;
  }

  const dealt = drawMany(deck, needed);
  const cardsBySeat = new Map<number, Card[]>();

  for (const seat of participants) {
    cardsBySeat.set(seat.seatIndex, [dealt.cards[0], dealt.cards[1]]);
    dealt.cards.splice(0, 2);
  }

  const startParticipant = participants[state.roundId % participants.length];
  const startSeat = startParticipant ? startParticipant.seatIndex : 0;

  return {
    ...state,
    phase: 'dealing',
    roundId: state.roundId + 1,
    deck: dealt.deck,
    holeRevealed: false,
    turnSeat: null,
    startSeat,
    seats: preparedSeats.map((seat) =>
      cardsBySeat.has(seat.seatIndex)
        ? {
            ...seat,
            cards: cardsBySeat.get(seat.seatIndex) ?? [],
            acted: false,
            outcome: null,
            ready: false,
            veteran: true,
            chips: seat.chips - BASE_ANTE,
            bet: BASE_ANTE,
            doubled: false,
            chipDelta: null,
          }
        : {
            ...seat,
            cards: [],
            acted: false,
            outcome: null,
            bet: 0,
            doubled: false,
            chipDelta: null,
          },
    ),
  };
}

function dealComplete(state: TableState): TableState {
  if (state.phase !== 'dealing') {
    return state;
  }

  // Naturals never act; the ranking at settlement still rewards them.
  const seats = state.seats.map((seat) =>
    seat.cards.length > 0 && isBlackjack(seat.cards) ? { ...seat, acted: true } : seat,
  );

  const withSeats = { ...state, seats };
  const actor = firstActor(withSeats);

  if (actor === null) {
    // Everybody holds a natural: nothing to play, settle right away.
    return settleAllSeats(withSeats);
  }

  return { ...withSeats, phase: 'player-turn', turnSeat: actor };
}

function seatAction(
  state: TableState,
  seatIndex: number,
  mode: 'hit' | 'stand' | 'double' | 'timeout',
): TableState {
  if (state.phase !== 'player-turn' || state.turnSeat !== seatIndex) {
    return state;
  }

  const seat = state.seats[seatIndex];

  if (!seat || !isActionable(seat)) {
    return state;
  }

  if (mode === 'double') {
    if (!canDoubleSeat(state, seatIndex)) {
      return state;
    }

    const drawn = drawCard(state.deck);
    const cards = [...seat.cards, drawn.card];
    const nextSeat: Seat = {
      ...seat,
      cards,
      chips: seat.chips - BASE_ANTE,
      bet: seat.bet + BASE_ANTE,
      doubled: true,
      acted: true,
    };

    const nextState: TableState = {
      ...state,
      deck: drawn.deck,
      seats: state.seats.map((candidate) =>
        candidate.seatIndex === seatIndex ? nextSeat : candidate,
      ),
    };

    return advanceTurn(nextState);
  }

  if (mode === 'hit') {
    if (state.deck.length === 0) {
      return state;
    }

    const drawn = drawCard(state.deck);
    const cards = [...seat.cards, drawn.card];
    const value = getHandValue(cards);

    let nextSeat: Seat = { ...seat, cards };

    if (value.isBust) {
      // A bust stops the seat but is not a loss yet: if every hand busts the
      // round pushes, so outcomes wait for settlement.
      nextSeat = { ...nextSeat, acted: true };
    } else if (value.total === 21 || cards.length >= MAX_HAND_CARDS) {
      // Twenty-one or Five-Card Charlie plays itself; no further decisions.
      nextSeat = { ...nextSeat, acted: true };
    }

    const nextState: TableState = {
      ...state,
      deck: drawn.deck,
      seats: state.seats.map((candidate) =>
        candidate.seatIndex === seatIndex ? nextSeat : candidate,
      ),
    };

    return nextSeat.acted ? advanceTurn(nextState) : nextState;
  }

  // STAND and SEAT_TIMEOUT share the same transition.
  const nextState: TableState = {
    ...state,
    seats: state.seats.map((candidate) =>
      candidate.seatIndex === seatIndex ? { ...candidate, acted: true } : candidate,
    ),
  };

  return advanceTurn(nextState);
}

function sit(state: TableState, seatIndex: number, playerId: string, name: string): TableState {
  const validPhase = state.phase === 'lobby' || state.phase === 'round-over';

  if (!validPhase) {
    return state;
  }

  const seat = state.seats[seatIndex];
  const cleanName = name.trim();

  if (
    !seat ||
    seat.playerId !== '' ||
    seat.name !== '' ||
    cleanName === '' ||
    findSeatByPlayer(state, playerId)
  ) {
    return state;
  }

  return {
    ...state,
    hostPlayerId: state.hostPlayerId ?? playerId,
    seats: state.seats.map((candidate) =>
      candidate.seatIndex === seatIndex
        ? {
            ...candidate,
            playerId,
            name: cleanName,
            connected: true,
            ready: false,
            veteran: false,
          }
        : candidate,
    ),
  };
}

function standUp(state: TableState, playerId: string): TableState {
  const seat = findSeatByPlayer(state, playerId);

  if (!seat) {
    return state;
  }

  if (state.phase === 'lobby' || state.phase === 'round-over') {
    return {
      ...state,
      seats: state.seats.map((candidate) =>
        candidate.seatIndex === seat.seatIndex ? emptySeat(seat.seatIndex) : candidate,
      ),
    };
  }

  // Mid-round departure: ghost the seat. The hand is still settled, and the
  // seat is fully cleared when the table returns to the lobby.
  const ghosted: TableState = {
    ...state,
    seats: state.seats.map((candidate) =>
      candidate.seatIndex === seat.seatIndex
        ? { ...candidate, playerId: '', connected: false, acted: true }
        : candidate,
    ),
  };

  if (state.phase === 'player-turn' && state.turnSeat === seat.seatIndex) {
    return advanceTurn(ghosted);
  }

  return ghosted;
}

/**
 * The room host removes another player. In the lobby the seat is freed at
 * once (name and stats released); mid-round the seat is ghosted exactly like
 * a voluntary stand-up so the hand still takes part in settlement.
 */
function kick(state: TableState, seatIndex: number, byPlayerId: string): TableState {
  const seat = state.seats[seatIndex];

  if (!seat || !isSeatOccupied(seat) || seat.playerId === byPlayerId) {
    return state;
  }

  if (state.phase === 'lobby' || state.phase === 'round-over') {
    return {
      ...state,
      seats: state.seats.map((candidate) =>
        candidate.seatIndex === seatIndex ? emptySeat(seatIndex) : candidate,
      ),
    };
  }

  const ghosted: TableState = {
    ...state,
    seats: state.seats.map((candidate) =>
      candidate.seatIndex === seatIndex
        ? { ...candidate, playerId: '', connected: false, acted: true }
        : candidate,
    ),
  };

  if (state.phase === 'player-turn' && state.turnSeat === seatIndex) {
    return advanceTurn(ghosted);
  }

  return ghosted;
}

function setReady(state: TableState, playerId: string, ready: boolean): TableState {
  if (state.phase !== 'lobby' && state.phase !== 'round-over') {
    return state;
  }

  const seat = findSeatByPlayer(state, playerId);

  if (!seat || seat.ready === ready) {
    return state;
  }

  return {
    ...state,
    seats: state.seats.map((candidate) =>
      candidate.seatIndex === seat.seatIndex ? { ...candidate, ready } : candidate,
    ),
  };
}

function setConnected(state: TableState, playerId: string, connected: boolean): TableState {
  const seat = findSeatByPlayer(state, playerId);

  if (!seat) {
    return state;
  }

  const nextState: TableState = {
    ...state,
    seats: state.seats.map((candidate) =>
      candidate.seatIndex === seat.seatIndex ? { ...candidate, connected } : candidate,
    ),
  };

  if (state.phase === 'lobby' || state.phase === 'round-over') {
    const prevHostId = effectiveHostId(state);
    const nextHostId = effectiveHostId(nextState);

    if (prevHostId !== nextHostId && nextHostId !== null) {
      return {
        ...nextState,
        seats: nextState.seats.map((candidate) =>
          candidate.playerId === nextHostId ? { ...candidate, ready: false } : candidate,
        ),
      };
    }
  }

  return nextState;
}

function backToLobby(state: TableState): TableState {
  if (state.phase !== 'round-over') {
    return state;
  }

  const actingHostId = effectiveHostId(state);

  return {
    ...state,
    phase: 'lobby',
    deck: [],
    holeRevealed: true,
    turnSeat: null,
    startSeat: null,
    seats: state.seats.map((seat) =>
      isSeatOccupied(seat)
        ? relieveIfBankrupt({
            ...seat,
            cards: [],
            acted: false,
            outcome: null,
            ready: seat.playerId === actingHostId ? seat.ready : (seat.connected && seat.ready),
            bet: 0,
            doubled: false,
            chipDelta: null,
          })
        : emptySeat(seat.seatIndex),
    ),
  };
}

export function tableReducer(state: TableState, action: TableAction): TableState {
  switch (action.type) {
    case 'SIT':
      return sit(state, action.seatIndex, action.playerId, action.name);
    case 'STAND_UP':
      return standUp(state, action.playerId);
    case 'SET_READY':
      return setReady(state, action.playerId, action.ready);
    case 'START_ROUND':
      return startRound(state, action.deck);
    case 'DEAL_COMPLETE':
      return dealComplete(state);
    case 'HIT':
      return seatAction(state, action.seatIndex, 'hit');
    case 'STAND':
      return seatAction(state, action.seatIndex, 'stand');
    case 'DOUBLE':
      return seatAction(state, action.seatIndex, 'double');
    case 'SEAT_TIMEOUT':
      return seatAction(state, action.seatIndex, 'timeout');
    case 'PLAYER_DISCONNECT':
      return setConnected(state, action.playerId, false);
    case 'PLAYER_RECONNECT':
      return setConnected(state, action.playerId, true);
    case 'KICK':
      return kick(state, action.seatIndex, action.byPlayerId);
    case 'BACK_TO_LOBBY':
      return backToLobby(state);
  }
}
