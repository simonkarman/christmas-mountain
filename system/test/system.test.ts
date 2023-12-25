import { z, ZodError } from 'zod';
import { System } from '../src';

const createTestSystem = () => {
  const system = new System({ data: 0 });
  const inc = system.when('inc', z.number(), (state, dispatcher, payload) => {
    state.data += dispatcher.length;
    state.data *= payload;
  });
  const mockSubscription = jest.fn();
  system.onChange(mockSubscription);
  const mockOptimisticSubscription = jest.fn();
  system.onOptimisticChange(mockOptimisticSubscription);
  return { system, mockSubscription, mockOptimisticSubscription, inc };
};

describe('System', () => {
  it('should support basic functionality of when, onChange, and dispatch', () => {
    const { system, mockSubscription, inc } = createTestSystem();
    expect(system.dispatch('root', inc(2))).toBe(true);
    expect(mockSubscription).toHaveBeenCalledWith({ data: 8 });
    expect(system.dispatch('another', inc(3))).toBe(true);
    expect(mockSubscription).toHaveBeenCalledWith({ data: 45 });
  });
  it('should not allow to rebind the same message type twice', () => {
    const { system } = createTestSystem();
    expect(() => system.when('inc', z.string(), (state) => {
      state.data = 0;
    })).toThrow('message type inc is already in use');
  });
  it('should allow using a z.undefined() schema as the payload schema, and constructing an instance of it without providing an argument', () => {
    const system = new System({ data: 0 });
    const und = system.when('undefined', z.undefined(), (state, dispatcher) => {
      state.data += dispatcher.length;
    });
    expect(und()).toEqual({ type: 'undefined' });
  });
  it('should allow using a z.object() schema as the payload schema', () => {
    const system = new System({ data: 0 });
    const obj = system.when('object', z.object({
      hello: z.string(),
      world: z.object({ name: z.string(), age: z.number() }),
    }), (state, _, payload) => {
      state.data = payload.world.age;
    });
    const exampleObject = () => ({ hello: 'hey', world: { name: 'simon', age: 30 } });
    expect(obj(exampleObject())).toEqual({
      type: 'object',
      payload: exampleObject(),
    });
    expect(system.dispatch('root', { type: 'object', payload: {} })).toBeInstanceOf(ZodError);
    expect(system.dispatch('root', { type: 'object', payload: exampleObject() })).toBe(true);
  });
  it('should return false on dispatching an event with an unknown type', () => {
    const { system, mockSubscription } = createTestSystem();
    expect(system.dispatch('root', { type: 'this-does-not-exist', payload: 'irrelevant' })).toBe(false);
    expect(mockSubscription).not.toHaveBeenCalled();
  });
  it('should return the zod error when dispatching an event with a schema mismatch', () => {
    const { system, mockSubscription } = createTestSystem();
    expect(system.dispatch('root', { type: 'inc', payload: 'not-a-number' })).toBeInstanceOf(ZodError);
    expect(mockSubscription).not.toHaveBeenCalled();
  });
  it('should allow a handler to return a new state object instead of manipulating the existing state', () => {
    const system = new System({ reset: false });
    const reset = system.when('reset', z.undefined(), () => ({ reset: true }));
    const mock = jest.fn();
    system.onChange(mock);
    system.dispatch('root', reset());
    expect(mock).toHaveBeenCalledWith({ reset: true });
  });
  it('should allow an event to be dispatched optimistically, only triggering an optimistic update', () => {
    const { system, mockSubscription, mockOptimisticSubscription, inc } = createTestSystem();
    system.dispatch('root', inc(3), true);
    expect(mockSubscription).not.toHaveBeenCalled();
    expect(mockOptimisticSubscription).toHaveBeenCalledWith({ data: 12 });
  });
  it('should allow multiple optimistically dispatched events to stack', () => {
    const { system, mockOptimisticSubscription, inc } = createTestSystem();
    system.dispatch('root', inc(3), true);
    system.dispatch('person', inc(5), true);
    expect(mockOptimisticSubscription).toHaveBeenCalledTimes(2);
    expect(mockOptimisticSubscription).toHaveBeenNthCalledWith(2, { data: 90 });
  });
  it('should reapply optimistically dispatched events after one of the events has been verified', () => {
    const { system, mockSubscription, mockOptimisticSubscription, inc } = createTestSystem();
    system.dispatch('root', inc(3), true);
    system.dispatch('person', inc(5), true);
    system.dispatch('person', inc(5), false);
    expect(mockSubscription).toHaveBeenCalledTimes(1);
    expect(mockSubscription).toHaveBeenCalledWith({ data: 30 });
    expect(mockOptimisticSubscription).toHaveBeenCalledTimes(3);
    expect(mockOptimisticSubscription).toHaveBeenNthCalledWith(3, { data: 102 });
  });
  it('should prune all expired optimistically dispatched events', () => {
    const { system, mockOptimisticSubscription, inc } = createTestSystem();
    system.dispatch('root', inc(4), true);
    system.optimisticSeconds = -1; // immediate expiry for next optimistic events
    system.dispatch('person-a', inc(6), true);
    system.dispatch('person-b', inc(7), true);
    system.dispatch('person', inc(5));
    expect(mockOptimisticSubscription).toHaveBeenCalledTimes(4);
    expect(mockOptimisticSubscription).toHaveBeenNthCalledWith(4, { data: 136 });
  });
  it('should allow to flush all optimistic state', () => {
    const { system, mockOptimisticSubscription, inc } = createTestSystem();
    system.dispatch('root', inc(4), true);
    system.flushOptimisticState();
    expect(mockOptimisticSubscription).toHaveBeenCalledTimes(2);
    expect(mockOptimisticSubscription).toHaveBeenNthCalledWith(2, { data: 0 });
  });
  it('should allow to manually flush all expired optimistic state', () => {
    const { system, mockOptimisticSubscription, inc } = createTestSystem();
    system.optimisticSeconds = -1; // immediate expiry for next optimistic events
    system.dispatch('admin', inc(2), true);
    system.optimisticSeconds = 10;
    system.dispatch('root', inc(6), true);
    system.optimisticSeconds = -1; // immediate expiry for next optimistic events
    system.dispatch('admin', inc(3), true);
    system.flushExpiredOptimisticState();
    expect(mockOptimisticSubscription).toHaveBeenCalledTimes(4);
    expect(mockOptimisticSubscription).toHaveBeenNthCalledWith(4, { data: 24 });
  });
  it('should verify only one event if multiple exact copies of the same event are optimistic', () => {
    const { system, mockOptimisticSubscription, inc } = createTestSystem();
    system.dispatch('person-a', inc(4), true);
    system.dispatch('person-a', inc(4), true);
    system.dispatch('person-a', inc(4));
    expect(mockOptimisticSubscription).toHaveBeenCalledTimes(3);
    expect(mockOptimisticSubscription).toHaveBeenNthCalledWith(3, { data: 160 });
  });
  it('should not broadcast to optimistic subscriptions when nothing was flushed', () => {
    const { system, mockOptimisticSubscription } = createTestSystem();
    system.flushExpiredOptimisticState();
    system.flushOptimisticState();
    expect(mockOptimisticSubscription).not.toHaveBeenCalled();
  });
  it('should not change initial state during usage', () => {
    const { system, inc } = createTestSystem();
    system.dispatch('root', inc(3));
    system.dispatch('admin', inc(4), true);
    expect(system.initialState).toStrictEqual({ data: 0 });
  });
  it('should be able to reset to the initial state', () => {
    const { system, inc, mockSubscription, mockOptimisticSubscription } = createTestSystem();
    system.dispatch('root', inc(3));
    system.dispatch('admin', inc(4), true);
    system.reset();
    expect(mockSubscription).toHaveBeenNthCalledWith(2, { data: 0 });
    expect(mockOptimisticSubscription).toHaveBeenNthCalledWith(3, { data: 0 });
  });
});
