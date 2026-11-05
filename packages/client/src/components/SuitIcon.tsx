import type { Suit } from '@bj/game';

interface SuitIconProps {
  suit: Suit;
  className?: string;
}

export function SuitIcon({ suit, className = '' }: SuitIconProps) {
  let shape;

  switch (suit) {
    case 'hearts':
      shape = (
        <path d="M50 89C42 82 10 61 10 36 10 20 21 8 36 8c6 0 11 3 14 8 3-5 8-8 14-8 15 0 26 12 26 28 0 25-32 46-40 53Z" />
      );
      break;
    case 'diamonds':
      shape = <path d="M50 4 89 50 50 96 11 50Z" />;
      break;
    case 'clubs':
      shape = (
        <>
          <circle cx="50" cy="28" r="21" />
          <circle cx="27" cy="58" r="21" />
          <circle cx="73" cy="58" r="21" />
          <path d="M42 64h16l12 31H30Z" />
        </>
      );
      break;
    case 'spades':
      shape = (
        <path d="M50 7C43 23 13 37 13 58c0 15 12 27 27 27 5 0 9-1 13-4-2 10-7 17-14 22h22c-7-5-12-12-14-22 4 3 8 4 13 4 15 0 27-12 27-27C87 37 57 23 50 7Z" />
      );
      break;
  }

  return (
    <svg
      className={`suit-icon ${className}`}
      viewBox="0 0 100 100"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">{shape}</g>
    </svg>
  );
}
