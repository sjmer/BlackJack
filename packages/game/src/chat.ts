/**
 * Chat submodule shared by the server (authoritative log, rate limiting,
 * broadcast) and the client (panel rendering, local cooldown). Keeping the
 * wire type and limits in one place means both sides agree without coupling
 * to the game engine itself.
 */

/** One chat entry as broadcast to every socket in a room. */
export interface ChatMessage {
  id: string;
  kind: 'player' | 'system';
  /** Sender's player id; null for system messages. */
  playerId: string | null;
  /** Display name at send time (seat name, or the socket's lobby name). */
  name: string;
  text: string;
  ts: number;
}

/** Hard cap on one message, counted in UTF-16 units (an emoji may cost 2+). */
export const CHAT_MAX_LENGTH = 120;

/** Minimum spacing between two messages from the same socket. */
export const CHAT_MIN_INTERVAL_MS = 1200;

/** How many past messages a room keeps and replays to late joiners. */
export const CHAT_HISTORY_LIMIT = 50;

/** Strip control characters (newlines included) and clamp the length. */
export function sanitizeChatText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned.slice(0, CHAT_MAX_LENGTH);
}
