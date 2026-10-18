# grill-with-docs

## What it does

`grill-with-docs` interviews you about a plan or design until you and the agent share one understanding of it, and settles the vocabulary and the hard decisions as it goes. It is the same interview [grill-me](../productivity/grill-me.md) runs (a round of questions, then wait, then the next round), pointed at a codebase.

It is **stateful**. Every other grilling skill leaves the session in your head; this one produces artifacts — a glossary term, an ADR — that outlive the conversation. What it does *not* do is write them into the checkout you are sitting in. Each settled term is stated in the conversation the moment it resolves, then handed to a **carrier** (the spec, the ticket, or the conversation itself) that takes it to the worktree which applies it, so the word lands in the same PR as the code that uses it. Design in your root checkout and `git status` stays clean the whole way through.

## When to reach for it

You invoke this by typing `/grill-with-docs`, and the agent won't reach for it on its own.

Reach for it at the start of a change, in a repo, when the plan is still fuzzy and the words for the thing are not settled yet. It is the single-session tool. Which grilling skill you want depends on what is in front of you:

| What you have | Reach for |
| --- | --- |
| You aren't working in a working directory at all | [grill-me](../productivity/grill-me.md) |
| A repo, and a change you can settle in one session | `grill-with-docs` |
| An effort too big to hold in one session (a greenfield build, a large feature) | [wayfinder](wayfinder.md) |
| A repo with no domain docs at all, and no particular feature in mind | `grill-with-docs`, aimed at the repo rather than a change |

The wayfinder split comes down to session count: `/grill-with-docs` for single-session planning, `/wayfinder` for multi-session planning.

## Prerequisites

A repo, and nothing else. The session itself writes no files, so it is safe to run from the checkout you keep open. Terms eventually land in `GLOSSARY.md` at the root, or in the relevant context's `GLOSSARY.md` if a `GLOSSARY-MAP.md` at the root marks the repo as multi-context; decisions land in `docs/adr/`. Both are created lazily, in the worktree that applies them, so you set up nothing in advance.

It also needs two other skills present, because its own `SKILL.md` is one line that delegates to them. [grilling](../productivity/grilling.md) supplies the interview, and [domain-modeling](domain-modeling.md) supplies the writing. Installing `grill-with-docs` alone gets you a skill that does not work.

## The paper trail

Three things come out of a session, and they are not equal.

| What resolved | Where it lands |
| --- | --- |
| A term: the project's own word for a thing | Stated the moment it resolves, carried to `GLOSSARY.md` by the spec, the ticket, or the conversation |
| A decision that is hard to reverse, surprising without context, and a real trade-off | An ADR under `docs/adr/`, by the same route — or its own docs-only PR when the decision is the whole deliverable |
| Everything else you decided | The conversation, and nowhere else |

When the frontier empties, the session closes by listing every **pending** entry and naming its carrier, so nothing resolved is left without a route out. If work follows, that route is [to-spec](to-spec.md): it copies the entries into the spec's `## Model changes` section verbatim, [to-tickets](to-tickets.md) hands each one to the ticket whose slice uses it, and [implement](implement.md) applying them is part of its definition of done, checked by [review-changes](review-changes.md).

That third row is the one that catches people out. `GLOSSARY.md` is only a glossary. It holds no implementation details, no spec, and no scratch notes. An ADR needs all three conditions at once, so most decisions do not qualify and most sessions produce none. A session that yields a sharper glossary and zero ADRs is working as designed, but it means most of what you agreed exists only in the context window you agreed it in. Hand that same conversation to [to-spec](to-spec.md) rather than clearing it.

The glossary is the main output. This skill builds domain language: the project's own words, agreed once, so you, the agent and your colleagues do not have to work them out again. Not everyone agrees that this improves agent performance. The strongest objection is that a term and its plain-English expansion get the same result from the model, and that the vocabulary mainly shortens communication between the humans who share it. On that view the glossary is still valuable, but the value goes to the humans.

## Common questions

**Should I use this or `/wayfinder`?**
Scope decides it. Use this for anything you can settle in one session; use [wayfinder](wayfinder.md) when the effort is too big to hold in one, and it charts the work as a map of decision tickets first. Wayfinder is slower and denser, and reaching for it on a well-scoped feature is the common mistake. It does not replace this skill, and it can start a grilling session for the parts of the map that suit one.

**It ran, but no `GLOSSARY.md` and no ADRs appeared.**
From your main checkout, that is the design: the session writes nothing, and the files change in the worktree that applies the carrier. What should appear is each settled entry, read back to you in the conversation, and a closing list naming its carrier. If *that* is missing too, there are three causes. Nothing qualified: ADRs need all three gates, and a session about a change with no new vocabulary has nothing to settle. Or [domain-modeling](domain-modeling.md) never loaded (see the next question). Or a known bug: inside another orchestration layer (a spec-driven-development wrapper, a multi-agent framework, a rule that invokes it as a step in someone else's pipeline), users report the artifact half silently not happening while the interview still runs. The bug is filed and unfixed.

**I wanted the glossary change on disk now, in this checkout.**
Say so, and the agent writes it where you are — the rule yields to an explicit instruction, the same way [worktree](worktree.md) does. Worth knowing what you give up: a term written into your root checkout is an untracked edit that no PR carries, and the next session that starts a worktree from `origin/main` will not see it.

**It asked everything at once, with no recommendations, and never mentioned `GLOSSARY.md`.**
That is the skill failing to load its two dependencies. Because `SKILL.md` is a one-line delegation, an agent that does not pick up [grilling](../productivity/grilling.md) and [domain-modeling](domain-modeling.md) guesses at what grilling means, and you get every question at once with no structure. Partial loading is more confusing. `grilling` loads, `domain-modeling` does not, and you get a good interview with no paper trail. How often it happens depends on the model and the effort level, and it is the most reported problem with this skill. If you suspect it, ask the agent directly which skills it loaded.

**Where did all my other decisions go?**
Into the conversation only. This is the most serious open complaint about the skill. The glossary is not a spec, most answers do not earn an ADR, and no record links each resolved answer to a spec, a ticket and a test. Later steps soften precise answers (ordering guarantees, negative requirements, numeric defaults) into weaker prose, and the result can look complete while missing the thing you decided. For now, keep the session and feed it straight to [to-spec](to-spec.md). Then re-read the spec against your own answers rather than assuming it captured them.

**Can I point it at an existing repo that has no docs at all?**
Yes. This is the right skill for a codebase with no ADRs, no domain language and no design principles: invoke it and say "help me document my repo". Users often pair it with [improve-codebase-architecture](../audits/improve-codebase-architecture.md) for building or repairing a `GLOSSARY.md`. Expect to steer it. It reads code and asks you about what it finds, and you decide which of the words already in the codebase are the right ones.

**What should I do when the session ends?**
The closing message now tells you: it lists what the session settled and names the carrier for each entry. In the main flow that means [to-spec](to-spec.md), in the same conversation. If the change is small enough to build immediately, go straight to [implement](implement.md), which reads the entries from the conversation. If the decision was the whole point and no code follows, take the docs-only PR it offers.

**Why is it called that?**
Nobody is happy with the name. There is an open suggestion to rename it `grill-domain-model`, which describes the behaviour more accurately. Nothing has moved on it. If a rename ever lands, the docs page moves with it and the URL changes.

## It's working if

- Terms arrive *during* the session, one at a time, each read back to you in full, rather than appearing in one lump at the end.
- `git status` in your root checkout is clean when the session ends, and the closing message names a carrier for every entry.
- The entries read as pure vocabulary (your project's words with tight definitions) and carry no implementation detail or spec-like prose.
- Questions the codebase can answer get answered by reading the codebase, not asked of you.
- You get few or no ADRs, and the ones you get are decisions you would be annoyed to have to argue again.
- It challenges a word you used because your existing glossary defines it differently.

## Where it fits

`grill-with-docs` is the head of the main build chain:

```txt
grill-with-docs → to-spec → to-tickets → implement → review-changes → pr
```

It comes before anything is written down as a spec. It produces the shared understanding and settled vocabulary that [to-spec](to-spec.md) then synthesises without interviewing you again. Its close neighbours are [grill-me](../productivity/grill-me.md), the same interview with no repo and no files, and [domain-modeling](domain-modeling.md), the glossary-and-ADR discipline it drives; both use the [grilling](../productivity/grilling.md) primitive for the interview. For a repo with no domain or product docs at all, [discover-domain](../setup/discover-domain.md) drafts the glossary, `PRODUCT.md` and avatars from the code first. Upstream of it, [wayfinder](wayfinder.md) charts efforts too large for one session and can hand parts of the map back down to it. When you're unsure which skill or flow fits, [which-skill](../productivity/which-skill.md) routes you.
