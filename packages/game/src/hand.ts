import type { Card, HandValue, Rank } from './types';

const TEN_VALUE_RANKS = new Set<Rank>(['10', 'J', 'Q', 'K']);

export function cardValue(card: Card): number {
  if (card.rank === 'A') {
    return 11;
  }

  return TEN_VALUE_RANKS.has(card.rank) ? 10 : Number(card.rank);
}

/**
 * Returns the best total that does not exceed 21. Aces start as 11 and are
 * demoted to 1 only when keeping 11 would bust the hand.
 */
export function getHandValue(cards: readonly Card[]): HandValue {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aces += 1;
      total += 1;
    } else {
      total += cardValue(card);
    }
  }

  let isSoft = false;
  if (aces > 0 && total + 10 <= 21) {
    total += 10;
    isSoft = true;
  }

  return {
    total,
    isSoft,
    isBust: total > 21,
  };
}

export function isBlackjack(cards: readonly Card[]): boolean {
  return cards.length === 2 && getHandValue(cards).total === 21;
}

export function isRedSuit(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}
