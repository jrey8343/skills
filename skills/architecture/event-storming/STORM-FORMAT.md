# Storm doc format

One storm doc per area (or one for the big picture). It reads straight off the agreed rounds: nothing in it should be new to the user. Terms link to the glossary rather than being defined here; types are named, never defined.

Sections in this order. Omit a section that is still empty, except **Open questions**, which says "None" when there are none.

```md
# <Area> storm

<One paragraph: what this storm covers, its level (big picture or process), and
when it was held. Link the glossary and the context map.>

## Conventions

- **Names:** <the naming rule agreed in round 1>.
- **Origins:** <decision, observed, and any third origin, each with its marker>.
- **Markers:** <any per-event marker and what it means>.

## Timeline

Grouped by bounded context once the boundaries round has run; by area before.
Pivotal events in bold.

### <Context or area>

| Event | Origin | What it records |
|---|---|---|
| **`<PivotalEvent>`** | decision | <one line, in glossary words> |
| `<ExternalThingObserved>` | observed | <one line> |

## Commands, actors and policies

### <Context or area>

| Command | Actor | Decides | Read model it needs |
|---|---|---|---|
| `<Command>` | <role> | `<Event>`, `<Event>` | <read model, or none> |

Policies:

- **Whenever `<Event>`, then `<Command>`.** <why, and what happens if it fails>

## Read models

- **<Name>**: <what it shows, which events build it, who reads it>.

## External systems

- **<Role>**: <what it sends us (observed events) and what we send it>.

## Bounded contexts

<Each context in one line, and the events that cross between them. The context
map itself lives in GLOSSARY-MAP.md, written through domain-modeling; this
section links to it and records the splits the storm decided, with why.>

## Workflows

Only for the contexts or process the depth rounds covered.

### <Context>: <workflow name>

- **Trigger:** <who or what starts it, from where>.
- **Command:** `<Command>`.
- **Inputs:** <what it carries, by type name where a type exists>.
- **Dependencies:** <state or read models it needs, permissions, other systems>.
- **Output events:** `<Event>`, ….
- **Errors:** <each refusal, in glossary words>.
- **Side effects:** <messages, sends, anything outside the event log>.

## Candidate Deciders

One entry per group of commands that must see each other's events to keep an
invariant. This is the hand-off to the deciders skill; it is a candidate, not a
design.

### <Decider name, a glossary term>

- **Stream key:** <what identifies one instance: an id, or a pair of ids>.
- **Commands:** `<Command>` (<actor>), ….
- **Events:** `<Event>`, …. Every command reaches one of these or an error.
- **Invariants:** <each rule that must hold atomically inside this boundary>.
- **Policies out:** whenever `<Event>`, then `<Command>` on another boundary.
- **Open questions:** <numbers from Open questions that touch it, or none>.

## Open questions

Every hot spot not settled in the session.

| # | Question | What the oracle says | Who can answer | Blocks |
|---|---|---|---|---|
| 1 | <the question> | <what the code, legacy or issues show> | <role> | <workflow or Decider, or nothing> |

## Settled

Hot spots answered during the storm, one line each with where the answer
went (glossary term, ADR, workflow), so the reasoning isn't lost.
```

## Notes

- **Open questions are never deleted silently.** When one is answered, move it to **Settled** with where the answer went.
- **Splitting.** When one context's workflows outgrow the doc, move that context's **Workflows** and **Candidate Deciders** to their own doc beside it (`<storm-doc-folder>/<context>.md`) and link it from **Bounded contexts**. The timeline stays in one place.
- **Updating.** A later storm of the same area edits this doc in place: new events into the timeline, new rounds' decisions into their sections. It doesn't append a second copy.
