import { useCallback, useEffect, useRef, useState } from 'react';
import { isBlackjack, duelRank, HIDDEN_CARD, MIN_DUEL_PLAYERS } from '@bj/game';
import type { DuelOutcome, SeatView, TableView } from '@bj/game';
import type { OnlineGameApi } from '../net/useOnlineGame';
import { useSound, type SoundName } from '../hooks/useSound';
import { ChatPanel } from './ChatPanel';
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
    return isBlackjack(you.cards) ? 'blackjack' : 'win';
  }

  return you.value.isBust ? 'bust' : 'lose';
}

interface SeatCardsStyle extends React.CSSProperties {
  '--card-w': string;
  '--seat-overlap-factor': number;
}

interface SeatTileProps {
  seat: SeatView;
  phase: TableView['phase'];
  isTurn: boolean;
  /** Viewer is the acting host: show the kick control on other seats. */
  showKick: boolean;
  onKick: () => void;
}

function SeatTile({ seat, phase, isTurn, showKick, onKick }: SeatTileProps) {
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

  // Fan overlapping (same idea as the offline Hand): once the row would
  // outgrow the tile, each extra card tucks under more of its neighbour.
  const count = seat.cards.length;
  const overlapFactor = count > 3 ? Math.min(0.75, (count - 3) * 0.22) : 0;
  const cardsStyle: SeatCardsStyle = {
    '--card-w': '44px',
    '--seat-overlap-factor': overlapFactor,
  };

  return (
    <div
      className={`seat-tile${isTurn ? ' is-turn' : ''}${seat.isYou ? ' is-you' : ''}${
        empty ? ' is-empty' : ''
      }${copy ? ` is-${copy.tone}` : ''}`}
      data-phase={phase}
    >
      <div className="seat-tile__head">
        <span className="seat-tile__index">SEAT {seat.seatIndex + 1}</span>
        {empty ? (
          <span className="seat-tile__name seat-tile__name--empty">虚位以待</span>
        ) : (
          <span className="seat-tile__name">
            {seat.name}
            {seat.isYou && <b className="seat-tile__you">YOU</b>}
          </span>
        )}
        <span className="seat-tile__badges">
          {seat.isHost && <i className="seat-badge seat-badge--host">房主</i>}
          {seat.isGhost && <i className="seat-badge seat-badge--ghost">已离开</i>}
          {!seat.isGhost && !seat.connected && !empty && <i className="seat-badge seat-badge--offline">离线</i>}
          {phase === 'lobby' && !empty && seat.ready && <i className="seat-badge seat-badge--ready">READY</i>}
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

      <div className="seat-tile__cards" style={cardsStyle}>
        {inHand
          ? seat.cards.map((card, index) => (
              <PlayingCard
                key={card.id}
                card={card}
                faceDown={card.id === HIDDEN_CARD.id}
                backLabel="对手的暗牌"
                index={index}
                tilt={index === 0 ? -1.6 : 1.6}
              />
            ))
          : !empty && <span className="seat-tile__waiting">等待开局</span>}
      </div>

      {inHand && (
        <div className={`seat-tile__foot${seat.value.isBust ? ' is-bust' : ''}`}>
          {seat.natural && <i className="seat-tile__natural">BLACKJACK</i>}
          <strong className="seat-tile__total">
            {seat.value.total}
            {seat.value.isSoft && !seat.value.isBust ? '*' : ''}
          </strong>
          {seat.hiddenCount > 0 && <i className="seat-tile__unknown">+?</i>}
          <span className="seat-tile__wld">
            {seat.stats.wins}胜 {seat.stats.losses}负 {seat.stats.pushes}平
          </span>
          {copy && <i className={`seat-tile__outcome seat-tile__outcome--${copy.tone}`}>{copy.title}</i>}
        </div>
      )}
    </div>
  );
}

/**
 * The board that used to be the dealer's area. During play it narrates the
 * duel; at round-over it ranks every hand from strongest to weakest.
 */
function DuelBoard({ view }: { view: TableView }) {
  const dealt = view.seats.filter((seat) => seat.cards.length > 0);

  if (view.phase !== 'round-over' || dealt.length === 0) {
    const hint =
      view.phase === 'lobby'
        ? `等待玩家准备 · 对决至少 ${MIN_DUEL_PLAYERS} 人`
        : view.phase === 'dealing'
          ? '发牌中…'
          : view.turnSeat !== null
            ? `轮到 ${view.seats[view.turnSeat]?.name ?? ''} 行动`
            : '';

    return (
      <section className="duel-board" aria-label="对决信息">
        <span className="duel-board__eyebrow">PLAYER DUEL</span>
        <strong className="duel-board__title">玩家对决</strong>
        {hint && <span className="duel-board__hint">{hint}</span>}
      </section>
    );
  }

  const ranked = [...dealt].sort((a, b) => duelRank(b.cards) - duelRank(a.cards));

  return (
    <section className="duel-board duel-board--result" aria-label="对决结果">
      <span className="duel-board__eyebrow">SHOWDOWN</span>
      <strong className="duel-board__title">对决结果</strong>
      <ol className="duel-board__list">
        {ranked.map((seat, index) => {
          const copy = DUEL_COPY[seat.outcome ?? 'push'];

          return (
            <li
              key={seat.seatIndex}
              className={`duel-board__row is-${copy.tone}${seat.isYou ? ' is-you' : ''}`}
            >
              <span className="duel-board__rank">#{index + 1}</span>
              <span className="duel-board__name">
                {seat.name}
                {seat.isYou ? '（你）' : ''}
              </span>
              <span className={`duel-board__total${seat.value.isBust ? ' is-bust' : ''}`}>
                {seat.value.isBust
                  ? `爆 ${seat.value.total}`
                  : isBlackjack(seat.cards)
                    ? 'BLACKJACK'
                    : `${seat.value.total} 点`}
              </span>
              <i className={`duel-board__outcome duel-board__outcome--${copy.tone}`}>{copy.title}</i>
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
            <strong>观战中 · 房间已满</strong>
            <small>SPECTATING</small>
          </span>
        </button>
      </section>
    );
  }

  if (view.phase === 'lobby') {
    const seatedCount = view.seats.filter((seat) => seat.occupied).length;

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
                  <strong>已准备 · 等待其他玩家</strong>
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
                <strong>{seatedCount >= MIN_DUEL_PLAYERS ? '准备开局' : `等待更多玩家（${seatedCount}/${MIN_DUEL_PLAYERS}）`}</strong>
                <small>READY UP</small>
              </span>
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

  const statusCopy =
    view.phase === 'dealing'
      ? { strong: '发牌中', small: 'DEALING' }
      : { strong: '对决结束 · 即将自动继续', small: 'SHOWDOWN COMPLETE' };

  return (
    <section className="action-dock" aria-label="牌局操作">
      <button type="button" className="game-button game-button--pending" disabled>
        <span className="waiting-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="game-button__copy">
          <strong>{statusCopy.strong}</strong>
          <small>{statusCopy.small}</small>
        </span>
      </button>
    </section>
  );
}

export function OnlineGame({ game, onExit }: OnlineGameProps) {
  const { status, error, view, session, chat, intent, leave, kick, sendChat } = game;
  const [copied, setCopied] = useState(false);
  const { play } = useSound(false);
  const lastSoundRef = useRef<{ roundId: number; outcome: DuelOutcome | null }>({ roundId: 0, outcome: null });
  const lastTurnRef = useRef<string>('');

  const yourTurn =
    view?.phase === 'player-turn' && view.turnSeat !== null && view.turnSeat === view.yourSeatIndex;

  // Sound cues mirror the offline game: your result once per round, a nudge
  // when the turn passes to you.
  useEffect(() => {
    if (!view) {
      return;
    }

    const you = view.seats.find((seat) => seat.isYou);

    if (
      view.phase === 'round-over' &&
      you?.outcome &&
      lastSoundRef.current.roundId !== view.roundId
    ) {
      lastSoundRef.current = { roundId: view.roundId, outcome: you.outcome };
      play(outcomeSound(you));
    }

    const turnKey = yourTurn ? `${view.roundId}:${view.turnSeat}` : '';

    if (turnKey && turnKey !== lastTurnRef.current) {
      lastTurnRef.current = turnKey;
      play('flip');
    }
  }, [view, yourTurn, play]);

  useEffect(() => {
    if (!yourTurn) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      const target = event.target;

      if (target instanceof HTMLElement && target.closest('input, textarea, select')) {
        return;
      }

      if (!view) {
        return;
      }

      if (key === 'h') {
        event.preventDefault();
        intent('hit', { roundId: view.roundId });
      } else if (key === 's') {
        event.preventDefault();
        intent('stand', { roundId: view.roundId });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [yourTurn, view, intent]);

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
        <div className="online-room__meta">
          <span>
            {view.phase === 'lobby'
              ? '等待玩家准备'
              : view.phase === 'dealing'
                ? '发牌中'
                : view.phase === 'player-turn'
                  ? `轮到 ${view.seats[view.turnSeat ?? 0]?.name ?? ''}`
                  : '对决结束'}
          </span>
          <span>牌堆余 {view.deckRemaining}</span>
        </div>
        <button type="button" className="online-room__exit" onClick={handleLeave}>
          退出房间
        </button>
      </header>

      <div className="online-room__table">
        <DuelBoard view={view} />

        <div className="online-room__seats">
          {view.seats.map((seat) => (
            <SeatTile
              key={seat.seatIndex}
              seat={seat}
              phase={view.phase}
              isTurn={view.turnSeat === seat.seatIndex}
              showKick={youAreHost}
              onKick={() => kick(seat.seatIndex)}
            />
          ))}
        </div>
      </div>

      <OnlineActionBar view={view} game={game} />

      <ChatPanel chat={chat} ready={game.chatReady} myPlayerId={session?.playerId ?? null} onSend={sendChat} />
    </div>
  );
}
