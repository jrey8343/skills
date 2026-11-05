---
name: deciders
description: "Write event-sourced domain logic as Deciders: pure decide(command, state) → events and evolve(state, event) → state functions with an initial state, tested given events / when command / then events, and met by a thin shell that loads, appends and projects. Use when writing or changing event-sourced code, turning candidate Deciders from an event storm into code, adding a command or event to an existing Decider, or deciding where domain logic stops and the event store, projections or outbox begin."
---

# Deciders

A **Decider** is the whole of one consistency boundary's domain logic, as three pure parts:

```ts
type Decider<Command, Event, State, Rejection> = {
  initialState: State;
  decide: (command: Command, state: State) => Event[] | Rejection; // what happens now
  evolve: (state: State, event: Event) => State;                   // what it did to the state
};
```

`decide` answers "given everything that happened, what happens next?". `evolve` answers "what does this fact change?". Define the generic `Decider` type once per repo (where `CODING_STANDARDS.md` puts shared types; beside the first Decider otherwise). Each Decider has its own `Rejection` union of refusal reasons, and a `Rejection` is never an array, so an event list and a refusal cannot be confused. Current state is never stored by the Decider: it is `events.reduce(evolve, initialState)`. Everything else (loading, appending, concurrency, projections, sending messages) is the **shell**, and the shell holds no domain rule.

Examples here are TypeScript. The shape carries to any language: three functions, data in and data out.

## The rules

- **Pure.** `decide` and `evolve` do no I/O and read no clock, randomness or environment. A command carries `now`, generated ids and any looked-up facts it needs as data.
- **Events are facts, past tense, named in the domain's words** (`TaskAssigned`, not `SetAssignee` or `TaskUpdated`). Commands are imperative (`AssignTask`). Take names from the repo's glossary (see `docs/agents/domain.md`); a missing term is a domain-modeling question, so Call the Skill tool with `domain-modeling` before inventing one.
- **`decide` enforces every invariant.** It returns the events that record the outcome, or a typed rejection for an expected refusal. It throws only for bugs. An empty event list means "nothing to do" (an idempotent repeat), which is not the same as a rejection.
- **`evolve` never refuses.** An event already happened; `evolve` records it. No validation, no branching on whether it is allowed, and it must handle every current event type; old versions reach it already upcast by the shell (see [SHELL.md](SHELL.md)).
- **State holds only what `decide` needs.** It is not a read model. Anything only a screen or a report needs belongs in a projection.
- **One Decider per consistency boundary.** A rule that must hold atomically lives in one Decider. A rule that spans two boundaries is a policy in the shell (react to an event, send a command), and it is eventually consistent. Say so in the code where it happens.
- **Exhaustive.** Switch on every command and event union with a `satisfies never` (or the language's equivalent) default, so a new case cannot be silently ignored.

## Workflow

1. **Read the repo's own rules.** If `CODING_STANDARDS.md` exists at the root, take the folder layout, test placement, assertion helper and naming from it. If it is absent, say so, put the Decider beside the code that uses it, and keep the three parts in one module. Never invent a layout this skill does not own.
2. **Get the candidates.** Use the candidate Deciders handed over from an `event-storming` session when there is one, or derive them from the spec, issue or conversation. [CANDIDATES.md](CANDIDATES.md) gives the shape and how to fill it without a storm.
3. **Write the types first:** the command union, the event union, the state, the rejection reasons. Show them to the user before the logic when the boundary is new; the types are the design.
4. **Test, then implement.** Write the given / when / then cases from [TESTING.md](TESTING.md), one per invariant and one per rejection, then make them pass. To drive this test-first, Call the Skill tool with `tdd`; the given / when / then shape is the test, and `tdd` runs the loop.
5. **Wire the shell.** Load, fold, decide, append with an expected version, then project and publish from the stored events. [SHELL.md](SHELL.md) says where the Decider stops and each shell piece starts.
6. **Record what changed.** A new event type, a renamed one or a new boundary changes the domain model: Call the Skill tool with `domain-modeling` and write the glossary term or ADR in place.

## Changing an existing Decider

- **New command:** add it to the union, add its `decide` branch and its tests. Prefer emitting existing events when they mean the same fact.
- **New event:** add it to the union and to `evolve`, then check every projection and policy that switches on the stream.
- **Changed event shape:** events in the store are immutable. Add a new version and upcast old ones on read (see [SHELL.md](SHELL.md)); never rewrite history in place.
- **Split or merge boundaries:** this is a model change, not a refactor. Raise it with the user, then Call the Skill tool with `domain-modeling` to record it as an ADR before moving code.

## When not to use a Decider

A Decider earns its keep where commands are refused for domain reasons and history matters. Plain CRUD with no invariants, a pure read model, or a one-off script does not need one. The shape also works without event sourcing: a state-stored shell runs `decide`, folds the resulting events through `evolve` and saves the new state. Choose which shell per boundary and record the choice as an ADR.

## Reference files

- [CANDIDATES.md](CANDIDATES.md): the candidate Decider shape, from a storm or without one.
- [TESTING.md](TESTING.md): the given / when / then test shape, with a worked example.
- [SHELL.md](SHELL.md): where the Decider stops and the store, projections and outbox start.
