import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BASE_ANTE,
  HIDDEN_CARD,
  INITIAL_CHIPS,
  MIN_DUEL_PLAYERS,
  duelRank,
  isBlackjack,
  isFiveCardCharlie,
} from '@bj/game';
import type { DuelOutcome, SeatView, Settings, TableView } from '@bj/game';
import type { OnlineGameApi } from '../net/useOnlineGame';
import { useSound, type SoundName } from '../hooks/useSound';
import { loadSettings, recordOnlineCareerRound, saveSettings } from '../state/storage';
import { ChatPanel } from './ChatPanel';
import { OnlineRulesDialog } from './OnlineRulesDialog';
import { PlayingCard } from './PlayingCard';

interface OnlineGameProps {
  game: OnlineGameApi;
  onExit: () => void;
}

const DUEL_COPY: Record<DuelOutcome, { title: string; tone: 'win' | 'loss' | 'push' }> = {
  win: { title: '胜', tone: 'win' },
  loss: { title: '负', tone: 'loss' },
  push: { title: '平', tone: 'push' },
};

function outcomeSound(you: SeatView): SoundName {
  if (you.outcome === 'push') {
    return 'push';
  }

  if (you.outcome === 'win') {
    return isBlackjack(you.cards) || isFiveCardCharlie(you.cards) ? 'blackjack' : 'win';
  }

  return you.value.isBust ? 'bust' : 'lose';
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M5 9v6h3.5l4.5 4V5L8.5 9H5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      {muted ? (
        <path
          d="m16.2 9.2 4.6 5.6m0-5.6-4.6 5.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : (
        <>
          <path
            d="M16 8.5c1.7 1.8 1.7 5.2 0 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M18.7 6c3 3.2 3 8.8 0 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            opacity="0.65"
          />
        </>
      )}
    </svg>
  );
}

interface SeatCardsStyle extends React.CSSProperties {
  '--seat-overlap-factor': number;
}

interface TimerBarStyle extends React.CSSProperties {
  '--timer-ms': string;
}

interface SeatTileProps {
  seat: SeatView;
  phase: TableView['phase'];
  roundId: number;
  holeRevealed: boolean;
  isTurn: boolean;
  isFirstActor: boolean;
  isLeader: boolean;
  turnDurationMs: number | null;
  bubbleText: string | null;
  /** Viewer is the acting host: show the kick control on other seats. */
  showKick: boolean;
  onKick: () => void;
}

function SeatTile({
  seat,
  phase,
  roundId,
  holeRevealed,
  isTurn,
  isFirstActor,
  isLeader,
  turnDurationMs,
  bubbleText,
  showKick,
  onKick,
}: SeatTileProps) {
  const inHand = seat.cards.length > 0;
  const copy = seat.outcome ? DUEL_COPY[seat.outcome] : null;
  const empty = !seat.occupied && !seat.isGhost;
  const waitingBust = inHand && !copy && seat.value.isBust;
  const kickable = showKick && seat.occupied && !seat.isYou;

  // Two-step confirmation without a modal: the first click arms the button,
  // the second within 2.5s actually kicks.
  const [kickArmed, setKickArmed] = useState(false);
  const kickArmTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (kickArmTimer.current !== null) {
        window.clearTimeout(kickArmTimer.current);
      }
    },
    [],
  );

  const handleKickClick = () => {
    if (!kickArmed) {
      setKickArmed(true);
      kickArmTimer.current = window.setTimeout(() => setKickArmed(false), 2500);
      return;
    }

    if (kickArmTimer.current !== null) {
      window.clearTimeout(kickArmTimer.current);
    }

    setKickArmed(false);
    onKick();
  };

  // Fan overlapping: once the row would outgrow the tile, each extra card
  // tucks under more of its neighbour.
  const count = seat.cards.length;
  const overlapFactor = count > 2 ? Math.min(0.72, (count - 2) * 0.22) : 0;
  const cardsStyle: SeatCardsStyle = {
    '--seat-overlap-factor': overlapFactor,
  };

  const timerStyle: TimerBarStyle | undefined =
    isTurn && turnDurationMs
      ? { '--timer-ms': `${turnDurationMs}ms` }
      : undefined;

  return (
    <div
      className={`seat-tile${isTurn ? ' is-turn' : ''}${seat.isYou ? ' is-you' : ''}${
        empty ? ' is-empty' : ''
      }${copy ? ` is-${copy.tone}` : ''}`}
      data-phase={phase}
    >
      {bubbleText && (
        <div className="seat-tile__bubble" role="status" aria-live="polite">
          <span>{bubbleText}</span>
        </div>
      )}

      {isTurn && turnDurationMs && (
        <div
          key={`${roundId}-${seat.seatIndex}-${turnDurationMs}`}
          className="seat-tile__timer"
          style={timerStyle}
          aria-hidden="true"
        >
          <span className="seat-tile__timer-fill" />
        </div>
      )}

      <div className="seat-tile__head">
        <span className="seat-tile__index">SEAT {seat.seatIndex + 1}</span>
        {empty ? (
          <span className="seat-tile__name seat-tile__name--empty">虚位以待</span>
        ) : (
          <span className="seat-tile__name">
            {isLeader && (
              <i className="seat-crown" title="桌王 · 筹码领先">
                👑
              </i>
            )}
            {seat.name}
            {seat.isYou && <b className="seat-tile__you">YOU</b>}
          </span>
        )}
        <span className="seat-tile__badges">
          {seat.isHost && <i className="seat-badge seat-badge--host">房主</i>}
          {!empty && isFirstActor && phase !== 'lobby' && (
            <i className="seat-badge seat-badge--first" title="本局先手行动">
              先手
            </i>
          )}
          {!empty && seat.stats.streak >= 2 && (
            <i className="seat-badge seat-badge--streak">🔥{seat.stats.streak}连胜</i>
          )}
          {seat.doubled && <i className="seat-badge seat-badge--double">×2加倍</i>}
          {seat.isGhost && <i className="seat-badge seat-badge--ghost">已离开</i>}
          {!seat.isGhost && !seat.connected && !empty && (
            <i className="seat-badge seat-badge--offline">离线</i>
          )}
          {(phase === 'lobby' || phase === 'round-over') && !empty && seat.ready && (
            <i className="seat-badge seat-badge--ready">READY</i>
          )}
          {waitingBust && <i className="seat-badge seat-badge--bust">已爆牌</i>}
          {isTurn && !waitingBust && <i className="seat-badge seat-badge--turn">行动中</i>}
        </span>
        {kickable && (
          <button
            type="button"
            className={`seat-tile__kick${kickArmed ? ' is-armed' : ''}`}
            onClick={handleKickClick}
            aria-label={kickArmed ? `再次点击确认移出 ${seat.name}` : `移出玩家 ${seat.name}`}
          >
            {kickArmed ? '确认移出?' : '✕'}
          </button>
        )}
      </div>

      {!empty && (
        <div className="seat-tile__chips-row">
          <span className="seat-chip-balance" title="当前筹码">
            <i aria-hidden="true">🪙</i> {seat.chips}
          </span>
          {inHand && seat.bet > 0 && phase !== 'round-over' && (
            <span className={`seat-chip-bet${seat.doubled ? ' is-doubled' : ''}`}>
              底注 {seat.bet}
            </span>
          )}
          {phase === 'round-over' && seat.chipDelta !== null && (
            <span
              className={`seat-chip-delta ${
                seat.chipDelta > 0 ? 'is-pos' : seat.chipDelta < 0 ? 'is-neg' : 'is-even'
              }`}
            >
              {seat.chipDelta > 0 ? `+${seat.chipDelta}` : seat.chipDelta === 0 ? '±0' : seat.chipDelta}
            </span>
          )}
          {seat.rebuyCount > 0 && (
            <span className="seat-chip-rebuy" title="已触发破产保护补助次数">
              补助×{seat.rebuyCount}
            </span>
          )}
        </div>
      )}

      <div className="seat-tile__cards" style={cardsStyle}>
        {inHand
          ? seat.cards.map((card, index) => {
              const isOwnHiddenCard =
                seat.isYou && !holeRevealed && index === seat.cards.length - 1;

              return (
                <div key={card.id} className="seat-card-slot">
                  <PlayingCard
                    card={card}
                    faceDown={card.id === HIDDEN_CARD.id}
                    backLabel="对手的暗牌"
                    index={index}
                    tilt={index % 2 === 0 ? -1.4 : 1.4}
                  />
                  {isOwnHiddenCard && (
                    <span className="seat-card__hole-tag" title="对手看不见你最新摸到的这张暗牌">
                      暗牌
                    </span>
                  )}
                </div>
              );
            })
          : !empty && <span className="seat-tile__waiting">等待开局</span>}
      </div>

      {inHand ? (
        <div className={`seat-tile__foot${seat.value.isBust ? ' is-bust' : ''}`}>
          {seat.natural && <i className="seat-tile__natural">BLACKJACK</i>}
          {!seat.natural && seat.charlie && <i className="seat-tile__charlie">五小龙</i>}
          <strong className="seat-tile__total">
            {seat.value.total}
            {seat.value.isSoft && !seat.value.isBust ? '*' : ''}
          </strong>
          {seat.hiddenCount > 0 && (
            <i className="seat-tile__unknown" title="有 1 张暗牌未公开">
              +?
            </i>
          )}
          <span className="seat-tile__wld">
            {seat.stats.wins}胜 {seat.stats.losses}负 {seat.stats.pushes}平
          </span>
          {copy && <i className={`seat-tile__outcome seat-tile__outcome--${copy.tone}`}>{copy.title}</i>}
        </div>
      ) : (
        !empty && (
          <div className="seat-tile__foot seat-tile__foot--lobby">
            <span className="seat-tile__wld">
              战绩 {seat.stats.wins}胜 {seat.stats.losses}负 {seat.stats.pushes}平
            </span>
          </div>
        )
      )}
    </div>
  );
}

/**
 * Fixed-height (42px) top strip inside the table: shows concise round status
 * during play and switches in-place to the single-row showdown scoreboard at
 * round-over, guaranteeing zero vertical layout shift for the seats below.
 */
function DuelBoard({ view }: { view: TableView }) {
  const dealt = view.seats.filter((seat) => seat.cards.length > 0);

  if (view.phase !== 'round-over' || dealt.length === 0) {
    const turnName = view.turnSeat !== null ? view.seats[view.turnSeat]?.name ?? '' : '';
    const statusText =
      view.phase === 'lobby'
        ? '等待开局'
        : view.phase === 'dealing'
          ? '发牌中'
          : `轮到 ${turnName}`;

    return (
      <section className="duel-strip" aria-label="牌局状态">
        <div className="duel-strip__status">
          <span className="duel-strip__badge">
            {view.roundId > 0 ? `ROUND ${String(view.roundId).padStart(2, '0')}` : 'LOBBY'}
          </span>
          <strong className="duel-strip__headline">{statusText}</strong>
        </div>
        <div className="duel-strip__meta">
          <span>底注 {BASE_ANTE}</span>
          <span>余牌 {view.phase === 'lobby' ? 52 : view.deckRemaining}</span>
        </div>
      </section>
    );
  }

  const ranked = [...dealt].sort((a, b) => duelRank(b.cards) - duelRank(a.cards));
  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${ranked.length}, minmax(0, 1fr))`,
  };

  return (
    <section className="duel-strip duel-strip--result" aria-label="本局结算">
      <span className="duel-strip__badge duel-strip__badge--result">本局结算</span>
      <ol className="duel-strip__pills" style={gridStyle}>
        {ranked.map((seat, index) => {
          const copy = DUEL_COPY[seat.outcome ?? 'push'];
          const handTag = seat.value.isBust
            ? `爆${seat.value.total}`
            : isBlackjack(seat.cards)
              ? 'BJ'
              : isFiveCardCharlie(seat.cards)
                ? '五小龙'
                : `${seat.value.total}点`;

          return (
            <li
              key={seat.seatIndex}
              className={`duel-strip__pill is-${copy.tone}${seat.isYou ? ' is-you' : ''}`}
            >
              <span className="duel-strip__who">
                <b className="duel-strip__rank">#{index + 1}</b>
                <span className="duel-strip__name">{seat.name}</span>
              </span>
              <span className="duel-strip__score">
                <span className={`duel-strip__tag${seat.value.isBust ? ' is-bust' : ''}`}>
                  {handTag}
                </span>
                {seat.chipDelta !== null && (
                  <b
                    className={`duel-strip__delta ${
                      seat.chipDelta > 0 ? 'is-pos' : seat.chipDelta < 0 ? 'is-neg' : ''
                    }`}
                  >
                    {seat.chipDelta > 0 ? `+${seat.chipDelta}` : seat.chipDelta === 0 ? '±0' : seat.chipDelta}
                  </b>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function OnlineActionBar({ view, game }: { view: TableView; game: OnlineGameApi }) {
  const you = view.seats.find((seat) => seat.isYou) ?? null;
  const yourTurn = view.phase === 'player-turn' && view.turnSeat !== null && you?.seatIndex === view.turnSeat;
  const turnPlayer = view.turnSeat !== null ? view.seats[view.turnSeat] : null;

  if (!you) {
    return (
      <section className="action-dock" aria-label="牌局操作">
        <button type="button" className="game-button game-button--pending" disabled>
          <span className="game-button__copy">
            <strong>观战中</strong>
            <small>SPECTATING</small>
          </span>
        </button>
      </section>
    );
  }

  if (view.phase === 'lobby' || view.phase === 'round-over') {
    const seatedCount = view.seats.filter((seat) => seat.occupied && seat.connected).length;
    const unreadyOthers = view.seats.filter(
      (seat) => seat.occupied && seat.connected && !seat.isYou && !seat.ready,
    ).length;

    const primaryLabel =
      seatedCount < MIN_DUEL_PLAYERS
        ? '等待玩家加入'
        : you.isHost
          ? unreadyOthers > 0
            ? '准备开局'
            : view.roundId > 0
              ? '开始下一局'
              : '开始对局'
          : '准备';

    const subLabel =
      seatedCount < MIN_DUEL_PLAYERS
        ? `WAITING · ${seatedCount}/${MIN_DUEL_PLAYERS}`
        : you.isHost
          ? 'START · ENTER'
          : 'READY · ENTER';

    return (
      <section className="action-dock" aria-label="牌局操作">
        <div className="action-dock__buttons">
          {you.ready ? (
            <>
              <button type="button" className="game-button game-button--pending" disabled>
                <span className="waiting-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="game-button__copy">
                  <strong>已准备</strong>
                  <small>READY</small>
                </span>
              </button>
              <button type="button" className="game-button" onClick={() => game.intent('unready')}>
                <span className="game-button__copy">
                  <strong>取消准备</strong>
                  <small>CANCEL</small>
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="game-button game-button--primary"
              onClick={() => game.intent('ready')}
            >
              <span className="game-button__copy">
                <strong>{primaryLabel}</strong>
                <small>{subLabel}</small>
              </span>
              <kbd>Enter</kbd>
            </button>
          )}
        </div>
      </section>
    );
  }

  if (view.phase === 'player-turn' && yourTurn) {
    return (
      <section className="action-dock is-active" aria-label="牌局操作">
        <div className="action-dock__buttons">
          <button
            type="button"
            className="game-button game-button--hit"
            onClick={() => game.intent('hit', { roundId: view.roundId })}
          >
            <span className="game-button__glyph" aria-hidden="true">+</span>
            <span className="game-button__copy">
              <strong>要牌</strong>
              <small>HIT</small>
            </span>
            <kbd>H</kbd>
          </button>
          {you.canDouble && (
            <button
              type="button"
              className="game-button game-button--double"
              onClick={() => game.intent('double', { roundId: view.roundId })}
              title={`追加 ${BASE_ANTE} 筹码，只摸 1 张牌并立即停牌`}
            >
              <span className="game-button__glyph" aria-hidden="true">×2</span>
              <span className="game-button__copy">
                <strong>加倍</strong>
                <small>DOUBLE +{BASE_ANTE}</small>
              </span>
              <kbd>D</kbd>
            </button>
          )}
          <button
            type="button"
            className="game-button game-button--stand"
            onClick={() => game.intent('stand', { roundId: view.roundId })}
          >
            <span className="game-button__glyph" aria-hidden="true">■</span>
            <span className="game-button__copy">
              <strong>停牌</strong>
              <small>STAND</small>
            </span>
            <kbd>S</kbd>
          </button>
        </div>
      </section>
    );
  }

  if (view.phase === 'player-turn') {
    return (
      <section className="action-dock" aria-label="牌局操作">
        <button type="button" className="game-button game-button--pending" disabled>
          <span className="waiting-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="game-button__copy">
            <strong>等待 {turnPlayer?.name ?? ''} 行动</strong>
            <small>WAITING</small>
          </span>
        </button>
      </section>
    );
  }

  return (
    <section className="action-dock" aria-label="牌局操作">
      <button type="button" className="game-button game-button--pending" disabled>
        <span className="waiting-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="game-button__copy">
          <strong>发牌中</strong>
          <small>DEALING</small>
        </span>
      </button>
    </section>
  );
}

export function OnlineGame({ game, onExit }: OnlineGameProps) {
  const { status, error, view, session, chat, intent, leave, kick, sendChat } = game;
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [seatBubbles, setSeatBubbles] = useState<Record<string, string>>({});
  const { play } = useSound(settings.muted);

  const lastSoundRef = useRef<{ roundId: number; outcome: DuelOutcome | null }>({ roundId: 0, outcome: null });
  const lastTurnRef = useRef<string>('');
  const lastPhaseRef = useRef<TableView['phase'] | null>(null);
  const lastCardCountRef = useRef<number>(0);
  const lastChatIdRef = useRef<string | null>(null);
  const bubbleTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(
    () => () => {
      for (const timer of bubbleTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      bubbleTimersRef.current.clear();
    },
    [],
  );

  // Live chat bubbles above seats when a player speaks.
  useEffect(() => {
    const latest = chat.at(-1);

    if (!game.chatReady || !latest) {
      lastChatIdRef.current = latest?.id ?? null;
      return;
    }

    if (latest.id === lastChatIdRef.current) {
      return;
    }

    lastChatIdRef.current = latest.id;

    if (latest.kind === 'player' && latest.playerId) {
      const pid = latest.playerId;
      const prevTimer = bubbleTimersRef.current.get(pid);
      if (prevTimer !== undefined) {
        window.clearTimeout(prevTimer);
      }

      setSeatBubbles((current) => ({ ...current, [pid]: latest.text }));
      play('click');

      const handle = window.setTimeout(() => {
        bubbleTimersRef.current.delete(pid);
        setSeatBubbles((current) => {
          const next = { ...current };
          delete next[pid];
          return next;
        });
      }, 3200);

      bubbleTimersRef.current.set(pid, handle);
    }
  }, [chat, game.chatReady, play]);

  const yourTurn =
    view?.phase === 'player-turn' && view.turnSeat !== null && view.turnSeat === view.yourSeatIndex;

  // Sound cues & career stats archiving.
  useEffect(() => {
    if (!view) {
      return;
    }

    const totalCards = view.seats.reduce((sum, s) => sum + s.cards.length, 0);

    if (view.phase === 'dealing' && lastPhaseRef.current !== 'dealing') {
      play('start');
    } else if (view.phase === 'player-turn' && totalCards > lastCardCountRef.current) {
      play('deal');
    }

    lastPhaseRef.current = view.phase;
    lastCardCountRef.current = totalCards;

    const you = view.seats.find((seat) => seat.isYou);

    if (
      view.phase === 'round-over' &&
      you?.outcome &&
      lastSoundRef.current.roundId !== view.roundId
    ) {
      lastSoundRef.current = { roundId: view.roundId, outcome: you.outcome };
      play(outcomeSound(you));
      recordOnlineCareerRound(you.outcome, you.chipDelta ?? 0);
    }

    const turnKey = yourTurn ? `${view.roundId}:${view.turnSeat}` : '';

    if (turnKey && turnKey !== lastTurnRef.current) {
      lastTurnRef.current = turnKey;
      play('flip');
    }
  }, [view, yourTurn, play]);

  // Keyboard shortcuts: H (Hit), S (Stand), D (Double), Enter (Ready), ? (Rules).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (rulesOpen || document.querySelector('dialog[open]')) {
        return;
      }

      const target = event.target;

      if (target instanceof HTMLElement && target.closest('input, textarea, select')) {
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        setRulesOpen(true);
        return;
      }

      if (!view) {
        return;
      }

      const you = view.seats.find((seat) => seat.isYou);
      const key = event.key.toLowerCase();

      if (yourTurn) {
        if (key === 'h') {
          event.preventDefault();
          intent('hit', { roundId: view.roundId });
        } else if (key === 's') {
          event.preventDefault();
          intent('stand', { roundId: view.roundId });
        } else if (key === 'd' && you?.canDouble) {
          event.preventDefault();
          intent('double', { roundId: view.roundId });
        }
        return;
      }

      if ((view.phase === 'lobby' || view.phase === 'round-over') && event.key === 'Enter') {
        if (target instanceof HTMLElement && target.closest('button, a, [role="button"]')) {
          return;
        }
        if (you && !you.ready) {
          event.preventDefault();
          intent('ready');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [yourTurn, view, rulesOpen, intent]);

  const copyRoomId = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      await navigator.clipboard.writeText(session.roomId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [session]);

  const handleLeave = useCallback(() => {
    intent('standUp');
    leave();
    onExit();
  }, [intent, leave, onExit]);

  const toggleMuted = useCallback(() => {
    setSettings((current) => ({ ...current, muted: !current.muted }));
  }, []);

  // Table leader: seat with the highest chips (> INITIAL_CHIPS) or most wins (> 0).
  const leaderSeatIndices = useMemo(() => {
    if (!view) {
      return new Set<number>();
    }
    const occupied = view.seats.filter((s) => s.occupied);
    if (occupied.length < 2) {
      return new Set<number>();
    }
    const maxChips = Math.max(...occupied.map((s) => s.chips));
    if (maxChips > INITIAL_CHIPS) {
      return new Set(occupied.filter((s) => s.chips === maxChips).map((s) => s.seatIndex));
    }
    const maxWins = Math.max(...occupied.map((s) => s.stats.wins));
    if (maxWins > 0) {
      return new Set(occupied.filter((s) => s.stats.wins === maxWins).map((s) => s.seatIndex));
    }
    return new Set<number>();
  }, [view]);

  if (status === 'connecting') {
    return (
      <div className="online-loading">
        <div className="online-loading__mark">21</div>
        <p className="online-loading__title">正在连接牌桌…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="online-loading">
        <div className="online-loading__mark online-loading__mark--error">!</div>
        <p className="online-loading__title">{error}</p>
        <button type="button" className="game-button game-button--primary" onClick={onExit}>
          <span className="game-button__copy">
            <strong>返回首页</strong>
            <small>BACK</small>
          </span>
        </button>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="online-loading">
        <div className="online-loading__mark">21</div>
        <p className="online-loading__title">等待房间数据…</p>
      </div>
    );
  }

  const you = view.seats.find((seat) => seat.isYou) ?? null;
  const youAreHost = view.seats.some((seat) => seat.isYou && seat.isHost);
  const tone = view.phase === 'round-over' && you?.outcome ? DUEL_COPY[you.outcome].tone : null;

  return (
    <div className={`online-room${tone ? ` is-${tone}` : ''} is-${view.phase}`}>
      <div className="app-bg" aria-hidden="true">
        <span className="app-bg__suit app-bg__suit--spade">♠</span>
        <span className="app-bg__suit app-bg__suit--heart">♥</span>
        <span className="app-bg__suit app-bg__suit--club">♣</span>
        <span className="app-bg__suit app-bg__suit--diamond">♦</span>
      </div>

      <header className="online-room__bar">
        <div className="online-room__brand">
          <span className="online-room__eyebrow">ONLINE DUEL</span>
          <strong className="online-room__code">{view.roomId}</strong>
          <button
            type="button"
            className="online-room__copy"
            onClick={copyRoomId}
            aria-label="复制房间码"
          >
            {copied ? '已复制 ✓' : '复制'}
          </button>
        </div>
        <div className="online-room__actions">
          <button
            type="button"
            className="icon-button"
            onClick={toggleMuted}
            aria-pressed={settings.muted}
            aria-label={settings.muted ? '打开音效' : '关闭音效'}
            title={settings.muted ? '打开音效' : '关闭音效'}
          >
            <SoundIcon muted={settings.muted} />
          </button>
          <button type="button" className="rules-button" onClick={() => setRulesOpen(true)}>
            <span className="rules-button__mark">?</span>
            <span>玩法</span>
          </button>
          <button type="button" className="online-room__exit" onClick={handleLeave}>
            退出房间
          </button>
        </div>
      </header>

      <div className="online-room__table">
        <div className="online-room__stage">
          <DuelBoard view={view} />

          <div className="online-room__seats">
            {view.seats.map((seat) => {
              // Find matching bubble by seat owner's session or name if known.
              const bubbleText =
                seat.isYou && session?.playerId
                  ? seatBubbles[session.playerId] ?? null
                  : chat
                      .slice()
                      .reverse()
                      .find((m) => m.kind === 'player' && m.name === seat.name && m.playerId && seatBubbles[m.playerId])
                    ? seatBubbles[
                        chat
                          .slice()
                          .reverse()
                          .find((m) => m.kind === 'player' && m.name === seat.name && m.playerId)!.playerId!
                      ] ?? null
                    : null;

              return (
                <SeatTile
                  key={seat.seatIndex}
                  seat={seat}
                  phase={view.phase}
                  roundId={view.roundId}
                  holeRevealed={view.holeRevealed}
                  isTurn={view.turnSeat === seat.seatIndex}
                  isFirstActor={view.startSeat === seat.seatIndex}
                  isLeader={leaderSeatIndices.has(seat.seatIndex)}
                  turnDurationMs={view.phase === 'player-turn' ? view.phaseDurationMs : null}
                  bubbleText={bubbleText}
                  showKick={youAreHost}
                  onKick={() => kick(seat.seatIndex)}
                />
              );
            })}
          </div>
        </div>

        <OnlineActionBar view={view} game={game} />
      </div>

      <ChatPanel chat={chat} ready={game.chatReady} myPlayerId={session?.playerId ?? null} onSend={sendChat} />

      <OnlineRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
