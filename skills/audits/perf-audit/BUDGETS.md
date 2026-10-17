# Default budgets

Starting budgets for a web app on Workers or another edge runtime, with a SQL store (D1 or similar) and a JS front end. perf-audit drafts `docs/agents/perf-budgets.md` from this table on its first run. Tighten budgets the repo already beats; never loosen one silently. Record each change and its reason in that file.

## Server

| Budget | Default | Rationale |
|---|---|---|
| `queriesPerRequestMax` (read routes) | 5 | Each round trip to an edge database costs single-digit milliseconds plus a subrequest. Five keeps p95 near the network floor and leaves room for growth. |
| `queriesPerRequestMax` (write routes) | 8, batched | Writes usually need a read-check-write; batch them into one round trip where the store supports it. |
| `rowsReadPerRequestMax` | 1,000 | Rows read drives database latency and, on D1, billing. A request reading more than a page-and-a-bit is scanning. |
| `rowsReadPerQueryMax` | 10× rows returned | A query reading far more rows than it returns is missing an index. |
| `workerCpuMsP95Max` | 10 ms | Well under typical plan limits; CPU-heavy work belongs in a queue or cron. |
| `subrequestsPerRequestMax` | 10 | Far below platform caps; each one is latency and a failure mode. |
| `latencyMsP95Max` (simple reads) | 200 ms | Edge plus one or two queries should land here from most regions. |
| `latencyMsP95Max` (writes and complex reads) | 500 ms | Allows a batch, a third-party call with a timeout, and rendering. |
| `latencyMsP95Max` (third-party-bound, e.g. payments, LLM) | 3,000 ms, with a timeout | Bounded by the provider; the budget is really "has a timeout and a fallback". |
| `responseBytesMax` (JSON APIs) | 100 KB | Large responses mean missing pagination or over-fetching. |
| `pageSizeMax` | 100 items | Anything larger needs a cursor and a reason. |
| `fanOutMax` (parallel calls per request) | 10 | Bounded concurrency avoids hitting subrequest limits and downstream rate limits. |

## Client

| Budget | Default | Rationale |
|---|---|---|
| `jsKbPerRouteMax` (compressed) | 150 KB | Keeps mid-range phones on slow networks interactive within a few seconds. |
| `jsKbInitialMax` (compressed, shared) | 100 KB | The shell every route pays for. |
| `cssKbMax` (compressed) | 50 KB | |
| `imageKbMax` (per above-the-fold image) | 200 KB, modern format | Images dominate page weight. |
| `lcpMsP75Max` | 2,500 ms | Core Web Vitals "good" threshold. |
| `inpMsP75Max` | 200 ms | Core Web Vitals "good" threshold. |
| `clsP75Max` | 0.1 | Core Web Vitals "good" threshold. |
| `fontsMax` | 2 families, preloaded | Each font family is a blocking request or a layout shift. |

## Background work

| Budget | Default | Rationale |
|---|---|---|
| `cronCpuMsMax` | Half the platform's cron limit | Headroom for growth before jobs start failing. |
| `batchSizeMax` (jobs, emails, sync) | 100 items per invocation | Bounded, resumable batches over one unbounded loop. |
| `retryCountMax` | 3, exponential backoff, capped | Retry storms amplify outages. |

## The budgets file

`docs/agents/perf-budgets.md` holds one table: budget name, value, scope (route class or page), and where it's pinned (a test path, or "not pinned"). A budget that matters and isn't pinned by a test is itself a finding (`budget-test-missing`).
