import { EMPTY_STATS, type Outcome, type Stats } from './types';

export type OutcomeBucket = 'win' | 'loss' | 'push';

export function outcomeBucket(outcome: Outcome): OutcomeBucket {
  switch (outcome) {
    case 'player-blackjack':
    case 'dealer-bust':
    case 'player-win':
      return 'win';
    case 'dealer-blackjack':
    case 'player-bust':
    case 'dealer-win':
      return 'loss';
    case 'push':
      return 'push';
  }
}

export function recordRound(stats: Stats, outcome: Outcome): Stats {
  const bucket = outcomeBucket(outcome);

  if (bucket === 'win') {
    const streak = stats.streak + 1;
    return {
      ...stats,
      wins: stats.wins + 1,
      streak,
      bestStreak: Math.max(stats.bestStreak, streak),
    };
  }

  if (bucket === 'loss') {
    return {
      ...stats,
      losses: stats.losses + 1,
      streak: 0,
    };
  }

  return {
    ...stats,
    pushes: stats.pushes + 1,
    streak: 0,
  };
}

export function resetStats(): Stats {
  return { ...EMPTY_STATS };
}

export function totalRounds(stats: Stats): number {
  return stats.wins + stats.losses + stats.pushes;
}
