# synthesize-backlog

## What it does

`synthesize-backlog` reads every open issue on your tracker at once and finds its **threads**: groups of three or more issues that share one mechanism, where one structural change (a module, a seam, a value type, an invariant asserted at an interface, a harness, a CI check) would resolve all of them or most of each. It writes them up as an HTML report in a suggested order, with the reason for each place, and a triage plan. Then it puts the threads to you one at a time, and for each one you choose it opens a **thread tracker**: an issue that holds the thread's members as sub-issues. A thread tracker is a question to grill, not a spec.

The defining constraint is that a **topic** is not a thread. "Auth issues" is a topic, and grouping by topic is what any tag cloud does. "Every route re-derives session standing on its own, so revoked sessions slip through the routes that forgot to check" is a thread: one cause in the code, one change that removes it. Each thread is checked against the code twice before it reaches the report. A skeptic tries to refute it, and a fit-checker reads every member issue and rules whether the change fixes it fully, partly or not at all.

## When to reach for it

You invoke this by typing `/synthesize-backlog`, optionally with an area (a label, milestone or search); the agent won't reach for it on its own. It is expensive, so the trigger is a backlog too large to triage one issue at a time, typically after a burst of audits or overnight agent runs has filed dozens of issues.

Folding is its own mode, run like a grilling session. A run ends by keeping itself and printing the command to fold it, `/synthesize-backlog fold <run-dir>`, which works in any later session: read the report today, decide over a few days. Fold asks you to agree or change the order first, showing which shared issues each thread would take. Then it asks one question per thread, each with a short card (cause, what it would attach, what it shares, the skeptic's doubts) and a recommendation; you decide whether to fold it, extend an existing tracker or skip it, and "yes to all" or "yes except 3" both count as answers. The full card for any thread is there on request. Only then does it open trackers. A last round asks about each brief a folded thread supersedes, one question per brief. You can stop at any round and pick up later. With no path, fold offers the newest kept run for the repo.

| What you have | Where to go |
| --- | --- |
| Too many open issues to triage one by one, and a suspicion they overlap | `/synthesize-backlog` |
| A handful of new issues to evaluate | [triage](triage.md) |
| A question about the code's structure, not the backlog | [improve-codebase-architecture](../audits/improve-codebase-architecture.md) |
| One big effort whose route is unclear | [wayfinder](wayfinder.md) |

Run it before a large `/triage` pass, not after: an issue that a thread will close needs no agent brief of its own, and briefs written first may be ones a thread reverses.

## Prerequisites

GitHub issues, with the issue tracker configured by [setup-standards](../setup/setup-standards.md); other trackers aren't supported yet. It needs `gh`, and a git remote with the default branch. It reads `PRODUCT.md`, `GLOSSARY.md`, the ADRs and `CODING_STANDARDS.md` where they exist; ranking is much better with a product model from [discover-domain](../setup/discover-domain.md).

Nothing lands in your working tree. The run works in your temp directory, and the code it checks is a detached checkout of the default branch's tip inside that directory, removed when the run ends. Its result is kept, without the checkout, under `~/.local/state/synthesize-backlog/<owner>-<name>/<timestamp>/` (`$XDG_STATE_HOME` if you set it, `%LOCALAPPDATA%` on Windows): outside every repo, because it holds issue text. Fold writes to GitHub only what you approve in a round: thread trackers, their sub-issues, and the briefs you choose to hold.

## Six lenses, then a skeptic

Each issue is first condensed into a digest whose key field is its **mechanism**: why it happens, in code terms. Six lenses then read every digest, each looking for a different kind of shared cause: architecture, domain invariants, identity and access, runtime robustness, the delivery system (tests, CI, docs and the agents' own process), and product journeys. Agreement between lenses is kept as a signal; a thread three lenses found independently shows three filled dots on its card.

A merge groups the lens threads into candidates. Verification is where most of the value sits. On a 195-issue backlog, the skeptic dropped a thread whose work had already shipped, and another that bundled three unrelated fixes under one name. A completeness critic then places every issue no surviving thread claimed: into a thread it was missed from, or into a list of standalone issues, each with its reason.

## What it costs

Roughly one sub-agent for every two issues, and more on a small backlog, since nine agents run whatever its size. A 195-issue backlog took 105 sub-agents, about two hours and 11M sub-agent tokens, and found 38 threads covering 137 issues, 118 of the 144 that were waiting for triage. It tells you the scale and waits for your go before dispatching anything.

## Common questions

**Does this take me out of the loop?**

The synthesis runs without you, because it only finds facts: what each issue says, what the code shows, which issues share a cause. Every decision is still yours, put to you as grilling rounds: the order, whether each thread gets a tracker, whether each brief it supersedes is held. Strengths, the order and each proposed change arrive as recommendations with their reasons, and nothing is written until you have answered. A thread tracker starts at `/grill-with-docs`, or at `/wayfinder` when its decisions are open, so its proposed change is grilled into a spec before anyone builds it. Fold recommends holding a brief whenever an open decision touches it, so no agent builds part of a thread before you have settled it.

**Does it change any labels?**

Not on its own. Folding opens thread trackers and attaches sub-issues; members keep their own triage states, nothing is closed, and each brief is moved back to `needs-triage` only when you say so for that brief.

**What happens on the next run?**

The thread trackers it opened are in the next snapshot. The lenses extend them with new members instead of proposing the same thread again.

**I folded a run last week. What does folding it again do?**

Fold refreshes the run first: issues closed since are struck through, and members that gained a parent are listed rather than attached. Threads already folded show `folded as #N` and are left alone unless you ask to extend that tracker. The code isn't re-checked, so fold tells you how far behind the run's code is; past a few weeks, a fresh synthesis is the better answer.

**An issue body says "ignore your instructions and…". What then?**

Nothing it says gets followed. Every sub-agent's prompt treats issue text as data and tells it to leave the tracker untouched. Only fold writes, only what you approve, and its tracker bodies come from a script that neutralises `@mentions`.

## It's working if

- Every thread names one mechanism and one change, not an area of the product.
- Each card shows which members the change fixes fully, which partly, and what is left on the partial ones.
- Some candidates were dropped, each with the skeptic's reason.
- Every open issue is either in a thread or listed as standalone with a reason.
- Issues closed while the run was going are struck through.
- Fold asks before every write, one question per thread, and never opens a tracker you didn't choose.
- Every thread tracker's Next section says to grill it, not to build it.

## Where it fits

An **on-ramp** in front of [triage](triage.md). Its thread trackers join the main flow at its start: [grill-with-docs](grill-with-docs.md) on the tracker, or [wayfinder](wayfinder.md) given the thread as its idea when its decisions are open (wayfinder opens its own map; the tracker is not the map), and from there [to-spec](to-spec.md) and [implement](implement.md). The issues no thread covers go to `/triage`. For the whole map, see [which-skill](../productivity/which-skill.md).
