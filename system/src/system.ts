import { z } from 'zod';
import { System } from './utils/system';
export const ROOT_DISPATCHER = '<ROOT_DISPATCHER>';

export const system = new System({ counter: 0, joiners: [] as string[] });
export const joiner = system.when('joiner', z.string().min(3), (state, dispatcher, payload) => {
  if (dispatcher === ROOT_DISPATCHER) {
    if (state.joiners.indexOf(payload) === -1) {
      state.joiners.push(payload);
    }
  }
});

export const increment = system.when('increment', z.number().min(1), (state, _, payload) => {
  state.counter += payload;
});
export const decrement = system.when('decrement', z.number().min(1), (state, _, payload) => {
  state.counter -= payload;
});

export const actions = [joiner, increment, decrement] as const;
