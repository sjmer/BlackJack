import { describe, expect, it } from 'vitest';
import { resolveOutcome } from './result';
import type { Card, Rank, Suit } from './types';

let id = 0;
function card(rank: Rank, suit: Suit = 'spades'): Card {
  id += 1;
  return { id: `result-${id}`, rank, suit };
}

describe('round outcome', () => {
  it('resolves both naturals as a push', () => {
    expect(resolveOutcome([card('A'), card('K')], [card('A'), card('Q')])).toBe('push');
  });

  it('resolves a player natural before normal comparison', () => {
    expect(resolveOutcome([card('A'), card('K')], [card('10'), card('9')])).toBe(
      'player-blackjack',
    );
  });

  it('resolves a dealer natural when the player is not natural', () => {
    expect(resolveOutcome([card('10'), card('10')], [card('A'), card('K')])).toBe(
      'dealer-blackjack',
    );
  });

  it('resolves player busts and dealer busts', () => {
    expect(resolveOutcome([card('K'), card('Q'), card('5')], [card('10'), card('8')])).toBe(
      'player-bust',
    );
    expect(resolveOutcome([card('K'), card('9')], [card('10'), card('6'), card('8')])).toBe(
      'dealer-bust',
    );
  });

  it('compares totals and supports pushes', () => {
    expect(resolveOutcome([card('K'), card('9')], [card('10'), card('8')])).toBe('player-win');
    expect(resolveOutcome([card('K'), card('8')], [card('10'), card('9')])).toBe('dealer-win');
    expect(resolveOutcome([card('K'), card('8')], [card('10'), card('8')])).toBe('push');
  });

  it('does not treat a three-card 21 as blackjack', () => {
    expect(resolveOutcome([card('7'), card('7'), card('7')], [card('K'), card('9')])).toBe(
      'player-win',
    );
  });
});
