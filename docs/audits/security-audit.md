# security-audit

## What it does

Audits the whole attack surface of a repo and files ranked findings as GitHub issues. It maps every route to its auth guard, role check, and the tenant predicate on each query it reaches, then checks secrets, input handling, headers, webhooks, dependencies, telemetry and AI features. It never prints a secret value: findings name the file and the key, nothing more. It never marks a finding as a mechanical fix, because every security change deserves a human review.

## When to reach for it

You invoke this by typing `/security-audit`, and the agent won't reach for it on its own. It also runs weekly in CI when scheduled audits are installed.

| Situation | Use |
|---|---|
| "Is this codebase safe?", before launch, after a big feature, or on a schedule | `/security-audit` (add `full` for everything, not just changes since the last run) |
| "Is this diff safe?" before merging | The built-in `/security-review` |
| Secrets need moving out of files and into a vault | [adopt-1password](../setup/adopt-1password.md) |

## Prerequisites

`/setup-standards` must have run, so `docs/agents/audits.md` and `docs/agents/stack.md` exist. `stack.md` should say how tenancy is enforced: the route-to-query trace depends on it. If PRODUCT.md lists regulated data under Constraints, findings touching that data are raised a severity level.

## The route-to-query trace

The highest-value check. Most serious bugs in multi-tenant apps aren't missing logins; they're a correct login followed by a query that forgets which tenant it is for. The audit follows each route through its helpers to every query it reaches and asks whether the tenant comes from the session and appears in the `WHERE`. Each gap is its own finding, with a recommended integration test proving tenant B can't see tenant A's record.

## Incremental vs full

Incremental runs (the default) re-trace only the routes that reach code changed since the last run. The secrets, headers and dependency checks always cover the whole repo, because they're cheap and the risk is global. Use `full` before a launch or after a dependency upgrade.

## Common questions

**Why doesn't it fix things itself?**
A wrong security fix is worse than a known gap: it hides the gap. Findings come with the fix and a test to pin it; a human makes the call.

**It flagged a public key as a secret.**
Some keys are meant to be public (publishable payment keys, error-tracking DSNs). Close the issue as not planned and it stays suppressed on future runs.

## It's working if

- Each run's tracking issue lists findings ranked critical first, with the route or `path#symbol` for each.
- No secret value ever appears in an issue, comment or session transcript.
- Fixed findings stay closed. A finding that reopens with the `regression` label means the fix was undone.

## Where it fits

A periodic audit, weekly by default. It shares its publishing machinery with the other audits through [report-findings](report-findings.md), and pairs with [adopt-1password](../setup/adopt-1password.md) for secret findings. For the full map, see [which-skill](../productivity/which-skill.md).
