import { describe, expect, it } from 'vitest';
import { cardValue, getHandValue, isBlackjack, isRedSuit } from './hand';
import type { Card, Rank, Suit } from './types';

let id = 0;
function card(rank: Rank, suit: Suit = 'spades'): Card {
  id += 1;
  return { id: `test-${id}`, rank, suit };
}

describe('hand value', () => {
  it('values face cards at ten and number cards at face value', () => {
    expect(cardValue(card('J'))).toBe(10);
    expect(cardValue(card('Q'))).toBe(10);
    expect(cardValue(card('K'))).toBe(10);
    expect(cardValue(card('7'))).toBe(7);
    expect(cardValue(card('A'))).toBe(11);
  });

  it('keeps the ace at eleven when it is favorable', () => {
    expect(getHandValue([card('A'), card('9')])).toEqual({
      total: 20,
      isSoft: true,
      isBust: false,
    });
  });

  it('demotes aces when keeping eleven would bust (A + 9 + 5 = 15)', () => {
    expect(getHandValue([card('A'), card('9'), card('5')])).toEqual({
      total: 15,
      isSoft: false,
      isBust: false,
    });
  });

  it('uses only one ace as eleven (A + A + 9 = 21)', () => {
    expect(getHandValue([card('A'), card('A'), card('9')])).toEqual({
      total: 21,
      isSoft: true,
      isBust: false,
    });
  });

  it('falls back to the lowest ace total when necessary (A + A + A + 9 = 12)', () => {
    expect(getHandValue([card('A'), card('A'), card('A'), card('9')])).toEqual({
      total: 12,
      isSoft: false,
      isBust: false,
    });
  });

  it('detects busts and returns zero for an empty hand', () => {
    expect(getHandValue([card('K'), card('Q'), card('J')]).isBust).toBe(true);
    expect(getHandValue([])).toEqual({ total: 0, isSoft: false, isBust: false });
  });
});

describe('blackjack and suit helpers', () => {
  it('only treats a two-card 21 as blackjack', () => {
    expect(isBlackjack([card('A'), card('K')])).toBe(true);
    expect(isBlackjack([card('A'), card('9')])).toBe(false);
    expect(isBlackjack([card('7'), card('7'), card('7')])).toBe(false);
  });

  it('correctly identifies red suits', () => {
    expect(isRedSuit(card('A', 'hearts'))).toBe(true);
    expect(isRedSuit(card('A', 'diamonds'))).toBe(true);
    expect(isRedSuit(card('A', 'spades'))).toBe(false);
    expect(isRedSuit(card('A', 'clubs'))).toBe(false);
  });
});
