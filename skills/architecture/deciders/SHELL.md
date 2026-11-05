# Where the Decider stops and the shell starts

The Decider decides. The shell gathers the inputs, runs the Decider, stores what it decided and tells the rest of the system. The line is simple: **if it needs I/O, a clock or another boundary's data, it is shell.** If it is a domain rule, it is Decider, and the shell must not branch on it.

| Concern | Decider | Shell |
|---|---|---|
| Is this command allowed? | yes | no |
| Which events record the outcome? | yes | no |
| What does an event change in state? | yes (`evolve`) | no |
| Which stream, at which version? | no | yes: load and append |
| Two writers at once | no | yes: expected-version check, then retry |
| `now`, ids, looked-up facts | receives them in the command | supplies them |
| Read models and screens | no | yes: projections |
| Telling other boundaries or systems | no | yes: outbox and policies |
| Old event shapes | handles the current shape | upcasts on read |

## The command handler

One generic function runs any Decider against any store. It is the only place the two meet:

```ts
type EventStore<E> = {
  load(streamId: string): Promise<{ events: E[]; version: number }>;
  append(streamId: string, expectedVersion: number, events: E[]): Promise<{ ok: boolean }>;
};

const appendRetryCountMax = 3;

async function handle<C, E, S, R>(decider: Decider<C, E, S, R>, store: EventStore<E>, streamId: string, command: C) {
  for (let attempt = 1; attempt <= appendRetryCountMax; attempt += 1) {
    const { events, version } = await store.load(streamId);
    const state = events.reduce(decider.evolve, decider.initialState);
    const decision = decider.decide(command, state);
    if (!Array.isArray(decision)) return decision;        // rejection (never an array): nothing stored
    if (decision.length === 0) return decision;           // idempotent: nothing stored
    const appended = await store.append(streamId, version, decision); // fails if version moved
    if (appended.ok) return decision;
  }
  throw new Error(`stream ${streamId}: expected version kept moving after ${appendRetryCountMax} attempts`);
}
```

Gather, decide, act: the handler has one branch per decision variant and none per domain rule. The HTTP route, queue consumer or CLI that calls it builds the command (adding `now` and ids) and maps a rejection to its own response.

## The event store

The store's interface is two operations: `load(streamId)` returns the events and the stream version, and `append(streamId, expectedVersion, events)` writes them atomically or fails because someone else appended first. Any database that can do a conditional insert can back it. Keep its adapter behind that interface, and integration-test the adapter against the repo's real store or its local stand-in.

- **Optimistic concurrency** is the expected version. Never take a lock to protect an invariant; reload and decide again.
- **Snapshots** are a cache of `fold(evolve)` up to a version. Add one only when napkin math says streams are long enough to matter, and keep the events as the source of truth.
- **Upcasting** turns an old event version into the current one on read, before `evolve` sees it. Stored events are never rewritten.

## Projections

A projection is a fold too: `(readModel, event) → readModel`, run by the shell over stored events. It is not part of the Decider and never feeds `decide`. If `decide` needs another boundary's data, the shell looks it up and puts it in the command, and the code says that value may be stale.

Projections can lag. A screen that must show the result of the user's own command reads the decided events returned by the handler, or waits for the projection to reach that version.

## Outbox and policies

Other boundaries and outside systems learn about events from the shell, never from `decide`:

- **Outbox:** the store adapter writes the outbox rows in the same transaction as `append`, deriving each message from an appended event, so the interface and the handler stay unchanged. A relay then sends the unsent rows. That way a stored event is never lost and an unstored one is never sent.
- **Policy** (a process manager when it keeps state): "whenever *event*, then *command*". It subscribes to events, builds the next command and calls the command handler for the other Decider. A policy with its own invariants is itself a Decider over its own stream.
- **Side effects** (email, payment, a third-party call) happen in a policy after the event is stored. When the outside call's result matters, record it as a new event through a command.

## Smells

- **Leaking Decider:** the handler, a route or a projection checks a domain rule.
- **Impure Decider:** `decide` reads the clock, calls the store or awaits anything.
- **Refusing `evolve`:** `evolve` throws or ignores an event because it "should not have happened".
- **Read model in state:** state carries fields only a screen uses.
- **Effect before decision:** a message is sent or money moves before the events are appended.
