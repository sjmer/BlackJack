import type { Outcome, Suit } from '@bj/game';

export const SUIT_META: Record<
  Suit,
  { symbol: string; name: string; color: 'red' | 'black' }
> = {
  spades: { symbol: '♠', name: '黑桃', color: 'black' },
  hearts: { symbol: '♥', name: '红桃', color: 'red' },
  diamonds: { symbol: '♦', name: '方块', color: 'red' },
  clubs: { symbol: '♣', name: '梅花', color: 'black' },
};

export function cardAriaLabel(rank: string, suit: Suit): string {
  return `${SUIT_META[suit].name}${rank}`;
}

export interface OutcomeCopy {
  kicker: string;
  title: string;
  subtitle: string;
  tone: 'win' | 'loss' | 'push';
}

export function getOutcomeCopy(outcome: Outcome): OutcomeCopy {
  switch (outcome) {
    case 'player-blackjack':
      return {
        kicker: 'NATURAL 21',
        title: 'BLACKJACK!',
        subtitle: '天牌获胜',
        tone: 'win',
      };
    case 'dealer-blackjack':
      return {
        kicker: 'DEALER NATURAL',
        title: '庄家天牌',
        subtitle: '这局被庄家抢了先手',
        tone: 'loss',
      };
    case 'player-bust':
      return {
        kicker: 'BUST',
        title: '爆牌了',
        subtitle: '超过 21 点，庄家胜',
        tone: 'loss',
      };
    case 'dealer-bust':
      return {
        kicker: 'DEALER BUST',
        title: '庄家爆牌',
        subtitle: '稳住就能赢，这局归你',
        tone: 'win',
      };
    case 'player-win':
      return {
        kicker: 'PLAYER WINS',
        title: '你赢了',
        subtitle: '点数压过庄家',
        tone: 'win',
      };
    case 'dealer-win':
      return {
        kicker: 'DEALER WINS',
        title: '庄家胜',
        subtitle: '下一局再扳回来',
        tone: 'loss',
      };
    case 'push':
      return {
        kicker: 'PUSH',
        title: '平局',
        subtitle: '点数相同，谁也没占到便宜',
        tone: 'push',
      };
  }
}

export function phaseHint(phase: 'ready' | 'dealing' | 'player-turn' | 'dealer-turn' | 'round-over'): {
  zh: string;
  en: string;
} {
  switch (phase) {
    case 'ready':
      return { zh: '牌桌已就绪', en: 'PLACE YOUR NERVE' };
    case 'dealing':
      return { zh: '发牌中…', en: 'DEALING' };
    case 'player-turn':
      return { zh: '要牌，还是停牌？', en: 'YOUR MOVE' };
    case 'dealer-turn':
      return { zh: '庄家行动中…', en: 'DEALER PLAYING' };
    case 'round-over':
      return { zh: '本局结束', en: 'HAND COMPLETE' };
  }
}
