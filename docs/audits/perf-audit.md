# perf-audit

## What it does

Checks the system against explicit performance **budgets** (queries and rows read per request, CPU, p95 latency, response, bundle and image size, Core Web Vitals) and files every budget that is broken or about to break. Every finding carries the numbers and a napkin-math line showing why it matters. "This could be faster" with no budget and no number is not a finding.

## When to reach for it

You invoke this by typing `/perf-audit`, and the agent won't reach for it on its own. It also runs fortnightly in CI when scheduled audits are installed.

| Situation | Use |
|---|---|
| Hunting systematically for performance debt, or checking a feature didn't add any | `/perf-audit` |
| Something specific is slow right now and you need the cause | [diagnosing-bugs](../engineering/diagnosing-bugs.md) |
| Only page-load metrics for one URL | The `web-perf` skill, if installed |

## Prerequisites

`/setup-standards` must have run. On its first run the audit drafts `docs/agents/perf-budgets.md` from sensible defaults for an edge web app, and asks you to confirm them. Production signals are optional and used when available: the Sentry MCP server for traces, D1 insights for query statistics, and a non-production URL in `live_targets` for Core Web Vitals.

## Budgets, not opinions

A budget is a named number with a scope, such as "5 queries per read request". The budgets file records each one, and whether a test pins it. A budget without a test is a finding in its own right (`budget-test-missing`), because an unpinned budget erodes one reasonable-looking PR at a time.

## Mechanical fixes

Two kinds of finding are safe for an agent PR: a missing index (added as a new migration, never by editing an old one) and a missing budget test (following the repo's existing guard-test pattern). Everything else needs a judgement call and goes through the normal issue flow.

## Common questions

**Does it need production access?**
No. Without production signals it measures locally (query plans, static round-trip counts, build output) and says in each finding whether the number was measured, estimated or taken from production.

**Will it run Lighthouse against production?**
Never. Core Web Vitals only run against non-production URLs listed in `docs/agents/audits.md`.

## It's working if

- Findings quote numbers against named budgets, not adjectives.
- The budgets file grows test pins over time, and the `budget-test-missing` findings shrink.
- Index and N+1 findings get fixed by small PRs that land without debate.

## Where it fits

A periodic audit, fortnightly by default. It leans on the napkin-math and limits rules in [house-style](../engineering/house-style.md), and publishes through [report-findings](report-findings.md). For the full map, see [which-skill](../productivity/which-skill.md).
