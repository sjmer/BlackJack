import { DEFAULT_SETTINGS, EMPTY_STATS, type Settings, type Stats } from '@bj/game';

const STATS_KEY = 'blackjack.stats.v1';
const SETTINGS_KEY = 'blackjack.settings.v1';
const ROUND_KEY = 'blackjack.round.v1';

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function loadStats(): Stats {
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) {
      return { ...EMPTY_STATS };
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return { ...EMPTY_STATS };
    }

    const streak = nonNegativeInteger(parsed.streak);
    return {
      wins: nonNegativeInteger(parsed.wins),
      losses: nonNegativeInteger(parsed.losses),
      pushes: nonNegativeInteger(parsed.pushes),
      streak,
      bestStreak: Math.max(streak, nonNegativeInteger(parsed.bestStreak)),
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

export function saveStats(stats: Stats): void {
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Private modes and restricted storage must never block a hand.
  }
}

export function loadRoundId(stats: Stats): number {
  const completed = stats.wins + stats.losses + stats.pushes;
  try {
    const raw = window.localStorage.getItem(ROUND_KEY);
    if (raw !== null) {
      return Math.max(nonNegativeInteger(Number(raw), completed), completed);
    }
  } catch {
    // Fall through to the completed-round count.
  }

  return completed;
}

export function saveRoundId(roundId: number): void {
  try {
    window.localStorage.setItem(ROUND_KEY, String(nonNegativeInteger(roundId)));
  } catch {
    // Round persistence is a convenience; never block play.
  }
}

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.muted !== 'boolean') {
      return { ...DEFAULT_SETTINGS };
    }

    return { muted: parsed.muted };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures; preferences simply last for this session.
  }
}
