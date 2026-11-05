# perf-audit

## What it does

Audits performance against explicit, numeric budgets (round trips, rows read, CPU, latency, payload and bundle size) and files each budget broken, or about to break, as an issue. A finding needs a budget and a number: every one carries a napkin-math line, and "this could be faster" with neither is never filed.

## When to reach for it

You type `/perf-audit` (or CI runs it headless); the agent never starts it by surprise. Reach for it to sweep the codebase against its budgets, incrementally since the last run or with `full`. To chase one slow page or a regression you've already seen, use Matt's `diagnosing-bugs` instead; perf-audit hands you to it when a production signal shows a regression the code doesn't explain.

## Prerequisites

- `docs/agents/audits.md`, seeded by [schedule-audits](schedule-audits.md). Without it an interactive run tells you to run `/schedule-audits`, and a headless run files one `audit-not-configured` issue and stops.
- `docs/agents/perf-budgets.md`. If it's missing, the first interactive run drafts it with you from the skill's defaults; a headless run files a `perf-budgets-missing` finding and audits against the defaults.
- Optional: `CODING_STANDARDS.md` (where tests go), a recent build output, a local database with migrations applied, a non-production `perf-audit.live_targets` URL for Core Web Vitals (interactive runs only). Each one missing skips the checks that need it, and the run summary names them.

## Budgets and napkin math

The budgets file is one table: budget, value, scope (a route class or page) and the test that pins it, plus the platform limits the napkin math is checked against. The defaults are a starting point; tighten the ones you already beat, and the file keeps a log of every change. A budget on a hot path or core journey that isn't pinned by a test is itself a finding.

Evidence says how it was got: `measured` (a guard test, a query plan, a build), `estimated` (round trips × latency) or `production` (the store's query statistics, traces). Only two fixes count as mechanical: a missing index (a new migration) and a missing budget test. Everything else needs judgement.

## Stacks and third-party text

The main flow is stack-neutral. Stack specifics sit in reference files beside the skill: Cloudflare Workers and D1 (platform limits, local query plans, `wrangler d1 insights`, Workers observability) and Sentry (traces and performance issues).

Sentry events, the Cloudflare MCP server's logs and a rendered page's Core Web Vitals pass all carry text third parties can write. Those signals are read in interactive runs only, and no CI job drives a browser against a deployment: a headless run skips them and says so, and [schedule-audits](schedule-audits.md) leaves perf-audit off the schedule when the repo uses Sentry or a Cloudflare MCP server. Run it by hand for the production picture until scheduled runs split reading from writing.

## It's working if

- `docs/agents/perf-budgets.md` exists after the first interactive run and names a test for each hot-path budget, or a `budget-test-missing` issue for it.
- Every perf issue quotes a number, its kind (measured, estimated or production) and the budget it breaks.
- Issues arrive labelled `audit:perf-audit` with no state label, and only index and budget-test fixes carry `fix: mechanical`.
- A repeat run with no relevant changes files nothing new.
- A headless run's summary names any signals it skipped (Sentry, the Cloudflare MCP, Core Web Vitals, guard-test runs, builds and local query plans, missing credentials).

## Where it fits

A periodic audit, built on [report-findings](report-findings.md) and scheduled by [schedule-audits](schedule-audits.md) when the repo uses neither Sentry nor a Cloudflare MCP server. Its siblings are [security-audit](security-audit.md), [test-audit](test-audit.md), [docs-audit](docs-audit.md) and [prune-docs](prune-docs.md). Matt's `triage` takes its issues; `diagnosing-bugs` takes a regression it can't explain from the code.
