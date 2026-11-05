import type { GameState, HandValue } from '@bj/game';
import { getOutcomeCopy, phaseHint } from '../ui/labels';
import { DeckStack } from './DeckStack';
import { Hand } from './Hand';

interface GameTableProps {
  state: GameState;
  playerValue: HandValue;
  dealerValue: HandValue;
}

export function GameTable({ state, playerValue, dealerValue }: GameTableProps) {
  const { phase, roundId, outcome, holeRevealed } = state;
  const isResult = phase === 'round-over' && outcome !== null;
  const copy = isResult ? getOutcomeCopy(outcome) : null;
  const hint = phaseHint(phase);
  const tone = copy?.tone ?? null;
  const deckRemaining = phase === 'ready' ? 52 : state.deck.length;

  return (
    <section
      className={`game-table${isResult ? ` is-result is-${tone}` : ''} is-${phase}`}
      aria-label="21 点牌桌"
    >
      <div className="game-table__rail" aria-hidden="true">
        <span className="table-label">
          <i />
          TABLE 01
        </span>
        <span className="table-round">
          {roundId > 0 ? `HAND ${String(roundId).padStart(2, '0')}` : 'WAITING'} · HEADS UP
        </span>
      </div>

      <span className="table-corner table-corner--tl" aria-hidden="true">
        ✦
      </span>
      <span className="table-corner table-corner--tr" aria-hidden="true">
        ✦
      </span>
      <span className="table-corner table-corner--bl" aria-hidden="true">
        ✦
      </span>
      <span className="table-corner table-corner--br" aria-hidden="true">
        ✦
      </span>

      <Hand
        side="dealer"
        cards={state.dealerCards}
        value={dealerValue}
        holeRevealed={holeRevealed}
        active={false}
        phase={phase}
      />

      <div className="table-center">
        <DeckStack remaining={deckRemaining} />

        <div className="table-center__rune" aria-hidden="true">
          <span>♦</span>
          <i />
        </div>

        <div
          className={`table-center__content${isResult ? ' has-result' : ''}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {isResult && copy ? (
            <div className={`result-stamp result-stamp--${copy.tone}`}>
              <span className="result-stamp__kicker">{copy.kicker}</span>
              <strong className="result-stamp__title">{copy.title}</strong>
              <span className="result-stamp__subtitle">{copy.subtitle}</span>
              <div className="result-stamp__score" aria-label="本局点数">
                <span>
                  <small>你</small>
                  <b>{playerValue.total}</b>
                </span>
                <i aria-hidden="true">:</i>
                <span>
                  <small>庄家</small>
                  <b>{dealerValue.total}</b>
                </span>
              </div>
            </div>
          ) : phase === 'ready' ? (
            <div className="ready-seal">
              <span className="ready-seal__eyebrow">READY TO DEAL</span>
              <strong className="ready-seal__number">21</strong>
              <span className="ready-seal__sub">一副牌 · 一场对局</span>
              <span className="ready-seal__rule">16 要牌 / 17 停牌</span>
            </div>
          ) : (
            <div className="table-status">
              <span className="table-status__en">{hint.en}</span>
              <strong className="table-status__zh">{hint.zh}</strong>
              <span className="table-status__detail">
                {phase === 'player-turn'
                  ? 'H 要牌 · S 停牌'
                  : phase === 'dealer-turn'
                    ? '庄家补牌至 17 点'
                    : 'SHUFFLE · CUT · DEAL'}
              </span>
              {(phase === 'dealing' || phase === 'dealer-turn') && (
                <span className="table-status__dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <Hand
        side="player"
        cards={state.playerCards}
        value={playerValue}
        holeRevealed
        active={phase === 'player-turn'}
        phase={phase}
      />

      <div className="game-table__foot" aria-hidden="true">
        <span>♠</span>
        <i />
        <span>BLACKJACK 21</span>
        <i />
        <span>♦</span>
      </div>
    </section>
  );
}
