# security-audit

## What it does

Audits the whole attack surface of a repo (routes and the queries they reach, tenant isolation, secrets, input handling, headers and cookies, dependencies, telemetry and AI features) and files ranked findings as issues for Triage. It looks at every route and every edge where untrusted input arrives, not just the latest diff, and it never prints a secret value: a secret finding names the file and key, nothing more.

## When to reach for it

You type it: `/security-audit`, or CI runs `/security-audit headless` on the schedule [schedule-audits](schedule-audits.md) sets up. The agent never starts it on its own. Reach for it to sweep the repo; for a review of one branch's changes, use Matt's `code-review` instead. Slow endpoints and missing indexes are [perf-audit](perf-audit.md)'s job, and missing tests in general are [test-audit](test-audit.md)'s.

## Prerequisites

- `docs/agents/audits.md`, seeded by `/schedule-audits`. Without it, an interactive run tells you to run that, and a headless run files one `audit-not-configured` issue and stops.
- Optional inputs that sharpen the run: `CODING_STANDARDS.md` and ADRs (how tenancy and auth work, accepted risks, input size limits) and `PRODUCT.md` (regulated data raises severity). When one is missing, the checks that need it are skipped and the summary says which.
- `pnpm` or `npm` for the dependency advisories, and, for Cloudflare zones, a `cloudflare` MCP server if you want edge settings read. While a Cloudflare MCP server is configured for the repo, [schedule-audits](schedule-audits.md) leaves security-audit off the schedule (it reads third-party text), so run it by hand.

## What it checks

The checklist follows the OWASP Top 10, then adds multi-tenant isolation (a tenant predicate on every query a route reaches, tenant ids never taken from the request, tenant-scoped cache and storage keys), server-runtime pitfalls (per-request state in module scope, floating promises, fetches without timeouts) and AI features (untrusted text reaching a model that can act, model output used as HTML, SQL or a URL). Tenant isolation gets the most attention because most serious multi-tenant bugs aren't missing logins: they are a correct login followed by a query that leaves out the tenant. So the audit follows each route through its helpers to every query it reaches. Each check has a stable rule id, so a finding keeps its fingerprint from run to run.

Stack specifics sit in their own reference files. A repo with a wrangler config also gets the Cloudflare Workers checks: secrets in `vars`, isolate behaviour, D1, KV and R2 key scoping, and the zone's WAF, TLS and rate-limit settings (read, never changed).

## How findings are ranked

`critical` is exploitable now by an unauthenticated or cross-tenant actor, or a live secret is exposed; `high` needs an authenticated user or a plausible misconfiguration; `medium` is missing defence in depth; `low` is hygiene. Findings touching data `PRODUCT.md` marks as regulated go up one level. Every security finding is a judgement fix, never `fix: mechanical`, and every recommendation names the test that would pin the fix. An exposed secret's recommendation always starts with rotating it.

## Common questions

**Does it fix anything?** Headless runs only file issues; they never edit, commit or push. Interactively it offers to grill the top finding with you and can make the change in your working tree while you watch. Committing it is yours.

**Can I run part of it?** Pass an area, such as `/security-audit secrets`. That's a targeted run: its findings are filed, but the next scheduled run still starts from the last scheduled one. Incremental runs narrow the route, input and AI checks to what changed since the last run, while secrets, headers and dependencies are always checked across the whole repo. Pass `full` to re-trace every route, which is worth doing before a launch or after a dependency upgrade.

**It flagged a public key as a secret.** Some keys are meant to be public, such as publishable payment keys or error-tracking DSNs. Close the issue as not planned and it stays suppressed on future runs.

## It's working if

- Issues arrive labelled `audit:security-audit` with a severity and no state label, and none is labelled `fix: mechanical`.
- No issue, comment or log contains a secret value, only file paths and key names.
- A route finding's evidence traces the path from the route to the unguarded query.
- Re-running the audit files nothing new until the code changes.
- Fixed findings stay closed. A finding that reopens with the `regression` label means the fix was undone.

## Where it fits

A periodic audit. [schedule-audits](schedule-audits.md) runs it in CI, [report-findings](report-findings.md) publishes what it finds, and Matt's `triage` decides what happens next. Its siblings are [test-audit](test-audit.md), [perf-audit](perf-audit.md), [docs-audit](docs-audit.md) and [prune-docs](prune-docs.md).
