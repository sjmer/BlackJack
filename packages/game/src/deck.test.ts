import { describe, expect, it } from 'vitest';
import { createDeck, drawCard, drawMany, shuffleDeck } from './deck';

describe('deck', () => {
  it('creates a complete 52-card deck with unique cards', () => {
    const deck = createDeck();

    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((card) => card.id)).size).toBe(52);
    expect(new Set(deck.map((card) => card.suit)).size).toBe(4);
    expect(new Set(deck.map((card) => card.rank)).size).toBe(13);
  });

  it('shuffles without mutating or losing cards', () => {
    const deck = createDeck();
    const original = deck.map((card) => card.id);
    const shuffled = shuffleDeck(deck, () => 0.37);

    expect(deck.map((card) => card.id)).toEqual(original);
    expect(shuffled.map((card) => card.id).sort()).toEqual([...original].sort());
    expect(shuffled.map((card) => card.id)).not.toEqual(original);
  });

  it('draws from the top and returns the rest', () => {
    const deck = createDeck();
    const top = deck[0];
    const result = drawCard(deck);

    expect(result.card).toEqual(top);
    expect(result.deck).toHaveLength(51);
    expect(result.deck).not.toContainEqual(top);
  });

  it('draws multiple cards and throws on an empty deck', () => {
    const deck = createDeck();
    const result = drawMany(deck, 5);

    expect(result.cards).toHaveLength(5);
    expect(result.deck).toHaveLength(47);
    expect(() => drawCard([])).toThrow('The deck is empty.');
  });
});
