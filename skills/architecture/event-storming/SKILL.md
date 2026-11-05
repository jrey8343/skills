---
name: event-storming
description: Run a facilitated event-storming session with the user, from domain events on a timeline to bounded contexts, glossary terms and candidate Deciders, written into a storm doc in the repo.
disable-model-invocation: true
argument-hint: "[big-picture | process] [area]"
---

# Event Storming

A storm is a conversation, held in small rounds, that puts a part of the system on a timeline as domain events, then adds what causes them and what reacts to them, until the boundaries show. You facilitate; the user decides. **You never storm alone:** every sticky you place is a proposal the user accepts or corrects.

One session produces two things:

- **A storm doc** in the repo, in the format in [STORM-FORMAT.md](STORM-FORMAT.md).
- **Glossary terms**, written through Matt's `domain-modeling` the moment each one settles, along with any context map change and any ADR the storm earns.

The sticky types and naming conventions are in [STICKIES.md](STICKIES.md).

## When to storm, and when not

Storm when:

- **A new bounded context**, or a product or area with no events written down yet.
- **A confusing area**: the code, the backlog and the people disagree about what happens, the same word means two things, or bugs keep landing in the same place.
- **Before specifying a process** that crosses actors, time or another system, so the spec starts from agreed events.

Don't storm when:

- **The change is bounded inside a known context**: its events, terms and Decider already exist. Write the spec (tell the user to run `/to-spec`) or the code.
- **The question is one word.** Sharpening a single term is `domain-modeling` on its own.
- **The question is code shape** (where a seam goes, how deep a module is). That is Matt's `codebase-design`.

If the request falls on the "don't" side, say so in one line and offer the lighter path. Storm anyway if the user insists.

## Pick the level

- **Big picture** (`big-picture`): the whole product, or a large area of it. Breadth first; depth only for the contexts the user names.
- **Process** (`process <area>`): one process in one area, usually before its spec. Short breadth, then depth on that process.

With no argument, ask which, proposing the one the repo suggests: big picture if no storm doc exists yet, process if one does and the area is in it.

## Before round 1

1. Call the Skill tool with `domain-modeling`. It owns `GLOSSARY.md`, `GLOSSARY-MAP.md` and ADRs (their layout is in `docs/agents/domain.md` when present). Every sticky uses a glossary term or proposes one.
2. Read what the repo already says, skipping what's absent and saying so: the glossary and context map, ADRs, any existing storm docs, `docs/agents/product.md` (and the `PRODUCT.md`, avatars and journeys it points to), feature docs, and `CODING_STANDARDS.md` for where code and docs live. Nothing here assumes a house style: if `CODING_STANDARDS.md` is absent, don't guess a layout.
3. **Find the oracle**: whatever already behaves, such as existing code, a legacy system, open issues and their specs, or the user's own account. You propose events from the oracle and the user corrects them; that keeps rounds fast. With no oracle, ask the user to tell the story of one real case end to end, and propose from that.
4. **Choose where the storm doc goes.** If `CODING_STANDARDS.md` or `docs/agents/docs-targets.md` names a home for storm docs, use it. Otherwise use `docs/storms/<area>.md` (`docs/storms/big-picture.md` for a big-picture storm), and tell the user. A later storm of the same area updates that doc rather than starting another.

## Rounds

One round is one question to the user: a proposal they can accept, correct or reject in a single reply. Keep rounds small. After each answer, write what was agreed into the storm doc in the same turn, and terms through `domain-modeling` as they settle. Writing straight away is when inconsistencies show up.

1. **Conventions** (first round, before any events). Agree event naming, the event origins the system needs (see [STICKIES.md](STICKIES.md)), and any markers the domain wants on every event (for example, events carrying sensitive data). Settling these first saves renaming later.
2. **Breadth.** One area per round. List the domain events the oracle implies, in time order, each with the behaviour behind it and any hot spots. The area the user knows best goes first.
3. **Causes and reactions.** For the agreed events, add the command that triggers each one and the actor who issues it, the policies that react ("whenever X, then Y"), the read models people or policies decide from, and the external systems involved.
4. **Boundaries.** Mark the pivotal events, where the story changes hands. Propose bounded contexts from the breadth groups; only the splits that need a real decision become their own rounds. Write the contexts and how they relate to `GLOSSARY-MAP.md` through `domain-modeling`.
5. **Depth**, only for the contexts or process the user names. Write each workflow in the form in [STORM-FORMAT.md](STORM-FORMAT.md): trigger, command, inputs, dependencies, output events, errors and side effects. Say the oracle's limits and failure paths out loud inside the workflow; that is where hot spots nobody filed come out.
6. **Candidate Deciders.** Group the commands that must see each other's events to keep an invariant (for example "there is always at least one owner"). Each group is a candidate Decider: its stream key, commands, events, invariants, policies out and the open questions that touch it. Write them in the storm doc's **Candidate Deciders** section.
7. **Close.** Re-read the journeys and the oracle against what was agreed, and name anything the storm *removes*, not only what it adds. List the open questions left, and confirm the doc with the user.

## Rules

- **Hot spots become open questions.** Anything unclear, disputed, risky or assumed goes in the storm doc's **Open questions** as a question with what the oracle says and who can answer it. Never resolve one silently by choosing a reading. When you notice you're assuming, stop and ask, or log it.
- **Questions the user raises mid-round** go into the next round with the oracle's facts, not answered on the spot.
- **Confirm explicitly.** If the user answers only part of a round, ask about the rest next round rather than taking silence as agreement.
- **Check earlier assumptions.** A term or a decision from before the storm (a vendor capability, a narrow definition) gets re-checked when the storm reaches the area it touches.
- **Keep event origins apart.** A *domain event* is a decision this system made; an *observed event* is what an external system did, arriving through an anti-corruption layer; any third origin agreed in the conventions round keeps its own marker. Never mix origins in one name.
- **Data shapes live in code.** The storm may sketch a payload to talk about it, but the storm doc names types and never defines them.
- **No formats of its own** for the glossary, the context map, ADRs or Deciders. Those belong to `domain-modeling` and `deciders`.
- **Stay stack-neutral.** Name no language, broker or database in the storm doc unless the repo's own ADRs already chose one.
- **Commit only if the user asks**; then commit after each round's write.

## Hand-offs

- **Glossary, context map, ADRs:** written through `domain-modeling` during the session, never batched to the end.
- **Candidate Deciders:** in the storm doc. When the user moves on to building one, call the Skill tool with `deciders`; it reads the candidate from the doc.
- **Open questions:** stay in the storm doc until answered. To work through them now, call the Skill tool with `grilling`.
- **A process ready to build:** tell the user to run `/to-spec`, pointing it at the storm doc's workflow.
