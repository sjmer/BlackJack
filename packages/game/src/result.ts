import { getHandValue, isBlackjack } from './hand';
import type { Card, Outcome } from './types';

export function resolveOutcome(playerCards: readonly Card[], dealerCards: readonly Card[]): Outcome {
  const playerValue = getHandValue(playerCards);
  const dealerValue = getHandValue(dealerCards);
  const playerNatural = isBlackjack(playerCards);
  const dealerNatural = isBlackjack(dealerCards);

  if (playerNatural && dealerNatural) {
    return 'push';
  }

  if (playerNatural) {
    return 'player-blackjack';
  }

  if (dealerNatural) {
    return 'dealer-blackjack';
  }

  if (playerValue.isBust) {
    return 'player-bust';
  }

  if (dealerValue.isBust) {
    return 'dealer-bust';
  }

  if (playerValue.total > dealerValue.total) {
    return 'player-win';
  }

  if (playerValue.total < dealerValue.total) {
    return 'dealer-win';
  }

  return 'push';
}
