export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface HandValue {
  total: number;
  isSoft: boolean;
  isBust: boolean;
}

export type Outcome =
  | 'player-blackjack'
  | 'dealer-blackjack'
  | 'player-bust'
  | 'dealer-bust'
  | 'player-win'
  | 'dealer-win'
  | 'push';

export interface Stats {
  wins: number;
  losses: number;
  pushes: number;
  streak: number;
  bestStreak: number;
}

export type Phase = 'ready' | 'dealing' | 'player-turn' | 'dealer-turn' | 'round-over';

export interface GameState {
  phase: Phase;
  roundId: number;
  deck: Card[];
  playerCards: Card[];
  dealerCards: Card[];
  holeRevealed: boolean;
  outcome: Outcome | null;
  stats: Stats;
}

export interface Settings {
  muted: boolean;
}

export const EMPTY_STATS: Stats = {
  wins: 0,
  losses: 0,
  pushes: 0,
  streak: 0,
  bestStreak: 0,
};

export const DEFAULT_SETTINGS: Settings = {
  muted: false,
};
