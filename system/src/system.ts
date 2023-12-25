import { z } from 'zod';
import { System } from './utils/system';
export const ROOT_DISPATCHER = '<ROOT_DISPATCHER>';

export type Phase = 'lobby' | 'playing' | 'finished';

export const system = new System({
  tick: 0,

  phase: 'lobby' as Phase,
  starting: -1,
  lobby: {} as { [name: string]: { isReady: boolean } },
  spectators: [] as string[],

  players: [] as string[],
  turn: undefined as (undefined | string),
  // mountain: [
  //   [1],
  //   [2, 3],
  //   [4, 5, 6],
  //   [7, 8, 9, 10],
  // ] as ((number | undefined)[])[],
});

export const tick = system.when('tick', z.number().positive().int(), (state, dispatcher, payload) => {
  if (dispatcher !== ROOT_DISPATCHER) {
    return;
  }
  state.tick = payload;
  if (state.starting > 0 && state.tick >= state.starting) {
    state.phase = 'playing';
    state.players = Object.keys(state.lobby);
    state.turn = state.players[0];
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
    } else {
      console.warn('[WARN] a player left');
    }
  }
});

export const ready = system.when('ready', z.boolean(), (state, dispatcher, payload) => {
  if (state.phase !== 'lobby') {
    return;
  }
  state.lobby[dispatcher].isReady = payload;
  if (Object.keys(state.lobby).every((username) => state.lobby[username].isReady)) {
    state.starting = state.tick + 10;
  } else {
    state.starting = -1;
  }
});

export const actions = [tick, joiner, leaver, ready] as const;
