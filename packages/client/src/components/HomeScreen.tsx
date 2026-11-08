import { useEffect, useRef, useState } from 'react';
import type { OnlineGameApi } from '../net/useOnlineGame';
import { loadOnlineCareerStats } from '../state/storage';

const NAME_KEY = 'bj.player-name.v1';

interface HomeScreenProps {
  game: OnlineGameApi;
  onOffline: () => void;
}

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // A remembered nickname is a convenience only.
  }
}

export function HomeScreen({ game, onOffline }: HomeScreenProps) {
  const [name, setName] = useState(loadName);
  const [joinCode, setJoinCode] = useState('');
  const [career] = useState(loadOnlineCareerStats);
  const resumedRef = useRef(false);
  const careerTotal = career.wins + career.losses + career.pushes;

  // If this tab was in a room moments ago (refresh / accidental close),
  // silently try to rejoin it before showing the menu.
  useEffect(() => {
    if (resumedRef.current) {
      return;
    }

    resumedRef.current = true;
    game.tryResume();
    // Intentionally run once per mount; tryResume itself is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trimmedName = name.trim() || '玩家';

  const rememberAndCreate = () => {
    saveName(trimmedName);
    game.createRoom(trimmedName);
  };

  const rememberAndJoin = () => {
    const code = joinCode.trim().toUpperCase();

    if (code.length < 3) {
      return;
    }

    saveName(trimmedName);
    game.joinRoom(code, trimmedName);
  };

  return (
    <div className="app home">
      <div className="app-bg" aria-hidden="true">
        <span className="app-bg__suit app-bg__suit--one">♠</span>
        <span className="app-bg__suit app-bg__suit--two">♦</span>
        <span className="app-bg__suit app-bg__suit--three">♣</span>
        <span className="app-bg__grain" />
      </div>

      <main className="home-shell">
        <div className="home-card">
          <div className="home-card__seal">21</div>
          <p className="home-card__eyebrow">BLACKJACK 21</p>
          <h1 className="home-card__title">选择你的牌桌</h1>

          <label className="home-field">
            <span className="home-field__label">昵称</span>
            <input
              className="home-field__input"
              value={name}
              maxLength={12}
              placeholder="赌桌上的名号"
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <button type="button" className="home-action home-action--primary" onClick={onOffline}>
            <span className="home-action__copy">
              <strong>单机对庄</strong>
              <small>OFFLINE · SOLO VS DEALER</small>
            </span>
            <span className="home-action__glyph" aria-hidden="true">♠</span>
          </button>

          <button
            type="button"
            className="home-action home-action--online"
            onClick={rememberAndCreate}
            disabled={game.status === 'connecting'}
          >
            <span className="home-action__copy">
              <strong>创建联机房间</strong>
              <small>HOST ONLINE TABLE · 最多 5 人</small>
            </span>
            <span className="home-action__glyph" aria-hidden="true">♦</span>
          </button>

          <div className="home-join">
            <input
              className="home-join__input"
              value={joinCode}
              maxLength={4}
              placeholder="房间码"
              autoCapitalize="characters"
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  rememberAndJoin();
                }
              }}
            />
            <button
              type="button"
              className="home-join__button"
              onClick={rememberAndJoin}
              disabled={joinCode.trim().length < 3 || game.status === 'connecting'}
            >
              加入
            </button>
          </div>

          {game.error && <p className="home-error">{game.error}</p>}

          {careerTotal > 0 && (
            <div className="home-career" aria-label="联机生涯战绩">
              <span className="home-career__label">ONLINE CAREER</span>
              <div className="home-career__stats">
                <span>{career.wins}胜 {career.losses}负 {career.pushes}平</span>
                <span>最高 {career.bestStreak} 连胜</span>
                <span className={career.netChips >= 0 ? 'is-pos' : 'is-neg'}>
                  净筹码 {career.netChips >= 0 ? `+${career.netChips}` : career.netChips}
                </span>
              </div>
            </div>
          )}

          <p className="home-foot">联机房间由房主设备或服务器托管 · 凭房间码邀请好友</p>
        </div>
      </main>
    </div>
  );
}
