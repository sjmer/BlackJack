import type { Phase } from '@bj/game';

interface ActionBarProps {
  phase: Phase;
  canStart: boolean;
  onStart: () => void;
  onHit: () => void;
  onStand: () => void;
}

/**
 * Primary controls live directly under the table, centred in the play column,
 * so the player never has to travel to a far-right panel mid-hand.
 */
export function ActionBar({ phase, canStart, onStart, onHit, onStand }: ActionBarProps) {
  const active = phase === 'player-turn';
  const done = phase === 'round-over';

  return (
    <section
      className={`action-dock${active ? ' is-active' : ''}`}
      aria-label="牌局操作"
      aria-live="polite"
    >
      <div className="action-dock__buttons">
        {(phase === 'ready' || done) && canStart && (
          <button type="button" className="game-button game-button--primary" onClick={onStart}>
            <span className="game-button__copy">
              <strong>{phase === 'ready' ? '开始牌局' : '再来一局'}</strong>
              <small>{phase === 'ready' ? 'DEAL ME IN' : 'NEXT HAND'}</small>
            </span>
            <kbd>Enter</kbd>
          </button>
        )}

        {active && (
          <>
            <button
              type="button"
              className="game-button game-button--hit"
              onClick={onHit}
              title="要牌：再拿一张牌"
            >
              <span className="game-button__glyph" aria-hidden="true">
                +
              </span>
              <span className="game-button__copy">
                <strong>要牌</strong>
                <small>HIT</small>
              </span>
              <kbd>H</kbd>
            </button>
            <button
              type="button"
              className="game-button game-button--stand"
              onClick={onStand}
              title="停牌：不再要牌，把回合交给庄家"
            >
              <span className="game-button__glyph" aria-hidden="true">
                ■
              </span>
              <span className="game-button__copy">
                <strong>停牌</strong>
                <small>STAND</small>
              </span>
              <kbd>S</kbd>
            </button>
          </>
        )}

        {(phase === 'dealing' || phase === 'dealer-turn') && (
          <button type="button" className="game-button game-button--pending" disabled>
            <span className="waiting-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="game-button__copy">
              <strong>{phase === 'dealing' ? '发牌中' : '庄家行动中'}</strong>
              <small>{phase === 'dealing' ? 'DEALING' : 'DEALER PLAYING'}</small>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
