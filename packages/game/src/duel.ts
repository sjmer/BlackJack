import { getHandValue, isBlackjack } from './hand';
import { recordRound } from './stats';
import type { Card, Outcome, Stats } from './types';

/**
 * Online duel mode: seated players compete against each other and there is no
 * dealer. Every finished hand is ranked at settlement; the strongest hand
 * wins, tied strongest hands push, everyone else loses.
 */
export type DuelOutcome = 'win' | 'loss' | 'push';

/** Rank of a natural 21; it beats a 21 assembled from three or more cards. */
export const NATURAL_RANK = 100;
/** Rank of a busted hand; every non-busted hand beats it. */
export const BUST_RANK = -1;

export function duelRank(cards: readonly Card[]): number {
  const value = getHandValue(cards);

  if (value.isBust) {
    return BUST_RANK;
  }

  return isBlackjack(cards) ? NATURAL_RANK : value.total;
}

const BUCKET_OUTCOME: Record<DuelOutcome, Outcome> = {
  win: 'player-win',
  loss: 'dealer-win',
  push: 'push',
};

export function recordDuelRound(stats: Stats, outcome: DuelOutcome): Stats {
  return recordRound(stats, BUCKET_OUTCOME[outcome]);
}
