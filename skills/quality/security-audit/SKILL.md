---
name: security-audit
description: "Audit the whole repo for security risks (tenant isolation, authorisation, secrets, input handling, headers, dependencies, AI features) and file ranked findings."
disable-model-invocation: true
argument-hint: "[headless] [dry-run] [full] [area]"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git ls-files:*), Bash(pnpm audit:*), Bash(npm audit:*)
---

# Security Audit

Find the ways this system can be made to leak, lie or break, rank them, and file them. The audit looks at the **whole attack surface**, not just a diff: every route, every query a route reaches, every secret, every edge where untrusted input arrives.

Security findings are never `fix: mechanical`. Every fix needs a human to review it.

## 1. Mode, scope and settings

Call the Skill tool with `report-findings` to resolve the mode (headless or interactive) and the scope (incremental or `full`).

Read `docs/agents/audits.md`. If it's missing, interactive runs tell the user to run `/schedule-audits` and stop. Headless runs emit one finding (`rule: audit-not-configured`) as report-findings describes, and stop.

Then establish the stack facts the checks need. Each input is optional; when one is missing, skip the checks that depend on it and name them in the report `summary`.

- **Runtime, auth and routes**: read `CODING_STANDARDS.md` at the repo root and the ADRs (where `docs/agents/domain.md` says they live; `docs/adr/` by default) for the runtime, the auth library, **how tenancy is enforced** (a tenant column, a scoped repository, row-level security) and where routes live. Fill the gaps from the manifests and config files (`package.json`, framework and deploy config). If nothing says how tenancy works and the schema shows no tenant-owned tables, treat the repo as single-tenant and say so.
- **Stack reference**: if the repo deploys to Cloudflare Workers (a `wrangler.toml`, `wrangler.json` or `wrangler.jsonc`), also work through [CLOUDFLARE.md](CLOUDFLARE.md).
- **Regulated data**: read `PRODUCT.md` (path from `docs/agents/product.md`; `PRODUCT.md` by default), its **Constraints** section. If it marks health, financial, children's or otherwise regulated data, raise each finding touching that data by one severity level (capped at `critical`) and say so in its evidence.
- **Accepted risks**: `CODING_STANDARDS.md` and the ADRs may explain an apparent risk. Respect an ADR that accepts a risk; flag it only if the risk has grown.

**Incremental scope** narrows the route, input and AI checks to files changed since the last run, plus every route that reaches a changed query or guard. The secrets, headers and dependency checks always run in full: they are cheap and the risk is repo-wide.

## 2. Gather evidence

Work through [CHECKLIST.md](CHECKLIST.md) in order. Split the areas across sub-agents (no more than `subagents_max` in parallel). Give each one the stack facts, its checklist sections, the scope, and this instruction: "Report facts with paths and symbols. Quote the code. Never print a secret value."

| Area | What to establish |
|---|---|
| **Route inventory** | Every route or handler, its auth guard, its role check, and for multi-tenant repos a tenant predicate on **every** query it reaches. Route params that select a record without an ownership check (IDOR). |
| **Secrets** | Follow [SECRETS.md](SECRETS.md). Report the file and key name only, never the value. |
| **Input handling** | Schema validation at every edge, with size bounds (the limits in `CODING_STANDARDS.md`, if it sets any); SQL built by string concatenation or template interpolation; unescaped HTML in server-rendered output. |
| **Headers and cookies** | CSP, HSTS, `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`; cookie `Secure`, `HttpOnly`, `SameSite`. |
| **Request integrity** | Webhook signature verification before parsing; CSRF protection on cookie-authenticated mutations; rate limits on auth, OTP, password reset, and expensive or costly endpoints. |
| **Dependencies** | `pnpm audit --json --prod` (or `npm audit --json --omit=dev`), production dependencies only, high and critical only. One finding per advisory, with the dependency path. If no audit command fits the package manager, skip this area and say so. |
| **Sensitive data in telemetry** | PII, tokens or regulated data written to logs, error reports, analytics or LLM prompts. |
| **AI features** | Untrusted text (user input, email, documents, web pages) flowing into prompts of a model that holds tools or write access; model output used as HTML, SQL, shell or a URL without validation. |
| **Runtime and edge posture** | The stack reference's checks, when one applies (see step 1). Read hosted settings, never change them. |

To make an area concrete, read [CHECKLIST.md](CHECKLIST.md) for its grep patterns and what counts as a pass.

If an `area` argument was given, run only the matching rows of the table above. An `area` makes an interactive run **targeted** (publish with `scope: targeted` and `target: <area>`, as report-findings says); a headless run is always a sweep and ignores it.

## 3. Build findings

Build one report matching `FINDINGS-SCHEMA.json` in the report-findings skill, with `audit: security-audit`. One finding per problem, per location (twenty unguarded routes means twenty findings with one `rule`). Use the `rule` ids in [CHECKLIST.md](CHECKLIST.md), [SECRETS.md](SECRETS.md) and [CLOUDFLARE.md](CLOUDFLARE.md) so fingerprints stay stable across runs. A problem that two reference files both raise (same `rule` and `locator`) is filed once.

- **`locator`**: `path#symbol`, or the route (`POST /api/items/:id/archive`). Never a line number.
- **`evidence`**: the quoted code, and for route findings the path from route to query. For secrets: the file and key name only.
- **`severity`**:
  - `critical`: exploitable now by an unauthenticated or cross-tenant actor, or a live secret is exposed.
  - `high`: exploitable by an authenticated user, or under a plausible misconfiguration.
  - `medium`: defence in depth missing where it matters.
  - `low`: hygiene.
- **`confidence`**: `high` when the exploit path is traced end to end, `medium` when a guard may exist outside what was read, `low` for a pattern match not yet confirmed (for example an IDOR candidate found by grep).
- **`recommendation`**: the fix, and the test that would pin it (for example "an integration test that tenant B gets 404 for tenant A's record").
- **`fix`**: always `judgement`. **`source`**: `internal`.

The `summary` names the stack facts used, whether the repo was treated as multi-tenant, and every check skipped for a missing input.

## 4. Publish

Call the Skill tool with `report-findings` to publish. Headless runs stop there: they only file issues, and never edit, commit or push.

Interactively, report-findings offers to start on the top finding and settles it with `grilling`; for a tenant-isolation finding, also offer to write the integration test first (call the Skill tool with `tdd`). Any change happens in the working tree with the user watching. Committing it, and any PR, is left to the user; never apply a state label.
