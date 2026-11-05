import type { Suit } from '@bj/game';
import { SUIT_META } from '../ui/labels';

type CourtRank = 'J' | 'Q' | 'K';

interface CourtArtProps {
  rank: CourtRank;
  suit: Suit;
}

interface FigureProps {
  rank: CourtRank;
}

const GOLD = '#d7aa57';
const INK = '#28211d';
const SKIN = '#efd5a7';
const HAIR = '#4b3528';

function CourtFigure({ rank }: FigureProps) {
  return (
    <g>
      <path
        className="court-robe"
        d="M18 76c1-18 12-29 32-29s31 11 32 29v1H18Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M34 58c4 7 9 11 16 11s12-4 16-11l5 5c-4 10-11 17-21 17s-17-7-21-17Z"
        fill="var(--court-trim, #e5bf72)"
        stroke="currentColor"
        strokeWidth="0.8"
      />
      <path
        d="M39 40c0-7 4-12 11-12s11 5 11 12v12c0 8-5 14-11 14s-11-6-11-14Z"
        fill={SKIN}
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M35 39c-3-13 4-21 15-21s18 8 15 21l-4-5-4 4-7-8-7 8-4-4Z"
        fill={HAIR}
        stroke="currentColor"
        strokeWidth="0.8"
      />
      {rank === 'K' && (
        <>
          <path
            d="M33 55c2 13 7 20 17 20s15-7 17-20c-5 5-10 7-17 7s-12-2-17-7Z"
            fill={HAIR}
            opacity="0.92"
          />
          <path d="M45 47h4M51 47h4" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M50 48v5l-2 1" fill="none" stroke={INK} strokeWidth="0.9" strokeLinecap="round" />
          <path d="M46 58h8" stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
          <g>
            <path
              d="M37 30 38 14l7 7 5-11 5 11 7-7 1 16Z"
              fill={GOLD}
              stroke={INK}
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <circle cx="38" cy="15" r="1.4" fill="var(--court-gem, #b13a3a)" />
            <circle cx="50" cy="11" r="1.6" fill="var(--court-gem, #b13a3a)" />
            <circle cx="62" cy="15" r="1.4" fill="var(--court-gem, #b13a3a)" />
            <path d="M40 25h20" stroke={INK} strokeWidth="0.8" />
          </g>
        </>
      )}
      {rank === 'Q' && (
        <>
          <path
            d="M36 40c-5 10-4 23 2 30-4 1-8-1-9-5-3-10 0-22 7-30ZM64 40c5 10 4 23-2 30 4 1 8-1 9-5 3-10 0-22-7-30Z"
            fill={HAIR}
            stroke="currentColor"
            strokeWidth="0.8"
          />
          <path d="M45 46h4M51 46h4" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M50 47v5l-1.5 1" fill="none" stroke={INK} strokeWidth="0.8" strokeLinecap="round" />
          <path d="M47 57c2 1.5 4 1.5 6 0" fill="none" stroke={INK} strokeWidth="1" strokeLinecap="round" />
          <path
            d="M38 30 40 18l5 5 5-9 5 9 5-5 2 12Z"
            fill={GOLD}
            stroke={INK}
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <circle cx="40" cy="18" r="1.3" fill="var(--court-gem, #b13a3a)" />
          <circle cx="50" cy="15" r="1.5" fill="var(--court-gem, #b13a3a)" />
          <circle cx="60" cy="18" r="1.3" fill="var(--court-gem, #b13a3a)" />
          <path d="M34 36c-2-7 2-12 8-13M66 36c2-7-2-12-8-13" fill="none" stroke={GOLD} strokeWidth="1" />
        </>
      )}
      {rank === 'J' && (
        <>
          <path
            d="M35 39c-2-10 4-17 15-17s17 7 15 17c-4-3-8-4-15-4s-11 1-15 4Z"
            fill="var(--court-hat, #304b3e)"
            stroke="currentColor"
            strokeWidth="0.9"
          />
          <path
            d="M56 23c4-7 8-9 12-6-3 2-4 5-3 8Z"
            fill={GOLD}
            stroke={INK}
            strokeWidth="0.8"
          />
          <path d="M45 45h4M51 45h4" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M50 46v5l-1.5 1" fill="none" stroke={INK} strokeWidth="0.8" strokeLinecap="round" />
          <path d="M47 57h6" stroke={INK} strokeWidth="1" strokeLinecap="round" />
          <path d="M38 66c8 4 16 4 24 0" fill="none" stroke={GOLD} strokeWidth="1.1" />
        </>
      )}
      <path
        d="M24 71c5-8 12-12 26-12s21 4 26 12"
        fill="none"
        stroke="var(--court-trim, #e5bf72)"
        strokeWidth="1.2"
      />
      <path d="M50 62v14M46 66l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <path
        d="M50 66c-2 3-2 6 0 8 2-2 2-5 0-8Z"
        fill={GOLD}
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <g opacity="0.45" fill="currentColor">
        <circle cx="23" cy="31" r="0.8" />
        <circle cx="29" cy="24" r="0.8" />
        <circle cx="77" cy="31" r="0.8" />
        <circle cx="71" cy="24" r="0.8" />
      </g>
      <circle cx="50" cy="52" r="0.9" fill={GOLD} />
    </g>
  );
}

export function CourtArt({ rank, suit }: CourtArtProps) {
  return (
    <svg
      className="court-art"
      viewBox="0 0 100 150"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="court-art__panel" x="2" y="2" width="96" height="146" rx="5" />
      <path
        className="court-art__hatch"
        d="M8 21 19 8M8 36 32 8M8 51 45 8M75 8 92 25M82 8 92 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.45"
      />
      <g>
        <CourtFigure rank={rank} />
      </g>
      <g transform="rotate(180 50 75)">
        <CourtFigure rank={rank} />
      </g>
      <path d="M12 75h29M59 75h29" stroke="var(--court-trim, #e5bf72)" strokeWidth="0.9" />
      <path
        d="M50 68.5 55.5 75 50 81.5 44.5 75Z"
        fill="var(--card-paper, #f4e8ce)"
        stroke="var(--court-trim, #e5bf72)"
        strokeWidth="0.9"
      />
      <text
        x="50"
        y="77.4"
        textAnchor="middle"
        fontSize="5.4"
        fontWeight="700"
        fill="currentColor"
      >
        {SUIT_META[suit].symbol}
      </text>
      <rect
        rx="1"
        x="4.5"
        y="4.5"
        width="91"
        height="141"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.65"
        opacity="0.55"
      />
    </svg>
  );
}
