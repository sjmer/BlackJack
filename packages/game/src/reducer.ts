import { dealerShouldHit } from './dealer';
import { drawCard, drawMany } from './deck';
import { getHandValue, isBlackjack } from './hand';
import { resolveOutcome } from './result';
import { recordRound, resetStats } from './stats';
import type { Card, GameState, Outcome, Stats } from './types';

export type GameAction =
  | { type: 'START_ROUND'; deck: Card[] }
  | { type: 'DEAL_COMPLETE' }
  | { type: 'HIT' }
  | { type: 'STAND' }
  | { type: 'DEALER_DRAW' }
  | { type: 'FINISH_ROUND' }
  | { type: 'RESET_STATS' };

export function createInitialState(stats: Stats, roundId = 0): GameState {
  return {
    phase: 'ready',
    roundId,
    deck: [],
    playerCards: [],
    dealerCards: [],
    holeRevealed: true,
    outcome: null,
    stats,
  };
}

function settleRound(state: GameState, outcome: Outcome): GameState {
  return {
    ...state,
    phase: 'round-over',
    holeRevealed: true,
    outcome,
    stats: recordRound(state.stats, outcome),
  };
}

function startRound(state: GameState, deck: Card[]): GameState {
  if (state.phase !== 'ready' && state.phase !== 'round-over') {
    return state;
  }

  if (deck.length < 4) {
    return state;
  }

  const dealt = drawMany(deck, 4);
  const playerCards = [dealt.cards[0], dealt.cards[2]];
  const dealerCards = [dealt.cards[1], dealt.cards[3]];

  return {
    ...state,
    phase: 'dealing',
    roundId: state.roundId + 1,
    deck: dealt.deck,
    playerCards,
    dealerCards,
    holeRevealed: false,
    outcome: null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_ROUND':
      return startRound(state, action.deck);

    case 'DEAL_COMPLETE': {
      if (state.phase !== 'dealing') {
        return state;
      }

      const playerNatural = isBlackjack(state.playerCards);
      const dealerNatural = isBlackjack(state.dealerCards);

      if (playerNatural || dealerNatural) {
        return settleRound(
          state,
          resolveOutcome(state.playerCards, state.dealerCards),
        );
      }

      return {
        ...state,
        phase: 'player-turn',
      };
    }

    case 'HIT': {
      if (state.phase !== 'player-turn') {
        return state;
      }

      const drawn = drawCard(state.deck);
      const playerCards = [...state.playerCards, drawn.card];

      if (getHandValue(playerCards).isBust) {
        return settleRound(
          {
            ...state,
            deck: drawn.deck,
            playerCards,
          },
          'player-bust',
        );
      }

      return {
        ...state,
        deck: drawn.deck,
        playerCards,
      };
    }

    case 'STAND': {
      if (state.phase !== 'player-turn') {
        return state;
      }

      return {
        ...state,
        phase: 'dealer-turn',
        holeRevealed: true,
      };
    }

    case 'DEALER_DRAW': {
      if (
        state.phase !== 'dealer-turn' ||
        !dealerShouldHit(getHandValue(state.dealerCards))
      ) {
        return state;
      }

      const drawn = drawCard(state.deck);

      return {
        ...state,
        deck: drawn.deck,
        dealerCards: [...state.dealerCards, drawn.card],
      };
    }

    case 'FINISH_ROUND': {
      if (state.phase !== 'dealer-turn') {
        return state;
      }

      if (dealerShouldHit(getHandValue(state.dealerCards))) {
        return state;
      }

      return settleRound(
        state,
        resolveOutcome(state.playerCards, state.dealerCards),
      );
    }

    case 'RESET_STATS':
      return {
        ...state,
        roundId: 0,
        stats: resetStats(),
      };
  }
}
