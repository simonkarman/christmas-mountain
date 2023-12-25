export * from './utils/system';
export * from './system';

import { actions, system } from './system';
import { System } from './utils/system';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExtractReturnTypes<T extends readonly ((i: any) => any)[]> = [
  ... {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in keyof T]: T[K] extends ((i: any) => infer R) ? R : never
  }
][number];
// export type Action = typeof actions extends (infer T extends (...any: any) => any)[] ? ReturnType<T> : never;
export type Action = ExtractReturnTypes<typeof actions>;
export type SystemState = typeof system extends System<infer X> ? X : never;
