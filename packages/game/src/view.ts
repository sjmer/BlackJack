import { getHandValue, isBlackjack } from './hand';
import { isFiveCardCharlie } from './duel';
import type { DuelOutcome } from './duel';
import type { Card, HandValue, Stats } from './types';
import { canDoubleSeat, type TablePhase, type TableState } from './table';

/**
 * Placeholder sent instead of another player's hole card. It is constant, so
 * it leaks nothing, and the client renders it face-down.
 */
export const HIDDEN_CARD: Card = { id: 'hole-card', suit: 'spades', rank: 'A' };

export interface SeatView {
  seatIndex: number;
  /** A live seat owned by a connected-room member. */
  occupied: boolean;
  /** The owner left mid-round; the hand is still shown and settled. */
  isGhost: boolean;
  name: string;
  connected: boolean;
  ready: boolean;
  cards: Card[];
  /** Value of the cards this viewer may see (own seat: the whole hand). */
  value: HandValue;
  outcome: DuelOutcome | null;
  stats: Stats;
  isYou: boolean;
  /**
   * Server-computed natural flag, masked the same way as the cards: true
   * only for the owner's own seat or once the showdown reveals every hand.
   */
  natural: boolean;
  /**
   * Server-computed Five-Card Charlie flag (5 cards without busting), masked
   * like `natural` so opponents cannot tell whether the 5th hidden card busted.
   */
  charlie: boolean;
  /** How many of this seat's cards are hidden from this viewer. */
  hiddenCount: number;
  /** This seat's owner is the room's acting host (manager of the table). */
  isHost: boolean;
  chips: number;
  bet: number;
  doubled: boolean;
  chipDelta: number | null;
  rebuyCount: number;
  canDouble: boolean;
}

export interface TableView {
  roomId: string;
  phase: TablePhase;
  roundId: number;
  seats: SeatView[];
  holeRevealed: boolean;
  deckRemaining: number;
  turnSeat: number | null;
  startSeat: number | null;
  yourSeatIndex: number | null;
  /** Duration in ms of the active phase/turn timer, or null in lobby. */
  phaseDurationMs: number | null;
}

/**
 * Project the authoritative table state into what one viewer may see.
 *
 * Rotating hole card: while the round is being played, every dealt hand
 * keeps exactly one card hidden from the others — its latest card. A hit
 * therefore reveals the previous hole card and hides the new draw. The owner
 * always sees their own hand in full; the showdown (`holeRevealed`) reveals
 * every hand. The deck order never leaves the server in any phase.
 */
export function viewForTable(
  state: TableState,
  viewerPlayerId: string | null,
  roomId: string,
  hostPlayerId: string | null = null,
  phaseDurationMs: number | null = null,
): TableView {
  const revealed = state.holeRevealed;

  const seats: SeatView[] = state.seats.map((seat) => {
    const isYou = viewerPlayerId !== null && seat.playerId === viewerPlayerId;
    const dealt = seat.cards.length > 0;
    const hideLast = dealt && !revealed && !isYou;
    const visibleCards = hideLast ? seat.cards.slice(0, -1) : seat.cards;

    return {
      seatIndex: seat.seatIndex,
      occupied: seat.playerId !== '',
      isGhost: seat.playerId === '' && seat.name !== '',
      name: seat.name,
      connected: seat.connected,
      ready: seat.ready,
      cards: hideLast ? [...visibleCards, HIDDEN_CARD] : seat.cards,
      value: getHandValue(visibleCards),
      outcome: seat.outcome,
      stats: seat.stats,
      isYou,
      natural: isYou || revealed ? isBlackjack(seat.cards) : false,
      charlie: isYou || revealed ? isFiveCardCharlie(seat.cards) : false,
      hiddenCount: hideLast ? 1 : 0,
      isHost: hostPlayerId !== null && seat.playerId === hostPlayerId,
      chips: seat.chips,
      bet: seat.bet,
      doubled: seat.doubled,
      chipDelta: seat.chipDelta,
      rebuyCount: seat.rebuyCount,
      canDouble: isYou && canDoubleSeat(state, seat.seatIndex),
    };
  });

  return {
    roomId,
    phase: state.phase,
    roundId: state.roundId,
    seats,
    holeRevealed: revealed,
    deckRemaining: state.deck.length,
    turnSeat: state.turnSeat,
    startSeat: state.startSeat,
    yourSeatIndex: seats.find((seat) => seat.isYou)?.seatIndex ?? null,
    phaseDurationMs,
  };
}
