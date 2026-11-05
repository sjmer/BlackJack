interface TopBarProps {
  muted: boolean;
  onToggleMuted: () => void;
  onOpenRules: () => void;
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

export function TopBar({ muted, onToggleMuted, onOpenRules }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand" aria-label="BLACKJACK 21">
        <span className="brand__seal" aria-hidden="true">
          21
        </span>
        <div className="brand__copy">
          <span className="brand__eyebrow">LUCK IS A CARD</span>
          <div className="brand__line">
            <h1 className="brand__title">BLACKJACK</h1>
            <span className="brand__tick" aria-hidden="true">
              ♠
            </span>
          </div>
          <span className="brand__sub">二十一点 · 单人对庄</span>
        </div>
      </div>

      <div className="topbar__right">
        <span className="topbar__meta">
          ONE DECK
          <span>HEADS UP</span>
        </span>
        <button
          type="button"
          className="icon-button"
          onClick={onToggleMuted}
          aria-pressed={muted}
          aria-label={muted ? '打开音效' : '关闭音效'}
          title={muted ? '打开音效' : '关闭音效'}
        >
          <SoundIcon muted={muted} />
        </button>
        <button type="button" className="rules-button" onClick={onOpenRules}>
          <span className="rules-button__mark">?</span>
          <span>玩法</span>
        </button>
      </div>
    </header>
  );
}
