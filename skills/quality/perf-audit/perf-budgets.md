# Perf Budgets

Performance budgets for this repo. Drafted by `perf-audit` on its first run from its defaults; read by `perf-audit` on every run. Edit freely: tighten a budget the repo already beats, and never loosen one without a reason in the change log below.

## Budgets

| Budget | Value | Scope | Pinned by |
|---|---|---|---|
| `queriesPerRequestMax` | {5} | {read routes} | {test path, or "not pinned"} |
| `queriesPerRequestMax` | {8, batched} | {write routes} | {…} |
| `rowsReadPerRequestMax` | {1,000} | {all routes} | {…} |
| `latencyMsP95Max` | {200 ms} | {simple reads} | {…} |
| `latencyMsP95Max` | {500 ms} | {writes and complex reads} | {…} |
| `jsKbPerRouteMax` | {150 KB compressed} | {each page route} | {…} |
| {one row per budget that applies; drop the rest} | | | |

## Platform limits (for napkin math)

- {e.g. CPU time per request, subrequests per request, rows read per query, request body size, scheduled-job CPU limit, for this repo's host and plan}

## Changes

- {date}: {budget} {old} → {new}, because {reason}.
