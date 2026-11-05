import type { CSSProperties } from 'react';
import { isRedSuit } from '@bj/game';
import type { Card } from '@bj/game';
import { cardAriaLabel } from '../ui/labels';
import { CardBack } from './CardBack';
import { CourtArt } from './CourtArt';
import { SuitIcon } from './SuitIcon';

type NumberRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';
type Pip = readonly [x: number, y: number, flip?: boolean];

const PIP_LAYOUTS: Record<NumberRank, readonly Pip[]> = {
  '2': [
    [50, 19],
    [50, 81, true],
  ],
  '3': [
    [50, 19],
    [50, 50],
    [50, 81, true],
  ],
  '4': [
    [31, 19],
    [69, 19],
    [31, 81, true],
    [69, 81, true],
  ],
  '5': [
    [31, 19],
    [69, 19],
    [50, 50],
    [31, 81, true],
    [69, 81, true],
  ],
  '6': [
    [31, 19],
    [69, 19],
    [31, 50],
    [69, 50],
    [31, 81, true],
    [69, 81, true],
  ],
  '7': [
    [31, 18],
    [69, 18],
    [50, 34],
    [31, 50],
    [69, 50],
    [31, 82, true],
    [69, 82, true],
  ],
  '8': [
    [31, 17],
    [69, 17],
    [50, 30],
    [31, 44],
    [69, 44],
    [50, 58, true],
    [31, 83, true],
    [69, 83, true],
  ],
  '9': [
    [31, 15],
    [69, 15],
    [31, 38],
    [69, 38],
    [50, 50],
    [31, 62, true],
    [69, 62, true],
    [31, 85, true],
    [69, 85, true],
  ],
  '10': [
    [31, 14],
    [69, 14],
    [50, 28],
    [31, 37],
    [69, 37],
    [31, 63, true],
    [69, 63, true],
    [50, 72, true],
    [31, 86, true],
    [69, 86, true],
  ],
};

interface PlayingCardProps {
  card: Card;
  faceDown?: boolean;
  /** Accessible label for the face-down card (defaults to the dealer's hole card). */
  backLabel?: string;
  index?: number;
  tilt?: number;
}

interface CardStyle extends CSSProperties {
  '--card-index': number;
  '--card-rotate': string;
  '--card-delay': string;
}

function CardCorner({ rank, suit }: { rank: Card['rank']; suit: Card['suit'] }) {
  return (
    <span className={`card-corner ${rank === '10' ? 'card-corner--ten' : ''}`}>
      <span className="card-corner__rank">{rank}</span>
      <SuitIcon suit={suit} className="card-corner__suit" />
    </span>
  );
}

function CardFace({ card }: { card: Card }) {
  const courtRank =
    card.rank === 'J' || card.rank === 'Q' || card.rank === 'K' ? card.rank : null;
  const isFace = courtRank !== null;
  const isNumber = card.rank !== 'A' && !isFace;

  return (
    <div className="card-face">
      <CardCorner rank={card.rank} suit={card.suit} />
      <div className="card-center">
        {card.rank === 'A' && (
          <div className="ace-art">
            <span className="ace-art__halo" />
            <SuitIcon suit={card.suit} className="ace-art__suit" />
            <span className="ace-art__word">ACE</span>
          </div>
        )}
        {courtRank && <CourtArt rank={courtRank} suit={card.suit} />}
        {isNumber && (
          <div className="pip-field" aria-hidden="true">
            {PIP_LAYOUTS[card.rank as NumberRank].map(([x, y, flip], index) => (
              <span
                className="card-pip"
                key={`${x}-${y}-${index}`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%, -50%)${flip ? ' rotate(180deg)' : ''}`,
                }}
              >
                <SuitIcon suit={card.suit} />
              </span>
            ))}
          </div>
        )}
      </div>
      <span
        className={`card-corner card-corner--bottom${card.rank === '10' ? ' card-corner--ten' : ''}`}
        aria-hidden="true"
      >
        <span className="card-corner__rank">{card.rank}</span>
        <SuitIcon suit={card.suit} className="card-corner__suit" />
      </span>
      <span className="card-face__rule" aria-hidden="true" />
    </div>
  );
}

export function PlayingCard({ card, faceDown = false, backLabel, index = 0, tilt = 0 }: PlayingCardProps) {
  const red = !faceDown && isRedSuit(card);
  const style: CardStyle = {
    '--card-index': index,
    '--card-rotate': `${tilt}deg`,
    '--card-delay': `${Math.min(index, 3) * 65}ms`,
    zIndex: index + 1,
  };

  return (
    <div
      className={`playing-card${faceDown ? ' is-face-down' : ''}${red ? ' is-red' : ''}`}
      style={style}
      role="img"
      aria-label={faceDown ? backLabel ?? '庄家的暗牌' : cardAriaLabel(card.rank, card.suit)}
    >
      <div className="playing-card__inner">
        <div className="playing-card__side playing-card__front" aria-hidden="true">
          {!faceDown && <CardFace card={card} />}
        </div>
        <div className="playing-card__side playing-card__back" aria-hidden="true">
          <CardBack />
        </div>
      </div>
    </div>
  );
}
