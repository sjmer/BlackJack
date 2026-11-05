import { describe, expect, it } from 'vitest';
import { createInitialState, gameReducer } from './reducer';
import { EMPTY_STATS, type Card, type GameState, type Rank, type Suit } from './types';

let id = 0;
function card(rank: Rank, suit: Suit = 'spades'): Card {
  id += 1;
  return { id: `reducer-${id}`, rank, suit };
}

function start(deck: Card[]): GameState {
  return gameReducer(createInitialState({ ...EMPTY_STATS }), {
    type: 'START_ROUND',
    deck,
  });
}

describe('game reducer', () => {
  it('restores a persisted round number', () => {
    const state = createInitialState({ ...EMPTY_STATS }, 10);
    expect(state.roundId).toBe(10);
    expect(state.phase).toBe('ready');
  });

  it('deals alternately to the player and dealer', () => {
    const deck = [
      card('A', 'spades'),
      card('K', 'clubs'),
      card('9', 'hearts'),
      card('7', 'diamonds'),
      card('5', 'clubs'),
    ];
    const state = start(deck);

    expect(state.phase).toBe('dealing');
    expect(state.roundId).toBe(1);
    expect(state.playerCards).toEqual([deck[0], deck[2]]);
    expect(state.dealerCards).toEqual([deck[1], deck[3]]);
    expect(state.deck).toEqual([deck[4]]);
    expect(state.holeRevealed).toBe(false);
  });

  it('moves to the player turn when neither side has a natural', () => {
    const state = gameReducer(
      start([card('A'), card('9'), card('9'), card('7')]),
      { type: 'DEAL_COMPLETE' },
    );

    expect(state.phase).toBe('player-turn');
    expect(state.outcome).toBeNull();
    expect(state.stats).toEqual(EMPTY_STATS);
  });

  it('settles a player natural during dealing without double-counting', () => {
    const dealt = start([card('A'), card('9'), card('K'), card('7')]);
    const settled = gameReducer(dealt, { type: 'DEAL_COMPLETE' });
    const repeated = gameReducer(settled, { type: 'DEAL_COMPLETE' });

    expect(settled.phase).toBe('round-over');
    expect(settled.outcome).toBe('player-blackjack');
    expect(settled.holeRevealed).toBe(true);
    expect(settled.stats.wins).toBe(1);
    expect(repeated.stats.wins).toBe(1);
  });

  it('settles a dealer natural', () => {
    const state = gameReducer(
      start([card('9'), card('A'), card('9'), card('K')]),
      { type: 'DEAL_COMPLETE' },
    );

    expect(state.phase).toBe('round-over');
    expect(state.outcome).toBe('dealer-blackjack');
    expect(state.stats.losses).toBe(1);
  });

  it('settles immediately when the player hits and busts', () => {
    const dealing = start([
      card('K'),
      card('9'),
      card('9'),
      card('7'),
      card('5'),
    ]);
    const playerTurn = gameReducer(dealing, { type: 'DEAL_COMPLETE' });
    const busted = gameReducer(playerTurn, { type: 'HIT' });

    expect(busted.phase).toBe('round-over');
    expect(busted.outcome).toBe('player-bust');
    expect(busted.holeRevealed).toBe(true);
    expect(busted.stats.losses).toBe(1);
  });

  it('plays the dealer turn until the house reaches 17', () => {
    const dealing = start([
      card('K'),
      card('K'),
      card('9'),
      card('6'),
      card('5'),
    ]);
    const playerTurn = gameReducer(dealing, { type: 'DEAL_COMPLETE' });
    const dealerTurn = gameReducer(playerTurn, { type: 'STAND' });
    const premature = gameReducer(dealerTurn, { type: 'FINISH_ROUND' });
    const drew = gameReducer(dealerTurn, { type: 'DEALER_DRAW' });
    const finished = gameReducer(drew, { type: 'FINISH_ROUND' });

    expect(dealerTurn.phase).toBe('dealer-turn');
    expect(dealerTurn.holeRevealed).toBe(true);
    expect(premature.phase).toBe('dealer-turn');
    expect(drew.dealerCards).toHaveLength(3);
    expect(finished.phase).toBe('round-over');
    expect(finished.outcome).toBe('dealer-win');
    expect(finished.stats.losses).toBe(1);

    const overDraw = gameReducer(finished, { type: 'DEALER_DRAW' });
    expect(overDraw.dealerCards).toEqual(finished.dealerCards);
  });

  it('does not let the dealer draw at 17 or above', () => {
    const dealing = start([card('K'), card('K'), card('9'), card('Q')]);
    const playerTurn = gameReducer(dealing, { type: 'DEAL_COMPLETE' });
    const dealerTurn = gameReducer(playerTurn, { type: 'STAND' });
    const ignoredDraw = gameReducer(dealerTurn, { type: 'DEALER_DRAW' });
    const finished = gameReducer(ignoredDraw, { type: 'FINISH_ROUND' });

    expect(ignoredDraw.dealerCards).toEqual(dealerTurn.dealerCards);
    expect(finished.outcome).toBe('dealer-win');
  });

  it('records a push as a push and breaks the streak', () => {
    const preloaded = createInitialState({
      wins: 2,
      losses: 0,
      pushes: 0,
      streak: 2,
      bestStreak: 2,
    });
    const dealing = gameReducer(preloaded, {
      type: 'START_ROUND',
      deck: [card('K'), card('K'), card('10'), card('Q')],
    });
    const playerTurn = gameReducer(dealing, { type: 'DEAL_COMPLETE' });
    const dealerTurn = gameReducer(playerTurn, { type: 'STAND' });
    const finished = gameReducer(dealerTurn, { type: 'FINISH_ROUND' });

    expect(finished.outcome).toBe('push');
    expect(finished.stats).toMatchObject({
      wins: 2,
      pushes: 1,
      streak: 0,
      bestStreak: 2,
    });
  });

  it('ignores a new round while a hand is in progress', () => {
    const playing = gameReducer(start([card('9'), card('9'), card('9'), card('7')]), {
      type: 'DEAL_COMPLETE',
    });
    const next = gameReducer(playing, {
      type: 'START_ROUND',
      deck: [card('A'), card('A'), card('K'), card('K')],
    });

    expect(next).toBe(playing);
  });

  it('resets stats and the hand counter together', () => {
    const state: GameState = {
      ...createInitialState({ wins: 5, losses: 2, pushes: 1, streak: 0, bestStreak: 5 }),
      phase: 'round-over',
      roundId: 8,
      outcome: 'player-win',
    };
    const reset = gameReducer(state, { type: 'RESET_STATS' });

    expect(reset.stats).toEqual(EMPTY_STATS);
    expect(reset.roundId).toBe(0);
    expect(reset.phase).toBe('round-over');
  });
});
