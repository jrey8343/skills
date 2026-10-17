# prune-docs

## What it does

Cleans up agent-facing and internal docs. It slims `CLAUDE.md` into an index of pointers, moves "how it works" into feature docs, "why" into ADRs and rules into `CODING_STANDARDS.md`, files plans as issues, and deletes stale facts and history.

It moves knowledge before it deletes anything. Every section is classified into a bucket, every factual claim is checked against the repo, and the plan is shown to you as a table before anything changes. Content that would vanish without a new home is flagged for your veto.

## When to reach for it

You invoke this by typing `/prune-docs`, optionally with a path; the default is the root agent doc. Reach for it when `CLAUDE.md` has grown past a couple of hundred lines, reads like a changelog, or states things that are no longer true. To check feature and user docs for coverage and drift instead, use [docs-audit](docs-audit.md).

## Sediment

Agent docs accrete layers: milestone logs, superseded plans, counts that were true once, links to files outside the repo. Adding feels safe and removing feels risky, so the layers settle. Every line is paid for by every session and every scheduled audit. Pruning is how the doc stays an index instead of becoming an archive.

## Common questions

**Will it lose history?**
No. Git keeps the history. Still-true knowledge moves to a proper home (feature docs, ADRs, standards), and only narrative and stale facts are deleted. The PR body carries the full classification table.

**Headless?**
On a schedule it only reports: over-budget docs, stale facts, dead references, misplaced content. It never edits unattended.

## It's working if

- The root agent doc fits on a couple of screens and every path in it resolves.
- Agents stop acting on outdated instructions.

## Where it fits

An adoption step early on, then a fortnightly audit. It uses [project-docs](../engineering/project-docs.md) for where things belong and [writing-for-agents](../productivity/writing-for-agents.md) for how to write what stays. See [which-skill](../productivity/which-skill.md).
