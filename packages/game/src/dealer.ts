import type { HandValue } from './types';

/**
 * The house stands on every 17, including soft 17, as specified by this
 * table's rules. A busted hand never draws again.
 */
export function dealerShouldHit(value: HandValue): boolean {
  return !value.isBust && value.total <= 16;
}
