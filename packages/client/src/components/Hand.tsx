import type { CSSProperties } from 'react';
import { isBlackjack } from '@bj/game';
import type { Card, HandValue } from '@bj/game';
import { PlayingCard } from './PlayingCard';

interface HandProps {
  side: 'dealer' | 'player';
  cards: Card[];
  value: HandValue;
  holeRevealed: boolean;
  active: boolean;
  /** CSS hook only (data-phase); accepts offline and online phase names. */
  phase: string;
  label?: string;
}

interface HandStyle extends CSSProperties {
  '--card-count': number;
  '--hand-overlap-factor': number;
}

function EmptySlots() {
  return (
    <>
      <span className="card-slot" aria-hidden="true" />
      <span className="card-slot" aria-hidden="true" />
    </>
  );
}

export function Hand({
  side,
  cards,
  value,
  holeRevealed,
  active,
  phase,
  label,
}: HandProps) {
  const isDealer = side === 'dealer';
  const hasCards = cards.length > 0;
  const natural = isBlackjack(cards) && (!isDealer || holeRevealed);
  const hiddenTotal = isDealer && !holeRevealed && hasCards;
  const overlapFactor =
    cards.length > 4 ? Math.min(0.72, (cards.length - 4) * 0.16) : 0;
  const style: HandStyle = {
    '--card-count': cards.length,
    '--hand-overlap-factor': overlapFactor,
  };
  const title = label ?? (isDealer ? '庄家' : '玩家');
  const overline = isDealer ? 'DEALER' : 'PLAYER';
  const totalLabel = !hasCards
    ? '—'
    : hiddenTotal
      ? '?'
      : `${value.total}`;
  const isBust = !hiddenTotal && value.isBust && hasCards;

  return (
    <section
      className={`hand hand--${side}${active ? ' is-active' : ''}${isBust ? ' is-bust' : ''}`}
      aria-label={`${title}手牌`}
    >
      <div className="hand__meta">
        <div className="hand__identity">
          <span className="hand__overline">{overline}</span>
          <div className="hand__name-row">
            <h2 className="hand__name">{title}</h2>
            {natural && <span className="hand__natural">BLACKJACK</span>}
            {active && (
              <span className="hand__live">
                <span className="hand__live-dot" />
                YOUR TURN
              </span>
            )}
          </div>
        </div>
        {hasCards && (
          <div
            className={`hand__total${hiddenTotal ? ' is-hidden' : ''}${isBust ? ' is-bust' : ''}`}
            aria-label={
              hiddenTotal
                ? '庄家有一张暗牌，点数未知'
                : `${title}点数 ${value.total}${value.isSoft ? '，软牌' : ''}`
            }
          >
            <span className="hand__total-label">TOTAL</span>
            <strong className="hand__total-value">{totalLabel}</strong>
            {!hiddenTotal && value.isSoft && (
              <span className="hand__soft" title="软牌：A 正在按 11 点计算">
                软
              </span>
            )}
          </div>
        )}
      </div>

      <div
        className={`hand__cards${active ? ' is-active' : ''}`}
        style={style}
        data-phase={phase}
      >
        {!hasCards && <EmptySlots />}
        {cards.map((card, index) => {
          const faceDown = isDealer && !holeRevealed && index === 1;
          const middle = (cards.length - 1) / 2;
          const tilt = Math.max(-2.4, Math.min(2.4, (index - middle) * 1.1));

          return (
            <PlayingCard
              key={card.id}
              card={card}
              faceDown={faceDown}
              index={index}
              tilt={tilt}
            />
          );
        })}
      </div>
    </section>
  );
}
