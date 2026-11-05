import { describe, expect, it } from 'vitest';
import { canStartRound, createInitialTable, occupiedSeatCount, tableReducer } from './table';
import type { TableState } from './table';
import { HIDDEN_CARD, viewForTable } from './view';
import type { Card, Rank, Suit } from './types';

const S: Suit = 'spades';
const H: Suit = 'hearts';
const D: Suit = 'diamonds';
const C: Suit = 'clubs';

function c(suit: Suit, rank: Rank): Card {
  return { id: `${suit}-${rank}`, suit, rank };
}

function seated(names: string[]): TableState {
  let state = createInitialTable();
  state.seats.forEach((_, index) => {
    if (index < names.length) {
      state = tableReducer(state, {
        type: 'SIT',
        seatIndex: index,
        playerId: `p${index}`,
        name: names[index],
      });
    }
  });

  return state;
}

function readyUp(state: TableState, playerId: string, ready = true): TableState {
  return tableReducer(state, { type: 'SET_READY', playerId, ready });
}

function readyAll(state: TableState): TableState {
  return state.seats
    .filter((seat) => seat.playerId !== '')
    .reduce((acc, seat) => readyUp(acc, seat.playerId), state);
}

/** Two ready players, dealt the given hands, straight into player-turn. */
function duel(hand0: Card[], hand1: Card[], rest: Card[] = []): TableState {
  let state = readyAll(seated(['Alice', 'Bob']));
  state = tableReducer(state, {
    type: 'START_ROUND',
    deck: [...hand0, ...hand1, ...rest],
  });
  return tableReducer(state, { type: 'DEAL_COMPLETE' });
}

describe('seating', () => {
  it('seats players and reports occupancy', () => {
    const state = seated(['Alice', 'Bob']);

    expect(occupiedSeatCount(state)).toBe(2);
    expect(state.seats[0]).toMatchObject({ playerId: 'p0', name: 'Alice', connected: true });
    expect(state.seats[1]).toMatchObject({ playerId: 'p1', name: 'Bob' });
    expect(state.seats[2].playerId).toBe('');
  });

  it('rejects double-booking a seat or a player id', () => {
    let state = seated(['Alice']);
    state = tableReducer(state, { type: 'SIT', seatIndex: 0, playerId: 'px', name: 'Mallory' });
    state = tableReducer(state, { type: 'SIT', seatIndex: 1, playerId: 'p0', name: 'Clone' });

    expect(state.seats[0].name).toBe('Alice');
    expect(state.seats[1].playerId).toBe('');
  });

  it('allows sitting between rounds but not mid-round', () => {
    let state = readyAll(seated(['Alice', 'Bob']));
    state = tableReducer(state, {
      type: 'START_ROUND',
      deck: [c(S, 'K'), c(S, '9'), c(H, 'K'), c(H, '6')],
    });

    expect(state.phase).toBe('dealing');

    const midRound = tableReducer(state, { type: 'SIT', seatIndex: 2, playerId: 'p9', name: 'Late' });
    expect(midRound.seats[2].playerId).toBe('');
  });
});

describe('round start', () => {
  it('deals two cards per seat and nothing else', () => {
    let state = readyAll(seated(['Alice', 'Bob']));
    state = tableReducer(state, {
      type: 'START_ROUND',
      deck: [c(S, 'K'), c(S, '9'), c(H, 'K'), c(H, '6')],
    });

    expect(state.phase).toBe('dealing');
    expect(state.roundId).toBe(1);
    expect(state.seats[0].cards.map((card) => card.rank)).toEqual(['K', '9']);
    expect(state.seats[1].cards.map((card) => card.rank)).toEqual(['K', '6']);
    expect(state.deck).toHaveLength(0);
    expect(state.seats.every((seat) => seat.playerId === '' || !seat.ready)).toBe(true);
  });

  it('needs at least two players for a duel', () => {
    let state = readyAll(seated(['Alice']));

    expect(canStartRound(state)).toBe(false);

    state = tableReducer(state, {
      type: 'START_ROUND',
      deck: [c(S, 'K'), c(S, '9')],
    });
    expect(state.phase).toBe('lobby');
  });

  it('waits until every seated player is ready', () => {
    let state = seated(['Alice', 'Bob']);
    state = readyUp(state, 'p0');

    expect(canStartRound(state)).toBe(false);

    state = tableReducer(state, {
      type: 'START_ROUND',
      deck: [c(S, 'K'), c(S, '9'), c(H, 'K'), c(H, '6')],
    });
    expect(state.phase).toBe('lobby');
  });

  it('rejects a deck that cannot cover the table', () => {
    let state = readyAll(seated(['Alice', 'Bob']));
    state = tableReducer(state, { type: 'START_ROUND', deck: [c(S, 'K')] });

    expect(state.phase).toBe('lobby');
  });
});

describe('player turns', () => {
  it('gives the first seat the turn and honours turn ownership', () => {
    const state = duel([c(S, 'K'), c(S, '9')], [c(H, 'K'), c(H, '6')]);

    expect(state.phase).toBe('player-turn');
    expect(state.turnSeat).toBe(0);

    const wrongSeat = tableReducer(state, { type: 'HIT', seatIndex: 1 });
    expect(wrongSeat).toBe(state);
  });

  it('advances on stand and settles the duel after the last seat', () => {
    let state = duel([c(S, 'K'), c(S, '9')], [c(H, 'K'), c(H, '6')]);

    state = tableReducer(state, { type: 'STAND', seatIndex: 0 });
    expect(state.phase).toBe('player-turn');
    expect(state.turnSeat).toBe(1);

    state = tableReducer(state, { type: 'STAND', seatIndex: 1 });
    expect(state.phase).toBe('round-over');
    expect(state.turnSeat).toBeNull();
    expect(state.seats[0].outcome).toBe('win');
    expect(state.seats[0].stats.wins).toBe(1);
    expect(state.seats[1].outcome).toBe('loss');
    expect(state.seats[1].stats.losses).toBe(1);
  });

  it('does not pre-settle a bust while another seat can still act', () => {
    let state = duel([c(S, 'K'), c(S, '8')], [c(H, 'K'), c(H, '6')], [c(D, '5')]);

    state = tableReducer(state, { type: 'HIT', seatIndex: 0 });

    // 18 + 5 busts, but the round is not decided until everyone finishes.
    const busted = state.seats[0];
    expect(busted.acted).toBe(true);
    expect(busted.outcome).toBeNull();
    expect(busted.stats.losses).toBe(0);
    expect(state.phase).toBe('player-turn');
    expect(state.turnSeat).toBe(1);

    state = tableReducer(state, { type: 'STAND', seatIndex: 1 });

    expect(state.phase).toBe('round-over');
    expect(state.seats[0].outcome).toBe('loss');
    expect(state.seats[0].stats.losses).toBe(1);
    expect(state.seats[1].outcome).toBe('win');
  });

  it('auto-stands on exactly 21', () => {
    let state = duel([c(S, 'K'), c(S, '9')], [c(H, 'K'), c(H, '6')], [c(D, '5')]);

    state = tableReducer(state, { type: 'STAND', seatIndex: 0 });
    state = tableReducer(state, { type: 'HIT', seatIndex: 1 });

    expect(state.seats[1].cards).toHaveLength(3);
    expect(state.seats[1].acted).toBe(true);
    expect(state.phase).toBe('round-over');
    expect(state.seats[1].outcome).toBe('win');
  });

  it('treats SEAT_TIMEOUT like a stand', () => {
    let state = duel([c(S, 'K'), c(S, '9')], [c(H, 'K'), c(H, '6')]);

    state = tableReducer(state, { type: 'SEAT_TIMEOUT', seatIndex: 0 });
    expect(state.turnSeat).toBe(1);
    expect(state.seats[0].acted).toBe(true);
  });

  it('skips naturals: they never act', () => {
    const state = duel([c(S, 'A'), c(S, 'K')], [c(H, 'K'), c(H, '6')]);

    expect(state.seats[0].acted).toBe(true);
    expect(state.turnSeat).toBe(1);
  });

  it('settles instantly when every player holds a natural', () => {
    const state = duel([c(S, 'A'), c(S, 'K')], [c(D, '10'), c(D, 'A')]);

    expect(state.phase).toBe('round-over');
    expect(state.seats[0].outcome).toBe('push');
    expect(state.seats[0].stats.pushes).toBe(1);
    expect(state.seats[1].outcome).toBe('push');
  });
});

describe('duel settlement', () => {
  it('ranks three hands with a drawn card tying the leader', () => {
    let state = readyAll(seated(['Alice', 'Bob', 'Carol']));
    state = tableReducer(state, {
      type: 'START_ROUND',
      deck: [
        c(S, 'K'), c(S, '9'),   // Alice 19
        c(H, 'K'), c(H, '8'),   // Bob 18
        c(D, 'Q'), c(D, '4'),   // Carol 14
        c(C, '5'),
      ],
    });
    state = tableReducer(state, { type: 'DEAL_COMPLETE' });

    state = tableReducer(state, { type: 'STAND', seatIndex: 0 });
    state = tableReducer(state, { type: 'STAND', seatIndex: 1 });
    state = tableReducer(state, { type: 'HIT', seatIndex: 2 }); // 14 + 5 = 19
    state = tableReducer(state, { type: 'STAND', seatIndex: 2 });

    expect(state.phase).toBe('round-over');
    expect(state.seats[0].outcome).toBe('push'); // 19 tied with Carol
    expect(state.seats[1].outcome).toBe('loss');
    expect(state.seats[2].outcome).toBe('push');
  });

  it('lets a tied best push while the weaker hand loses', () => {
    let state = readyAll(seated(['Alice', 'Bob', 'Carol']));
    state = tableReducer(state, {
      type: 'START_ROUND',
      deck: [
        c(S, 'K'), c(S, '9'), // Alice 19
        c(H, 'K'), c(H, '9'), // Bob 19
        c(D, 'K'), c(D, '8'), // Carol 18
      ],
    });
    state = tableReducer(state, { type: 'DEAL_COMPLETE' });

    state = tableReducer(state, { type: 'STAND', seatIndex: 0 });
    state = tableReducer(state, { type: 'STAND', seatIndex: 1 });
    state = tableReducer(state, { type: 'STAND', seatIndex: 2 });

    expect(state.seats[0].outcome).toBe('push');
    expect(state.seats[1].outcome).toBe('push');
    expect(state.seats[2].outcome).toBe('loss');
  });

  it('a natural beats a 21 assembled from three cards', () => {
    let state = duel([c(S, 'A'), c(S, 'K')], [c(H, '5'), c(H, '6')], [c(D, 'K')]);

    // Alice's natural auto-acted; Bob draws to 21 the hard way.
    state = tableReducer(state, { type: 'HIT', seatIndex: 1 });

    expect(state.phase).toBe('round-over');
    expect(state.seats[0].outcome).toBe('win');
    expect(state.seats[1].outcome).toBe('loss');
  });

  it('pushes everyone when every hand busts', () => {
    let state = duel([c(S, 'K'), c(S, '8')], [c(H, 'Q'), c(H, '7')], [c(D, 'K'), c(C, '9')]);

    state = tableReducer(state, { type: 'HIT', seatIndex: 0 }); // 18 + K bust
    state = tableReducer(state, { type: 'HIT', seatIndex: 1 }); // 17 + 9 bust

    expect(state.phase).toBe('round-over');
    expect(state.seats[0].outcome).toBe('push');
    expect(state.seats[1].outcome).toBe('push');
    expect(state.seats.every((seat) => seat.stats.losses === 0)).toBe(true);
  });

  it('still settles a ghost hand against the remaining player', () => {
    let state = duel([c(S, 'K'), c(S, '9')], [c(H, 'K'), c(H, '6')]);

    state = tableReducer(state, { type: 'STAND_UP', playerId: 'p0' });

    expect(state.seats[0].playerId).toBe('');
    expect(state.turnSeat).toBe(1);

    state = tableReducer(state, { type: 'STAND', seatIndex: 1 });

    expect(state.phase).toBe('round-over');
    expect(state.seats[0].outcome).toBe('win');
    expect(state.seats[1].outcome).toBe('loss');
  });
});

describe('connection lifecycle', () => {
  it('marks disconnect and reconnect without touching the hand', () => {
    let state = duel([c(S, 'K'), c(S, '9')], [c(H, 'K'), c(H, '6')]);

    state = tableReducer(state, { type: 'PLAYER_DISCONNECT', playerId: 'p0' });
    expect(state.seats[0].connected).toBe(false);
    expect(state.seats[0].cards).toHaveLength(2);

    state = tableReducer(state, { type: 'PLAYER_RECONNECT', playerId: 'p0' });
    expect(state.seats[0].connected).toBe(true);
  });

  it('ghosts a mid-round leaver and auto-stands on their turn', () => {
    let state = duel([c(S, 'K'), c(S, '9')], [c(H, 'K'), c(H, '6')]);

    expect(state.turnSeat).toBe(0);

    state = tableReducer(state, { type: 'STAND_UP', playerId: 'p0' });

    expect(state.seats[0].playerId).toBe('');
    expect(state.seats[0].name).toBe('Alice');
    expect(state.seats[0].cards).toHaveLength(2);
    expect(state.turnSeat).toBe(1);
  });

  it('frees the seat when leaving from the lobby', () => {
    let state = seated(['Alice', 'Bob']);
    state = tableReducer(state, { type: 'STAND_UP', playerId: 'p1' });

    expect(state.seats[1]).toMatchObject({ playerId: '', name: '' });
    expect(occupiedSeatCount(state)).toBe(1);
  });
});

describe('round start with offline seats', () => {
  it('does not block the start on a disconnected unready player', () => {
    let state = seated(['Alice', 'Bob', 'Carol']);
    state = tableReducer(state, { type: 'PLAYER_DISCONNECT', playerId: 'p1' });
    state = readyUp(state, 'p0');
    state = readyUp(state, 'p2');

    expect(canStartRound(state)).toBe(true);

    state = tableReducer(state, {
      type: 'START_ROUND',
      deck: [c(S, 'K'), c(S, '9'), c(H, 'K'), c(H, '6')],
    });

    expect(state.phase).toBe('dealing');
    expect(state.seats[1].cards).toHaveLength(0); // absent and unready: sits out
    expect(state.seats[0].cards).toHaveLength(2);
    expect(state.seats[2].cards).toHaveLength(2);
  });

  it('still refuses to start with fewer than two connected players', () => {
    let state = seated(['Alice', 'Bob']);
    state = tableReducer(state, { type: 'PLAYER_DISCONNECT', playerId: 'p1' });
    state = readyUp(state, 'p0');

    expect(canStartRound(state)).toBe(false);

    state = tableReducer(state, {
      type: 'START_ROUND',
      deck: [c(S, 'K'), c(S, '9'), c(H, 'K'), c(H, '6')],
    });
    expect(state.phase).toBe('lobby');
  });

  it('deals in a disconnected player who readied before dropping', () => {
    // Three players: Bob readies, then drops; the two online players start.
    let state = seated(['Alice', 'Bob', 'Carol']);
    state = readyUp(state, 'p1');
    state = tableReducer(state, { type: 'PLAYER_DISCONNECT', playerId: 'p1' });
    state = readyUp(state, 'p0');
    state = readyUp(state, 'p2');

    expect(canStartRound(state)).toBe(true);

    state = tableReducer(state, {
      type: 'START_ROUND',
      deck: [
        c(S, 'K'), c(S, '9'),
        c(H, 'K'), c(H, '6'),
        c(D, 'Q'), c(D, '4'),
      ],
    });

    expect(state.seats[1].cards).toHaveLength(2); // opted in before dropping
  });
});

describe('host kick', () => {
  it('frees a lobby seat entirely', () => {
    let state = seated(['Alice', 'Bob']);
    state = tableReducer(state, { type: 'KICK', seatIndex: 1, byPlayerId: 'p0' });

    expect(state.seats[1]).toMatchObject({ playerId: '', name: '' });
    expect(occupiedSeatCount(state)).toBe(1);
  });

  it('ghosts a mid-round target, advances the turn and still settles their hand', () => {
    let state = duel([c(S, 'K'), c(S, '9')], [c(H, 'K'), c(H, '6')]);
    expect(state.turnSeat).toBe(0);

    state = tableReducer(state, { type: 'KICK', seatIndex: 0, byPlayerId: 'p1' });

    expect(state.seats[0].playerId).toBe('');
    expect(state.seats[0].name).toBe('Alice');
    expect(state.seats[0].acted).toBe(true);
    expect(state.turnSeat).toBe(1);

    state = tableReducer(state, { type: 'STAND', seatIndex: 1 });

    expect(state.phase).toBe('round-over');
    expect(state.seats[0].outcome).toBe('win'); // the ghost hand is still ranked
  });

  it('rejects kicking yourself or an empty seat', () => {
    const state = seated(['Alice']);

    const self = tableReducer(state, { type: 'KICK', seatIndex: 0, byPlayerId: 'p0' });
    expect(self).toBe(state);

    const empty = tableReducer(state, { type: 'KICK', seatIndex: 2, byPlayerId: 'p0' });
    expect(empty).toBe(state);
  });
});

describe('host projection', () => {
  it('marks the host seat for every viewer and nobody without a host', () => {
    const state = duel([c(S, 'K'), c(S, '9')], [c(H, 'K'), c(H, '6')]);

    const aliceView = viewForTable(state, 'p0', 'R1', 'p0');
    expect(aliceView.seats[0].isHost).toBe(true);
    expect(aliceView.seats[1].isHost).toBe(false);

    const bobView = viewForTable(state, 'p1', 'R1', 'p0');
    expect(bobView.seats[0].isHost).toBe(true);

    const noHost = viewForTable(state, 'p0', 'R1');
    expect(noHost.seats.every((seat) => !seat.isHost)).toBe(true);
  });
});

describe('back to lobby', () => {
  it('clears the table, keeps seated stats and removes ghosts', () => {
    let state = duel([c(S, 'K'), c(S, '9')], [c(H, 'K'), c(H, '6')]);

    state = tableReducer(state, { type: 'STAND_UP', playerId: 'p0' });
    state = tableReducer(state, { type: 'STAND', seatIndex: 1 });
    expect(state.phase).toBe('round-over');

    const lobby = tableReducer(state, { type: 'BACK_TO_LOBBY' });

    expect(lobby.phase).toBe('lobby');
    expect(lobby.deck).toHaveLength(0);
    expect(lobby.seats[0].name).toBe('');
    expect(lobby.seats[0].stats.wins).toBe(0);
    expect(lobby.seats[1]).toMatchObject({ playerId: 'p1', name: 'Bob' });
    expect(lobby.seats[1].cards).toHaveLength(0);
    expect(lobby.seats[1].stats.losses).toBe(1);
  });
});

describe('view masking (rotating hole card)', () => {
  it('masks the latest card from opponents and totals visible cards only', () => {
    // Alice K+9 = 19, Bob 8+6 = 14. Bob (p1) is the viewer.
    const state = duel([c(S, 'K'), c(S, '9')], [c(H, '8'), c(H, '6')]);
    const view = viewForTable(state, 'p1', 'R1');

    const alice = view.seats[0];
    expect(alice.cards).toHaveLength(2);
    expect(alice.cards[1].id).toBe(HIDDEN_CARD.id);
    expect(alice.value.total).toBe(10); // king only
    expect(alice.hiddenCount).toBe(1);
    expect(alice.natural).toBe(false);

    const bob = view.seats[1];
    expect(bob.isYou).toBe(true);
    expect(bob.cards.every((card) => card.id !== HIDDEN_CARD.id)).toBe(true);
    expect(bob.value.total).toBe(14);
    expect(bob.hiddenCount).toBe(0);

    expect(view.holeRevealed).toBe(false);
  });

  it('reveals the previous hole card and hides the new draw after a hit', () => {
    // Alice K+9, hits a 5 → busts at 24; Bob watches the old hole appear.
    let state = duel([c(S, 'K'), c(S, '8')], [c(H, 'K'), c(H, '6')], [c(D, '5')]);
    state = tableReducer(state, { type: 'HIT', seatIndex: 0 });

    const view = viewForTable(state, 'p1', 'R1');
    const alice = view.seats[0];

    expect(alice.cards.map((card) => card.id)).toEqual([
      c(S, 'K').id,
      c(S, '8').id,
      HIDDEN_CARD.id,
    ]);
    expect(alice.value.total).toBe(18); // K + 8 visible; the bust stays hidden
    expect(alice.hiddenCount).toBe(1);
  });

  it('reveals every hand at the showdown', () => {
    let state = duel([c(S, 'K'), c(S, '9')], [c(H, 'K'), c(H, '6')]);
    state = tableReducer(state, { type: 'STAND', seatIndex: 0 });
    state = tableReducer(state, { type: 'STAND', seatIndex: 1 });

    for (const viewer of ['p0', 'p1']) {
      const view = viewForTable(state, viewer, 'R1');

      expect(view.holeRevealed).toBe(true);
      expect(view.seats.every((seat) => seat.cards.every((card) => card.id !== HIDDEN_CARD.id))).toBe(true);
      expect(view.seats.every((seat) => seat.hiddenCount === 0)).toBe(true);
      expect(view.seats[0].value.total).toBe(19);
      expect(view.seats[1].value.total).toBe(16);
    }
  });

  it('keeps the natural flag private to its owner during play', () => {
    // Alice holds a natural A+K; it auto-acts at deal. Bob must not see it.
    const state = duel([c(S, 'A'), c(S, 'K')], [c(H, '10'), c(H, '5')]);

    const bobView = viewForTable(state, 'p1', 'R1');
    expect(bobView.seats[0].natural).toBe(false);
    expect(bobView.seats[0].cards[1].id).toBe(HIDDEN_CARD.id);

    const aliceView = viewForTable(state, 'p0', 'R1');
    expect(aliceView.seats[0].isYou).toBe(true);
    expect(aliceView.seats[0].natural).toBe(true);
    expect(aliceView.seats[0].hiddenCount).toBe(0);
  });

  it('masks every dealt seat for a spectator', () => {
    const state = duel([c(S, 'K'), c(S, '9')], [c(H, 'K'), c(H, '6')]);
    const view = viewForTable(state, null, 'R1');

    const dealt = view.seats.filter((seat) => seat.cards.length > 0);
    expect(dealt).toHaveLength(2);
    expect(dealt.every((seat) => seat.hiddenCount === 1)).toBe(true);
    expect(dealt.every((seat) => seat.cards.at(-1)?.id === HIDDEN_CARD.id)).toBe(true);
    expect(view.yourSeatIndex).toBeNull();
  });
});

describe('blackjack ranking regression', () => {
  it('two naturals push while a 21 assembled from three cards loses', () => {
    // Alice A+K natural, Bob 10+A natural, Carol 5+6 then draws a K → 21.
    let state = readyAll(seated(['Alice', 'Bob', 'Carol']));
    state = tableReducer(state, {
      type: 'START_ROUND',
      deck: [
        c(S, 'A'), c(S, 'K'),
        c(H, '10'), c(H, 'A'),
        c(D, '5'), c(D, '6'),
        c(C, 'K'),
      ],
    });
    state = tableReducer(state, { type: 'DEAL_COMPLETE' });

    // Both naturals auto-acted; only Carol may act.
    expect(state.turnSeat).toBe(2);

    state = tableReducer(state, { type: 'HIT', seatIndex: 2 });
    expect(state.phase).toBe('round-over');

    expect(state.seats[0].outcome).toBe('push');
    expect(state.seats[0].stats.pushes).toBe(1);
    expect(state.seats[1].outcome).toBe('push');
    expect(state.seats[1].stats.pushes).toBe(1);
    expect(state.seats[2].outcome).toBe('loss');
    expect(state.seats[2].stats.losses).toBe(1);
  });
});
