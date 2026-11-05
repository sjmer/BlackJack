/**
 * Pacing constants shared between the server scheduler and client
 * animations. The server owns the clock in online games; the client only
 * plays animations of matching length.
 */
export const DEALING_DURATION_MS = 1_050;

/**
 * Offline single-player only: how long the client waits between dealer draws.
 * Online duel mode has no dealer, so the server scheduler never uses this.
 */
export const DEALER_STEP_DURATION_MS = 680;

export const SEAT_TURN_TIMEOUT_MS = 30_000;

/**
 * Online duel only: when the acting seat's player is disconnected the server
 * gives them this shorter grace window before auto-standing (auto-pilot).
 * The full 30s applies again the moment they reconnect.
 */
export const OFFLINE_SEAT_TIMEOUT_MS = 6_000;
