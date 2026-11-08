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
/** Rank of a Five-Card Charlie (5 cards without busting); beats a regular 21. */
export const CHARLIE_RANK = 50;
/** Maximum cards a hand can hold in duel mode (5 non-bust cards = Five-Card Charlie). */
export const MAX_HAND_CARDS = 5;
/** Rank of a busted hand; every non-busted hand beats it. */
export const BUST_RANK = -1;

export function isFiveCardCharlie(cards: readonly Card[]): boolean {
  return cards.length >= MAX_HAND_CARDS && !getHandValue(cards).isBust;
}

export function duelRank(cards: readonly Card[]): number {
  const value = getHandValue(cards);

  if (value.isBust) {
    return BUST_RANK;
  }

  if (isBlackjack(cards)) {
    return NATURAL_RANK;
  }

  if (cards.length >= MAX_HAND_CARDS) {
    return CHARLIE_RANK;
  }

  return value.total;
}

const BUCKET_OUTCOME: Record<DuelOutcome, Outcome> = {
  win: 'player-win',
  loss: 'dealer-win',
  push: 'push',
};

export function recordDuelRound(stats: Stats, outcome: DuelOutcome): Stats {
  return recordRound(stats, BUCKET_OUTCOME[outcome]);
}
