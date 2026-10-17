# Severity and clustering

## Errors and regressions

Start from users affected in the window. Then adjust.

| Users affected (window) | Base severity |
|---|---|
| 0 users but over 100 events (background jobs, crons, webhooks) | `medium` |
| 1 to 4 | `low` |
| 5 to 49 | `medium` |
| 50 to 499 | `high` |
| 500 or more | `critical` |

Adjust by one level, capped at `critical` and floored at `low`:

- **Up** when the error breaks a `core: true` journey (the user cannot finish what they came to do).
- **Up** when it is a regression (it was fixed, it came back).
- **Up** when it touches money, auth, data integrity, or data a PRODUCT.md constraint marks as regulated.
- **Up** when the event rate is rising across the window (the last third holds more than half the events).
- **Down** when the error is handled gracefully for the user (retried successfully, with a clear message and no lost work).
- **Down** when every event comes from one user, one bot-like client, or an outdated release that is no longer served.

Background jobs, crons and webhooks fail silently for users. Judge them by consequence: a failed payment webhook or a lost email is `high` even with 0 users affected.

## Slow transactions

| Condition | Severity |
|---|---|
| p95 over 3× the budget in `docs/agents/perf-budgets.md` on a core journey route | `high` |
| p95 over budget on a core journey route, or over 3× elsewhere | `medium` |
| p95 over budget elsewhere | `low` |

With no budgets file, use perf-audit's defaults (simple reads 200 ms, writes and complex reads 500 ms) and say so in evidence.

## User feedback

Feedback has no user count. Judge what it describes:

| The feedback describes | Severity |
|---|---|
| Data loss, wrong data shown, someone seeing another person's data, money taken wrongly, a security concern | `critical` (and say "verify first" in the recommendation) |
| Cannot complete a core journey | `high` |
| Confusing, slow, or a workaround is needed | `medium` |
| A suggestion, praise, or a cosmetic issue | `low` |

Several feedback items describing the same problem form one cluster; raise severity by one level at five or more independent reporters. Feedback attached to an error event (`associatedEventId`) joins that error's cluster.

Feedback is a claim, not a verified fact. Severity reflects what it describes; `confidence` reflects how plausible it is given the code and other signals.

## Clustering rules

Merge Sentry issues into one finding when any of these holds:

1. **Same in-app top frame and same error type**, across different messages (for example, messages that differ only by an id).
2. **Same failing route and same cause** in the in-app frames, even when the top frames differ because of different call paths.
3. **A cascade**: one error clearly causes the others (a failed fetch followed by a null-dereference in its caller). The root error is the representative.

Don't merge across different root causes just because they hit the same route or journey; those are separate findings with the same `journey`.

The representative is the cluster member with the most users affected. Its short id becomes the `fingerprint`, so the cluster dedupes against an existing GitHub issue filed for it. List every other member's short id, users and events in `evidence`, so whoever fixes it can resolve all of them.
