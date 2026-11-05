import { useEffect, useRef, useState } from 'react';
import type { Phase, Stats } from '@bj/game';
import { totalRounds } from '@bj/game';

interface StatsPanelProps {
  stats: Stats;
  roundId: number;
  phase: Phase;
  onReset: () => void;
}

export function StatsPanel({ stats, roundId, phase, onReset }: StatsPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const rounds = totalRounds(stats);
  const displayedRounds = Math.max(rounds, roundId);
  const hasRecord = rounds > 0 || stats.bestStreak > 0;
  const handInProgress =
    phase === 'dealing' || phase === 'player-turn' || phase === 'dealer-turn';
  const canReset = hasRecord && !handInProgress;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (confirmOpen && !dialog.open) {
      dialog.showModal();
      cancelButtonRef.current?.focus();
    } else if (!confirmOpen && dialog.open) {
      dialog.close();
    }
  }, [confirmOpen]);

  useEffect(() => {
    if (!confirmOpen) {
      return;
    }

    const button = resetButtonRef.current;
    return () => button?.focus();
  }, [confirmOpen]);

  const requestReset = () => {
    if (!canReset) {
      return;
    }

    setConfirmOpen(true);
  };

  const confirmReset = () => {
    onReset();
    setConfirmOpen(false);
  };

  const roundLabel =
    phase === 'ready' || roundId === 0 ? '等待开局' : `第 ${String(roundId).padStart(2, '0')} 局`;

  return (
    <>
      <aside className="side-panel stats-panel" aria-labelledby="stats-title">
        <div className="side-panel__head">
          <div>
            <span className="panel-eyebrow">LEDGER</span>
            <h2 className="panel-title" id="stats-title">
              战绩
            </h2>
          </div>
          <span className="stats-panel__round">{roundLabel}</span>
        </div>

        <div className="stats-grid">
          <div className="stat-tile stat-tile--win">
            <span className="stat-tile__label">胜</span>
            <strong className="stat-tile__value">{stats.wins}</strong>
            <span className="stat-tile__en">WINS</span>
          </div>
          <div className="stat-tile stat-tile--loss">
            <span className="stat-tile__label">负</span>
            <strong className="stat-tile__value">{stats.losses}</strong>
            <span className="stat-tile__en">LOSSES</span>
          </div>
          <div className="stat-tile stat-tile--push">
            <span className="stat-tile__label">和</span>
            <strong className="stat-tile__value">{stats.pushes}</strong>
            <span className="stat-tile__en">PUSHES</span>
          </div>
        </div>

        <div className="streak-card">
          <div className="streak-card__main">
            <span className="streak-card__label">当前连胜</span>
            <strong>{stats.streak}</strong>
          </div>
          <div className="streak-card__best">
            <span>BEST</span>
            <b>{String(stats.bestStreak).padStart(2, '0')}</b>
          </div>
          <span className="streak-card__spark" aria-hidden="true">
            ✦
          </span>
        </div>

        <p className="stats-panel__note">连胜会被失败或和局打断。战绩保存在本机浏览器。</p>

        <div className="stats-panel__footer">
          <span>共 {displayedRounds} 局</span>
          <button
            ref={resetButtonRef}
            type="button"
            className="text-button"
            onClick={requestReset}
            disabled={!canReset}
            title={
              handInProgress ? '本局结束后才能清空战绩' : hasRecord ? '清空全部战绩' : undefined
            }
          >
            {handInProgress && hasRecord ? '本局结束后可清空' : '清空战绩'}
          </button>
        </div>
      </aside>

      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby="confirm-reset-title"
        aria-describedby="confirm-reset-note"
        onCancel={(event) => {
          event.preventDefault();
          setConfirmOpen(false);
        }}
        onClose={() => setConfirmOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setConfirmOpen(false);
          }
        }}
      >
        <div className="confirm-dialog__body">
          <span className="panel-eyebrow">CLEAR LEDGER</span>
          <h2 id="confirm-reset-title">清空全部战绩？</h2>
          <p id="confirm-reset-note">清空后，本机保存的战绩会全部归零，且无法恢复。</p>
          <div className="confirm-dialog__actions">
            <button
              ref={cancelButtonRef}
              type="button"
              className="confirm-dialog__cancel"
              onClick={() => setConfirmOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="confirm-dialog__danger"
              onClick={confirmReset}
            >
              清空
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
