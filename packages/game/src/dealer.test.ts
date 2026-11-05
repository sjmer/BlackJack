import { describe, expect, it } from 'vitest';
import { dealerShouldHit } from './dealer';
import type { HandValue } from './types';

function value(total: number, isSoft = false, isBust = false): HandValue {
  return { total, isSoft, isBust };
}

describe('dealer policy', () => {
  it('hits on 16 and below', () => {
    expect(dealerShouldHit(value(4))).toBe(true);
    expect(dealerShouldHit(value(16))).toBe(true);
    expect(dealerShouldHit(value(16, true))).toBe(true);
  });

  it('stands on every 17, including soft 17', () => {
    expect(dealerShouldHit(value(17))).toBe(false);
    expect(dealerShouldHit(value(17, true))).toBe(false);
    expect(dealerShouldHit(value(20, true))).toBe(false);
    expect(dealerShouldHit(value(21))).toBe(false);
  });

  it('never hits a busted hand', () => {
    expect(dealerShouldHit(value(22, false, true))).toBe(false);
  });
});
