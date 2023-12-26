import { z } from 'zod';
import { System } from './utils/system';
export const ROOT_DISPATCHER = '<ROOT_DISPATCHER>';

export type Phase = 'lobby' | 'playing' | 'finished';
export type Tree = ((number | '🎁' | undefined)[])[];
export const system = new System({
  tick: 0,

  phase: 'lobby' as Phase,
  starting: -1,
  lobby: {} as { [name: string]: { isReady: boolean } },
  spectators: [] as string[],

  players: [] as string[],
  scores: {} as { [name: string]: number },
  turn: undefined as (undefined | string),
  tree: [
    [1],
    [2, '🎁'],
    [1, undefined, 1],
    ['🎁', 3, 2, 1],
    [2, 2, 1, undefined, 3],
    [1, undefined, 3, 1, 2, 1],
    [2, 3, 2, 1, undefined, '🎁', 3],
    [1, 2, '🎁', 1, 3, 1, 2, 2],
    [2, undefined, 2, '🎁', 1, 3, 2, 1, 4],
    [3, 1, 2, 1, 1, 3, 2, undefined, 2, 1],
    [1, 3, 1, 2, undefined, 5, '🎁', 2, 2, 1, 3],
    [1, 2, '🎁', 1, 2, 1, 1, 3, 1, 2, 1, 2],
    [3, 4, 1, undefined, 1, 1, 2, '🎁', 1, 2, 3, undefined, 2],
    [2, 1, 2, 1, 5, 1, 3, undefined, 2, 2, 1, 1, 1, 1],
    [1, 3, 4, 1, '🎁', 1, 4, 5, 2, 4, 1, 3, 1, 2, 3],
  ] as Tree,
});

export const isPickable = (tree: Tree, x: number, y: number) => {
  const leftTop = x === 0 || tree[y - 1][x - 1] === undefined;
  const rightTop = x === y || tree[y - 1][x] === undefined;
  return y === 0 || (rightTop && leftTop);
};

export const tick = system.when('tick', z.number().positive().int(), (state, dispatcher, payload) => {
  if (dispatcher !== ROOT_DISPATCHER) {
    return;
  }
  state.tick = payload;
  if (state.phase === 'lobby' && state.starting > 0 && state.tick >= state.starting) {
    state.phase = 'playing';
    state.players = Object.keys(state.lobby);
    state.scores = Object.fromEntries(state.players.map((player) => [player, 0]));
    state.turn = state.players[0];
    console.info('[INFO] playing with', state.players);
  }
});

export const joiner = system.when('joiner', z.string().min(3), (state, dispatcher, payload) => {
  if (dispatcher !== ROOT_DISPATCHER) {
    return;
  }
  if (state.phase === 'lobby') {
    state.lobby[payload] = { isReady: false };
    Object.keys(state.lobby).forEach((username) => state.lobby[username].isReady = false);
    state.starting = -1;
  } else if (state.phase === 'playing' && state.players.includes(payload)) {
    // do nothing...
  } else {
    state.spectators.push(payload);
  }
});

export const leaver = system.when('leaver', z.string().min(3), (state, dispatcher, payload) => {
  if (dispatcher !== ROOT_DISPATCHER) {
    return;
  }
  if (state.phase === 'lobby') {
    delete state.lobby[payload];
    Object.keys(state.lobby).forEach((username) => state.lobby[username].isReady = false);
    state.starting = -1;
  } else {
    const spectator = state.spectators.indexOf(payload);
    if (spectator >= 0) {
      state.spectators.splice(spectator, 1);
    }
  }
});

export const ready = system.when('ready', z.boolean(), (state, dispatcher, payload) => {
  if (state.phase !== 'lobby') {
    return;
  }
  state.lobby[dispatcher].isReady = payload;
  if (Object.keys(state.lobby).every((username) => state.lobby[username].isReady)) {
    state.starting = state.tick + 5;
  } else {
    state.starting = -1;
  }
});

export const isValidLocation = (treeHeight: number, x: number, y: number) => {
  return !(x < 0 || y < 0 || x > y || y > treeHeight - 1);
};

export const pick = system.when('pick', z.object({ x: z.number().min(0), y: z.number().min(0) }), (state, dispatcher, payload) => {
  if (!isValidLocation(state.tree.length, payload.x, payload.y)) {
    return;
  }
  const score = state.tree[payload.y][payload.x];
  if (state.phase === 'lobby' || state.turn !== dispatcher || !isPickable(state.tree, payload.x, payload.y) || score === undefined) {
    return;
  }
  state.tree[payload.y][payload.x] = undefined;
  if (score === '🎁') {
    const tryPlace = (x: number, y: number, value: number) => {
      if (isValidLocation(state.tree.length, x, y)) {
        const oldValue = state.tree[y][x];
        if (typeof oldValue !== 'string') {
          state.tree[y][x] = (oldValue ?? 0) + value;
        }
      }
    };
    tryPlace(payload.x - 1, payload.y, 1);
    tryPlace(payload.x + 1, payload.y, 1);
    tryPlace(payload.x, payload.y - 1, 1);
    tryPlace(payload.x - 1, payload.y - 1, 1);
    state.scores[dispatcher] += 3;
    return;
  }
  state.scores[dispatcher] += score;
  state.turn = state.players[(state.players.indexOf(dispatcher) + 1) % state.players.length];

  if (state.tree.every((row) => row.every((block) => block === undefined))) {
    console.info('[INFO] finished with', Object.keys(state.scores).map((username) => ({ username, score: state.scores[username] })));
    state.phase = 'finished';
    state.spectators.push(...state.players);
    state.players = [];
  }
});

export const actions = [tick, joiner, leaver, ready, pick] as const;
