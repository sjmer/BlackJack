import { describe, expect, it } from 'vitest';
import { recordRound, resetStats, totalRounds } from './stats';
import { EMPTY_STATS, type Stats } from './types';

describe('stats', () => {
  it('increments wins and the current and best streaks', () => {
    const first = recordRound({ ...EMPTY_STATS }, 'player-win');
    const second = recordRound(first, 'player-blackjack');

    expect(second).toEqual<Stats>({
      wins: 2,
      losses: 0,
      pushes: 0,
      streak: 2,
      bestStreak: 2,
    });
  });

  it('records losses and resets the streak without lowering the best streak', () => {
    const hot: Stats = {
      wins: 4,
      losses: 0,
      pushes: 0,
      streak: 4,
      bestStreak: 4,
    };

    expect(recordRound(hot, 'dealer-win')).toMatchObject({
      wins: 4,
      losses: 1,
      streak: 0,
      bestStreak: 4,
    });
  });

  it('counts pushes and ends the winning streak', () => {
    const state: Stats = {
      wins: 1,
      losses: 0,
      pushes: 0,
      streak: 1,
      bestStreak: 1,
    };

    expect(recordRound(state, 'push')).toMatchObject({
      pushes: 1,
      streak: 0,
      bestStreak: 1,
    });
  });

  it('resets all fields and totals every hand', () => {
    const stats: Stats = {
      wins: 3,
      losses: 2,
      pushes: 1,
      streak: 1,
      bestStreak: 3,
    };

    expect(totalRounds(stats)).toBe(6);
    expect(resetStats()).toEqual(EMPTY_STATS);
  });
});
