# event-storming

## What it does

Runs a facilitated event-storming session with you: domain events on a timeline, then commands, actors, policies, read models and hot spots, ending in bounded contexts, the glossary terms they settle and candidate Deciders. The agent never storms alone. It proposes stickies from whatever already behaves (the code, a legacy system, open issues, or your own walk-through of a real case), you correct them one small round at a time, and each agreed round is written down before the next one starts. It writes no glossary, context map or Decider format of its own: terms go through Matt's `domain-modeling`, and candidate Deciders are handed to [deciders](deciders.md).

## When to reach for it

You type `/event-storming`, optionally with `big-picture` or `process <area>`. The agent never starts a storm by itself.

Reach for it for a new bounded context, a product with no events written down yet, an area where the code, the backlog and the people disagree, or a process that crosses actors, time or another system before you specify it. Don't reach for it for a bounded change inside a context whose events and Decider already exist: write the spec with Matt's `/to-spec`. Sharpening one word is Matt's `domain-modeling` alone. Questions about code shape belong to Matt's `codebase-design`, and building an aggregate's logic belongs to [deciders](deciders.md).

## Prerequisites

None are required. It reads what it finds: `GLOSSARY.md` and `GLOSSARY-MAP.md`, ADRs (laid out by `docs/agents/domain.md` when present), `docs/agents/product.md` and the product docs it points to, existing storm docs, and `CODING_STANDARDS.md` for where docs and code live. It says which ones it skipped.

It writes:

- A storm doc, at the home `CODING_STANDARDS.md` or `docs/agents/docs-targets.md` names, or else `docs/storms/<area>.md` (`docs/storms/big-picture.md` for a big-picture storm).
- Glossary terms, context map changes and any ADRs, all through `domain-modeling`.

## Two levels

- **Big picture**: the whole product or a large area. Breadth first, one area per round, and then boundaries. Depth happens only for the contexts you name.
- **Process**: one process, usually before its spec. A short breadth pass, then that process as a workflow: trigger, command, inputs, dependencies, output events, errors and side effects, in the form Scott Wlaschin uses in *Domain Modeling Made Functional*.

## Hot spots become open questions

Anything disputed, unclear or assumed goes into the storm doc's **Open questions** table. Each row holds the question, what the oracle says, who can answer it and what it blocks. When a question is answered, it moves to **Settled** with a pointer to where the answer was recorded. The agent doesn't resolve a hot spot by quietly picking a reading.

## It's working if

- Each round is one proposal you can accept or correct in one reply, and it comes with the behaviour behind it.
- The storm doc is updated after every round, never in one batch at the end.
- New terms appear in the glossary (`GLOSSARY.md`, or the context's glossary that `GLOSSARY-MAP.md` points to) while you storm, in `domain-modeling`'s format.
- Events are past tense in your glossary's words, and observed events from outside systems are visibly apart from your own decisions.
- Every unresolved hot spot is a row in **Open questions**. None is assumed away in a workflow.
- **Candidate Deciders** names, for each candidate, its stream key, commands, events and the invariants it protects.
- The doc names types and never defines them, and it names no stack your ADRs haven't already chosen.

## Where it fits

A standalone design session, run once for the big picture and again before specifying a cross-cutting process. It comes after the product is modelled ([product-modeling](../product/product-modeling.md)) and before Matt's `to-spec`. It feeds [deciders](deciders.md) with candidates, and Matt's `domain-modeling` with terms and the context map.
