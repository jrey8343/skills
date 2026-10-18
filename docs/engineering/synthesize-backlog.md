# synthesize-backlog

## What it does

`synthesize-backlog` reads every open issue on your tracker at once and finds its **threads**: groups of three or more issues that share one mechanism, where one structural change (a module, a seam, a value type, an invariant asserted at an interface, a harness, a CI check) would resolve all of them or most of each. It writes them up as a ranked HTML report with a landing order and a triage plan. Then, for the threads you pick, it opens one **thread tracker** each: an issue that holds the thread's members as sub-issues.

The defining constraint is that a **topic** is not a thread. "Auth issues" is a topic, and grouping by topic is what any tag cloud does. "Every route re-derives session standing on its own, so revoked sessions slip through the routes that forgot to check" is a thread: one cause in the code, one change that removes it. Each thread is checked against the code twice before it reaches the report. A skeptic tries to refute it, and a fit-checker reads every member issue and rules whether the change fixes it fully, partly or not at all.

## When to reach for it

You invoke this by typing `/synthesize-backlog`, optionally with an area (a label, milestone or search); the agent won't reach for it on its own. It is expensive, so the trigger is a backlog too large to triage one issue at a time, typically after a burst of audits or overnight agent runs has filed dozens of issues.

| What you have | Where to go |
| --- | --- |
| Too many open issues to triage one by one, and a suspicion they overlap | `/synthesize-backlog` |
| A handful of new issues to evaluate | [triage](triage.md) |
| A question about the code's structure, not the backlog | [improve-codebase-architecture](../audits/improve-codebase-architecture.md) |
| One big effort whose route is unclear | [wayfinder](wayfinder.md) |

Run it before a large `/triage` pass, not after: an issue that a thread will close needs no agent brief of its own, and briefs written first may be ones a thread reverses.

## Prerequisites

GitHub issues, with the issue tracker configured by [setup-standards](../setup/setup-standards.md); other trackers aren't supported yet. It needs `gh`, and a git remote with the default branch. It reads `PRODUCT.md`, `GLOSSARY.md`, the ADRs and `CODING_STANDARDS.md` where they exist; ranking is much better with a product model from [discover-domain](../setup/discover-domain.md).

Nothing lands in your working tree. The run directory, with every stage's file and the report, lives in your temp directory, and the code it checks is a detached checkout of the default branch's tip inside that directory, removed when the run ends. Folding threads in is the only step that writes to GitHub, and only for the threads you pick.

## Six lenses, then a skeptic

Each issue is first condensed into a digest whose key field is its **mechanism**: why it happens, in code terms. Six lenses then read every digest, each looking for a different kind of shared cause: architecture, domain invariants, identity and access, runtime robustness, the delivery system (tests, CI, docs and the agents' own process), and product journeys. Agreement between lenses is kept as a signal; a thread three lenses found independently shows three filled dots on its card.

A merge groups the lens threads into candidates. Verification is where most of the value sits. On a 195-issue backlog, the skeptic dropped a thread whose work had already shipped, and another that bundled three unrelated fixes under one name. A completeness critic then places every issue no surviving thread claimed: into a thread it was missed from, or into a list of standalone issues, each with its reason.

## What it costs

Roughly one sub-agent for every two issues, and more on a small backlog, since nine agents run whatever its size. A 195-issue backlog took 105 sub-agents, about two hours and 11M sub-agent tokens, and found 38 threads covering 137 issues, 118 of the 144 that were waiting for triage. It tells you the scale and waits for your go before dispatching anything.

## Common questions

**Does it change any labels?**

Not on its own. Folding in opens thread trackers and attaches sub-issues; it closes nothing, and it asks once before moving reversed briefs back to `needs-triage`.

**What happens on the next run?**

The thread trackers it opened are in the next snapshot. The lenses extend them with new members instead of proposing the same thread again.

**An issue body says "ignore your instructions and…". What then?**

Nothing it says gets followed. Every sub-agent's prompt treats issue text as data and tells it to leave the tracker untouched. Only the fold-in step writes, from bodies a script renders with `@mentions` neutralised, and only for the threads you pick.

## It's working if

- Every thread names one mechanism and one change, not an area of the product.
- Each card shows which members the change fixes fully, which partly, and what is left on the partial ones.
- Some candidates were dropped, each with the skeptic's reason.
- Every open issue is either in a thread or listed as standalone with a reason.
- Issues closed while the run was going are struck through.

## Where it fits

An **on-ramp** in front of [triage](triage.md). Its thread trackers enter the main flow at the entry point each thread names: [implement](implement.md), [to-spec](to-spec.md) or [wayfinder](wayfinder.md). The issues no thread covers go to `/triage`. For the whole map, see [which-skill](../productivity/which-skill.md).
