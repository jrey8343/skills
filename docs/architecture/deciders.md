# deciders

## What it does

Writes event-sourced domain logic as Deciders: a pure `decide(command, state) → events`, a pure `evolve(state, event) → state` and an initial state for each consistency boundary. Its defining constraint is the hard line between the Decider and the shell: every domain rule lives in `decide`, and loading, appending, concurrency, projections and messaging live in a thin shell that never branches on a rule. It stays neutral about the repo's folder layout, which comes from the repo's own `CODING_STANDARDS.md`.

## When to reach for it

The agent reaches for it on its own when you write or change event-sourced code, add a command or event to an existing Decider, or ask where some logic belongs (in the Decider, a projection or a policy). You can also name it.

Reach for [event-storming](event-storming.md) instead when the boundaries themselves aren't known yet: storming finds the commands, events and contexts; this skill turns them into code. For the test-first loop itself, it hands off to Matt's `tdd`; for naming a new event or recording a new boundary, to Matt's `domain-modeling`.

## Prerequisites

None required. It reads, when present:

- `CODING_STANDARDS.md` for where Deciders, their tests and the test helper go. Without it, the skill says so and keeps each Decider in one module beside the code that uses it.
- `docs/agents/domain.md` and the glossary it points to, for event and command names.
- A storm doc from `event-storming`, for candidate Deciders. Without one, it derives the candidates from the spec or conversation and confirms them with you.

## The shape

Three pure parts per boundary. `decide` takes a command (which carries `now`, ids and any looked-up facts as data) and the current state, and returns the events that record what happened, an empty list for an idempotent repeat, or a typed rejection. `evolve` folds one event into state and never refuses, since the event already happened. Current state is always the fold of the stream's events.

## Given, when, then

Every test reads: given these past events, when this command arrives, then these events (or this rejection). Tests never build state by hand and never touch a store, so they run fast and cover every invariant, every rejection reason, idempotent repeats and the empty stream. The test names read as the boundary's rulebook.

## Where the Decider stops

The shell owns the event store (load a stream, append at an expected version, retry on conflict), snapshots and upcasting, projections (their own folds over stored events, never fed back into `decide`), and the outbox and policies that tell other boundaries and outside systems. A rule that spans two boundaries becomes a policy and is eventually consistent; a rule that must hold atomically means one Decider.

## Common questions

**Do I need an event store to use it?** No. A state-stored shell can run `decide`, fold the result through `evolve` and save the state. The skill asks you to record that choice per boundary as an ADR.

**Is every module a Decider now?** No. CRUD with no invariants, read models and scripts don't need one, and the skill says so.

## It's working if

- Domain rules appear only inside `decide`; route handlers and projections have no domain conditionals.
- `decide` and `evolve` have no awaits, clock reads or store calls.
- Every rejection reason has a given / when / then test, and no test constructs state directly.
- Appends carry an expected version, and messages to other systems go out after the events are stored.
- New event names match glossary terms, and new boundaries have an ADR.

## Where it fits

A standalone reference the agent applies while writing code, usually after a storming session. Upstream: [event-storming](event-storming.md) hands it candidate Deciders. Alongside: Matt's `tdd` runs the test loop, `domain-modeling` records names and ADRs, and `codebase-design` supplies the deep-module vocabulary for the shell's seams.
