import { produce } from 'immer';
import { z, ZodAny, ZodAnyDef, ZodType, ZodUndefined } from 'zod';
import { createHash } from 'crypto';

type Subscription<State> = (state: State) => void;

/**
 * A system represents a typesafe state and events that be dispatched to alter the state. The type safety is guaranteed using Zod schemas for the
 *  payload of the events. An Immer is used to safely update the state.
 *
 * Example usage
 * ```ts
 * const system = new System({ counter: 0 });
 * system.onChange((state) => {
 *   console.info(state);
 * });
 * const increment = system.when('increment', z.number(), (state, dispatcher, payload) => {
 *   if (dispatcher === 'admin') {
 *     state.counter += payload;
 *   }
 * });
 * system.dispatch('admin', increment(3));
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class System<State extends Record<string, any>> {
  private actionDefinitions: {
    [type: string]: {
      payloadSchema: ZodAny
      handler: <T extends State>(state: T, dispatcher: string, payload: ZodAnyDef) => T | void, // TODO: what if the handler fails?
    }
  } = {};

  public readonly initialState: State;

  private sourceState: State;
  private subscriptions: Subscription<State>[] = [];

  private optimisticEvents: { hash: string, dispatcher: string, message: { type: string, payload: unknown }, timestamp: number }[] = [];
  private optimisticState: State;
  private optimisticSubscriptions: Subscription<State>[] = [];

  /**
   * The number of seconds an optimistic dispatched event should be kept in memory. If it is not verified before this time, the message will be pruned
   *  and the optimistic state will no longer reflect the expired event.
   */
  public optimisticSeconds = 10;

  /**
   * Create a new system by providing the initial state.
   *
   * @param initialState An object shaped in any form representing the state of the system.
   */
  constructor(initialState: State) {
    this.initialState = initialState;
    this.sourceState = initialState;
    this.optimisticState = this.sourceState;
  }

  /**
   * Resets the state to the initial state and clears out any optimistic events.
   */
  reset(): void {
    // hard reset state to initial state
    this.sourceState = this.initialState;

    // flush all optimistic events
    this.optimisticEvents = [];
    this.optimisticState = this.sourceState;

    // publish reset to subscribers
    [ ...this.subscriptions,
      ...this.optimisticSubscriptions,
    ].forEach(subscription => subscription(this.sourceState));
  }

  /**
   * Adds a new handler for when a specific type of message is dispatched.
   *
   * @param type The identifier of the event. This must be unique for this system. For example: 'increment'
   * @param payloadSchema The Zod schema to use for the payload of the message. For example z.number().min(1).max(5)
   * @param handler The handler that will apply the payload to the state. This method receives the state, the dispatcher, and the payload. You can
   *  manipulate the state directly (supported by Immer) or return a new state object from the function.
   *
   * @returns Returns a constructor for creating type safe messages.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  when<Type extends string, PayloadSchema extends ZodType<any, any, any>>(
    type: Type,
    payloadSchema: PayloadSchema,
    handler: (state: State, dispatcher: string, payload: z.infer<PayloadSchema>) => State | void,
  ):
    PayloadSchema extends ZodUndefined
      ? () => { type: Type, payload: undefined }
      : (payload: z.infer<PayloadSchema>) => { type: Type, payload: z.infer<PayloadSchema> }
  {
    if (this.actionDefinitions[type] !== undefined) {
      throw new Error(`message type ${type} is already in use`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.actionDefinitions[type] = { payloadSchema, handler } as any;

    // @ts-expect-error as payload parameter could be undefined
    return (payload) => ({ type, payload });
  }

  /**
   * Dispatches an event to the system. An event has two components: the dispatcher and the message.
   *
   * First, the message of the event is parsed. This is done by comparing the payload of the message with the schema that corresponds to the type. If
   *  the event type is not known to this system or the event cannot be parsed according to the schema, then this method will return a ZodError;
   *
   * Then, the message is applied to the state by invoking the handler corresponding to the message type.
   *
   * @param dispatcher The name or identifier of the entity by which this event was dispatched, which can be referenced in the handler
   * @param message The message (type and payload) to dispatch
   * @param isOptimistic Optionally, provides whether this is an optimistic dispatch. Default is `false`. If `true`, then only the optimistic state is
   *  altered. Until the same event is verified (dispatched with isOptimistic set to false), the update will only be reflected in the optimistic
   *  state. If the event is not verified before `System.optimisticSeconds` time has passed, the event is discarded and also removed from the
   *  optimistic state.
   *
   * @return boolean | z.ZodError Returns `true` if the message successfully dispatched. Returns `false` when the message type does not exist.
   *  Returns a ZodError if the message payload doesn't match the corresponding payload schema.
   */
  dispatch(dispatcher: string, message: { type: string, payload?: unknown }, isOptimistic: boolean = false): boolean | z.ZodError {
    const generateHashOfEvent = () => {
      const hash = createHash('sha256');
      hash.update(JSON.stringify({ dispatcher, message }));
      return hash.digest('hex');
    };

    // get the action definition corresponding to the dispatched message
    const actionDefinition = this.actionDefinitions[message.type];
    if (actionDefinition === undefined) {
      return false;
    }

    // verify the payload is valid based on the schema of the action definition for this message
    const payload = actionDefinition.payloadSchema.safeParse(message.payload);
    if (!payload.success) {
      return payload.error;
    }

    // first, we can prune all optimistic updates that are too old and are thus no longer relevant
    const now = Date.now();
    this.optimisticEvents = this.optimisticEvents.filter(event => now < event.timestamp);

    if (isOptimistic) {
      // if optimistic -- this state change might happen in the future

      // so, leave the source state as is and only update the optimistic state
      this.optimisticState = produce(this.optimisticState, (_state: State) => {
        return actionDefinition.handler(_state, dispatcher, payload.data);
      });

      // and save the dispatched event in a list for future reference
      const MILLISECONDS_IN_ONE_SECOND = 1000;
      this.optimisticEvents.push({
        hash: generateHashOfEvent(),
        dispatcher,
        message: { type: message.type, payload: payload.data },
        timestamp: Date.now() + (MILLISECONDS_IN_ONE_SECOND * this.optimisticSeconds),
      });
    } else {
      // if non-optimistic -- this state change has been verified to actually happen

      // so, let's apply it to the source state (and reset the optimistic state to it)
      this.sourceState = produce(this.sourceState, (_state: State) => {
        return actionDefinition.handler(_state, dispatcher, payload.data);
      });
      this.optimisticState = this.sourceState;

      // and broadcast changes to the source state
      this.subscriptions.forEach(subscription => {
        subscription(this.sourceState);
      });

      // now, if there are any optimistic updates ...
      if (this.optimisticEvents.length > 0) {

        // if the event we just applied to the source state is in the optimistic list, remove it, as it has actually happened!
        const _hash = generateHashOfEvent();
        const index = this.optimisticEvents.findIndex(event => event.hash === _hash);
        if (index !== -1) {
          this.optimisticEvents.splice(index, 1);
        }

        // but, do replay the remaining optimistic events as we're still expecting these to happen in the future since they haven't expired
        this.optimisticEvents.forEach(event => {
          this.optimisticState = produce(this.optimisticState, (_state: State) => {
            return this.actionDefinitions[event.message.type].handler(_state, event.dispatcher, event.message.payload as ZodAnyDef);
          });
        });
      }
    }

    // finally, as the optimistic state always changes, we should always broadcast to the optimistic subscriptions after each dispatch
    this.optimisticSubscriptions.forEach(subscription => {
      subscription(this.optimisticState);
    });

    return true;
  }

  /**
   * Subscribe with a callback to this system. Any time the state changes, the callback is invoked with the new state.
   *
   * @param subscription The subscription callback that will be invoked with the new state any time that it changes.
   */
  onChange(subscription: Subscription<State>): void {
    this.subscriptions.push(subscription);
  }

  /**
   * Subscribe with a callback to the optimistic state of this system. Any time the optimistic state changes, the callback is invoked with the new
   *  optimistic state.
   *
   * @param subscription The subscription callback that will be invoked with the new optimistic state any time that it changes.
   */
  onOptimisticChange(subscription: Subscription<State>): void {
    this.optimisticSubscriptions.push(subscription);
  }

  /**
   * Flush any optimistic state and reset the optimistic state to the source state.
   */
  flushOptimisticState(): void {
    // nothing to flush, end early
    if (this.optimisticEvents.length === 0) {
      return;
    }

    // flush all optimistic events
    this.optimisticEvents = [];
    this.optimisticState = this.sourceState;

    // broadcast to the optimistic subscriptions
    this.optimisticSubscriptions.forEach(subscription => subscription(this.optimisticState));
  }

  /**
   * Flush any expired optimistic state.
   */
  flushExpiredOptimisticState(): void {
    // first, we can prune all optimistic updates that are too old and are thus no longer relevant
    const beforeCount = this.optimisticEvents.length;
    const now = Date.now();
    this.optimisticEvents = this.optimisticEvents.filter(event => now < event.timestamp);

    // if nothing was pruned, end early
    if (this.optimisticEvents.length === beforeCount) {
      return;
    }

    // reset the optimistic state
    this.optimisticState = this.sourceState;

    // replay the remaining optimistic events as we're still expecting these to happen in the future since they haven't expired
    this.optimisticEvents.forEach(event => {
      this.optimisticState = produce(this.optimisticState, (_state: State) => {
        return this.actionDefinitions[event.message.type].handler(_state, event.dispatcher, event.message.payload as ZodAnyDef);
      });
    });

    // broadcast to the optimistic subscriptions
    this.optimisticSubscriptions.forEach(subscription => subscription(this.optimisticState));
  }
}
