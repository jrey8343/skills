# prune-docs

## What it does

Cleans up agent-facing docs. It slims `CLAUDE.md` / `AGENTS.md` into an index of pointers, moves "how it works" into feature docs, "why" into ADRs, terms into the glossary and rules into `CODING_STANDARDS.md`, files plans as issues, and deletes stale facts and history.

It moves knowledge before it deletes anything. Every section is classified into a bucket, every factual claim is checked against the repo, and the plan is shown to you as a table before anything changes. Content that would vanish without a new home is flagged for your veto.

## When to reach for it

You type `/prune-docs`, optionally with a path, or CI runs `/prune-docs headless` on the schedule [schedule-audits](schedule-audits.md) sets; the agent never starts it by surprise. The default is the root and nested agent docs; pass a path to prune another doc. Reach for it when `CLAUDE.md` has grown past a couple of hundred lines, reads like a changelog, or states things that are no longer true. To check feature and user docs for drift against their code and for coverage of journeys, use [docs-audit](docs-audit.md) instead. When you're only writing or updating one doc as part of a change, the agent reaches for [project-docs](../product/project-docs.md) on its own.

## Prerequisites

- `docs/agents/audits.md` in the target repo, seeded by [schedule-audits](schedule-audits.md). Without it, an interactive run tells you to run `/schedule-audits`, and a headless run files one `audit-not-configured` finding.
- Optional: `docs/agents/docs-targets.md` (from [project-docs](../product/project-docs.md)) for where feature docs and runbooks go, `docs/agents/domain.md` (from Matt's `setup-matt-pocock-skills`) for the glossary and ADRs, and `CODING_STANDARDS.md`. When one is missing, a headless run names the kind of destination instead of a path and says so; an interactive run seeds `docs-targets.md` with you before moving anything there.

## Sediment

Agent docs accrete layers: milestone logs, superseded plans, counts that were true once, links to files outside the repo. Adding feels safe and removing feels risky, so the layers settle. Every line is paid for by every session and every scheduled audit. Pruning is how the doc stays an index instead of becoming an archive.

## Interactive and headless

Interactive, it proposes the classification table, waits for your go-ahead, then edits the working tree in front of you: destinations first (ADRs and glossary entries through Matt's `domain-modeling`), then the slimmed index, worded the way Matt's `writing-for-agents` says. Committing is yours. Plans become issues only after you approve each one, and they carry no state label. An interactive run always classifies every section of the root agent doc (or the path you pass), however little has changed since the last audit.

Headless, on a schedule, it only reports: over-budget agent docs, stale facts, misplaced content and duplicates, filed through [report-findings](report-findings.md). Incremental runs re-read only the docs that changed or name changed paths, plus the root doc's budget. Dead paths and links outside the repo are [docs-audit](docs-audit.md)'s findings, so they are never filed twice. It never edits unattended.

## Common questions

**Will it lose history?**
No. Git keeps the history. Still-true knowledge moves to a proper home (feature docs, ADRs, glossary, standards), and only narrative and stale facts are deleted. You get the full classification table to put in the commit body.

**Why doesn't it file dead paths?**
[docs-audit](docs-audit.md) already files them for every agent doc. Filing them here too would open a second issue for the same line, and closing one as not planned wouldn't suppress the other. An interactive prune still fixes every dead path in the doc it rewrites.

## It's working if

- The root agent doc fits on a couple of screens (about 200 lines) and every path in it resolves.
- After a run, the root agent doc holds no milestone history, no future-tense plans and no counts or versions; those live in feature docs, ADRs or issues.
- Scheduled runs file a few small findings instead of one big rewrite.

## Where it fits

A periodic audit, and a one-off cleanup the first time a repo adopts these skills. It uses [project-docs](../product/project-docs.md) for where things belong, Matt's `writing-for-agents` for how to write what stays, and [report-findings](report-findings.md) to file what it finds. [docs-audit](docs-audit.md) is its sibling for feature and user docs; [schedule-audits](schedule-audits.md) runs both on a schedule.
