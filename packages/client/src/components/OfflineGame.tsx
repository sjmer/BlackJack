import { useEffect, useState } from 'react';
import { ActionBar } from './ActionBar';
import { GameTable } from './GameTable';
import { RulesDialog } from './RulesDialog';
import { StatsPanel } from './StatsPanel';
import { TopBar } from './TopBar';
import { getOutcomeCopy } from '../ui/labels';
import { useBlackjackGame } from '../state/useBlackjackGame';

interface OfflineGameProps {
  onExit: () => void;
}

export function OfflineGame({ onExit }: OfflineGameProps) {
  const {
    state,
    playerValue,
    dealerValue,
    canStart,
    muted,
    startRound,
    hit,
    stand,
    resetStats,
    toggleMuted,
  } = useBlackjackGame();
  const [rulesOpen, setRulesOpen] = useState(false);

  const tone = state.outcome ? getOutcomeCopy(state.outcome).tone : null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (rulesOpen || document.querySelector('dialog[open]')) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (state.phase === 'player-turn' && key === 'h') {
        event.preventDefault();
        hit();
        return;
      }

      if (state.phase === 'player-turn' && key === 's') {
        event.preventDefault();
        stand();
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        setRulesOpen(true);
        return;
      }

      if (
        (state.phase === 'ready' || state.phase === 'round-over') &&
        event.key === 'Enter'
      ) {
        if (target instanceof HTMLElement && target.closest('button, a, [role="button"]')) {
          return;
        }

        event.preventDefault();
        startRound();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.phase, rulesOpen, hit, stand, startRound]);

  return (
    <div
      className={`app${tone ? ` is-${tone}` : ''}${state.phase === 'round-over' ? ' is-result' : ''}`}
    >
      <div className="app-bg" aria-hidden="true">
        <span className="app-bg__suit app-bg__suit--one">♠</span>
        <span className="app-bg__suit app-bg__suit--two">♦</span>
        <span className="app-bg__suit app-bg__suit--three">♣</span>
        <span className="app-bg__grain" />
      </div>

      <TopBar
        muted={muted}
        onToggleMuted={toggleMuted}
        onOpenRules={() => setRulesOpen(true)}
      />

      <div className="screen-exit">
        <button type="button" className="screen-exit__button" onClick={onExit}>
          ← 返回首页
        </button>
      </div>

      <main className="game-shell">
        <StatsPanel
          stats={state.stats}
          roundId={state.roundId}
          phase={state.phase}
          onReset={resetStats}
        />

        <div className="play-column">
          <GameTable state={state} playerValue={playerValue} dealerValue={dealerValue} />

          <ActionBar
            phase={state.phase}
            canStart={canStart}
            onStart={startRound}
            onHit={hit}
            onStand={stand}
          />
        </div>
      </main>

      <footer className="page-footer">
        <span>BLACKJACK 21</span>
        <i aria-hidden="true">✦</i>
        <span>庄家 16 要牌 · 17 停牌</span>
        <i aria-hidden="true">✦</i>
        <span>原创牌面 · 本机游戏</span>
      </footer>

      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
