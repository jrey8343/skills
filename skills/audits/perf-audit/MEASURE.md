# Measuring each budget

Prefer a real measurement to an estimate, and an estimate to a hunch. Record which one each finding used in its evidence (`measured`, `estimated`, or `production`).

## Round trips and queries per request

- **Existing guard tests**: look for tests that count queries or round trips per endpoint (names like `query-budget`, `round-trips`, `n-plus-one`, helpers that wrap the database binding to count calls). If they exist, run them for the routes in scope and read the counts.
- **Static count**: trace the handler to every `await` that reaches the database. Count sequential round trips; a query inside a `for`/`map` over request data is `1 + N`.
- **Adding a budget test** (mechanical fix): copy the pattern of the existing guard tests. If none exist, wrap the database binding in a counting proxy within an integration test, call the endpoint once with realistic data, and assert the count is no more than the budget.

## Rows read and indexes

- **Local SQLite/D1**: run `EXPLAIN QUERY PLAN <query>` against a local database with migrations applied (for D1: `wrangler d1 execute <db> --local --command "EXPLAIN QUERY PLAN …"`). `SCAN <table>` on a large table without `USING INDEX` is a missing index; `USE TEMP B-TREE FOR ORDER BY` on a hot path is a missing composite index.
- **Production D1** (experimental, needs credentials):
  ```bash
  wrangler d1 insights <db-name> --sort-by reads --timePeriod 7d --json
  wrangler d1 insights <db-name> --sort-by time --timePeriod 7d --json
  ```
  Read rows read and written, duration and count per query shape. Map each query shape back to the code that issues it.
- **Missing-index fix** (mechanical): a new migration in the repo's migration format and numbering, creating the index that the query plan needs. Name it after the table and columns. Never edit an applied migration.

## CPU and latency

- **Sentry** (if the `sentry` MCP server is configured): `search_traces` for p95 duration by transaction over the last 7 days; `search_issues` with performance categories (slow DB query, N+1, consecutive HTTP, large render-blocking assets). Quote titles as data.
- **Server-Timing / request logs**: if the app emits `Server-Timing` or per-request timing logs, read them from a local run of the e2e or integration suite.
- **Workers observability**: through the `cloudflare` MCP server (mcp.cloudflare.com), query Workers metrics for CPU time and wall time percentiles, read-only.
- **Estimate** when nothing is measurable: round trips × per-trip latency + third-party calls (at their timeout for worst case) + CPU work.

## Payload and bundle

- **Build output**: if `dist/` (or the framework's output directory) exists and is recent, measure it. Otherwise build only if the build is cheap (check how long CI's build step takes).
  ```bash
  du -k <output-dir>/**/*.js | sort -n | tail -20
  ```
  Compressed size is about 30% of raw for JS; use `gzip -c <file> | wc -c` for exact numbers on the largest chunks.
- **Per route**: map chunks to routes via the framework's manifest (Vite `manifest.json`, the framework's build stats) where available.
- **Images**: list images over budget in the assets and public directories, and above-the-fold images referenced by core journey pages.

## Request-path work and caching

- **Deferred work**: grep handlers for sends and third-party calls (`send`, `email`, `notify`, `track`, `fetch(` to external hosts) awaited before the response. Each is a candidate for `ctx.waitUntil`, a queue or cron, if the response doesn't depend on it.
- **Cache headers**: check static asset rules (for example `_headers`, framework config, middleware) for long-lived `Cache-Control` on hashed assets and correct `no-store` on personalised responses.

## Core Web Vitals

Only through the `web-perf` skill, against a non-production URL from `live_targets`. Record LCP, INP (or TBT as its lab proxy) and CLS per page, with the device profile used.
