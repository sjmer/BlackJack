import { RANKS, SUITS, type Card } from './types';

export type RandomSource = () => number;

/**
 * The default random source uses the browser crypto API. It falls back to
 * Math.random only in environments without Web Crypto (for example an older
 * test runner), so the game still works everywhere.
 */
export function secureRandom(): number {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] / 4_294_967_296;
  }

  return Math.random();
}

export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
      });
    }
  }

  return deck;
}

/** Returns a shuffled copy while leaving the input deck untouched. */
export function shuffleDeck(deck: readonly Card[], random: RandomSource = secureRandom): Card[] {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function drawCard(deck: readonly Card[]): { card: Card; deck: Card[] } {
  const [card, ...rest] = deck;

  if (!card) {
    throw new Error('The deck is empty.');
  }

  return { card, deck: rest };
}

export function drawMany(deck: readonly Card[], count: number): { cards: Card[]; deck: Card[] } {
  let remaining = [...deck];
  const cards: Card[] = [];

  for (let i = 0; i < count; i += 1) {
    const result = drawCard(remaining);
    cards.push(result.card);
    remaining = result.deck;
  }

  return { cards, deck: remaining };
}
