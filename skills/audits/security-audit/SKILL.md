---
name: security-audit
description: "Audit the whole repo for security risks (tenant isolation, authorisation, secrets, input handling, headers, dependencies, AI features) and file ranked findings. For a diff-only review use the built-in /security-review."
disable-model-invocation: true
argument-hint: "[headless] [dry-run] [full] [area]"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git ls-files:*), Bash(pnpm audit:*), Bash(npm audit:*), Bash(printenv GITHUB_ACTIONS), Bash(printenv CLAUDE_CODE_ENTRYPOINT)
---

# Security Audit

Find the ways this system can be made to leak, lie or break, rank them, and file them. The audit looks at the **whole attack surface**, not just a diff: every route, every query a route reaches, every secret, every edge where untrusted input arrives.

Security findings are never `fix: mechanical`. Every fix needs a human to review it.

## 1. Mode, scope and settings

Call the Skill tool with "report-findings" to resolve the mode (headless or interactive) and the scope (incremental or `full`).

Read `docs/agents/audits.md`. If it's missing, interactive runs tell the user to run `/setup-standards`. Headless runs emit one finding (`rule: audit-not-configured`) and stop.

Also read:

- `docs/agents/stack.md`: runtime, auth library, **how tenancy is enforced**, where routes live.
- `PRODUCT.md` (path from `docs/agents/product.md`): the **Constraints** section. If it marks health, financial, children's or otherwise regulated data, raise each finding touching that data by one severity level (capped at `critical`) and say so in its evidence.
- `CODING_STANDARDS.md` and `docs/adr/`: decisions that explain apparent risks. Respect an ADR that accepts a risk; flag it only if the risk has grown.

**Incremental scope** narrows the route, input and LLM checks to files changed since the last run, plus every route that reaches a changed query or guard. The secrets, headers and dependency checks always run in full: they are cheap and the risk is repo-wide.

## 2. Gather evidence

Work through [CHECKLIST.md](CHECKLIST.md) in order. Split the areas across sub-agents (no more than `subagents_max` in parallel). Give each one the stack facts, its checklist sections, the scope, and this instruction: "Report facts with paths and symbols. Quote the code. Never print a secret value."

| Area | What to establish |
|---|---|
| **Route inventory** | Every route or handler, its auth guard, its role check, and for multi-tenant repos a tenant predicate on **every** query it reaches. Route params that select a record without an ownership check (IDOR). |
| **Secrets** | Follow [SECRETS.md](SECRETS.md). Report the file and key name only, never the value. |
| **Input handling** | Schema validation at every edge, with size bounds (house-style limits); SQL built by string concatenation or template interpolation; unescaped HTML in server-rendered output. |
| **Headers and cookies** | CSP, HSTS, `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`; cookie `Secure`, `HttpOnly`, `SameSite`. |
| **Request integrity** | Webhook signature verification before parsing; CSRF protection on cookie-authenticated mutations; rate limits on auth, OTP, password reset, and expensive or costly endpoints. |
| **Dependencies** | `pnpm audit --json` (or `npm audit --json`), high and critical only. One finding per advisory, with the dependency path. |
| **Sensitive data in telemetry** | PII, tokens or regulated data written to logs, error reports, analytics or LLM prompts. |
| **AI features** | Untrusted text (user input, email, documents, web pages) flowing into prompts of a model that holds tools or write access; model output used as HTML, SQL, shell or a URL without validation. |
| **Edge posture** | If a `cloudflare` MCP server is configured, read (never change) zone settings: WAF managed rules, rate-limiting rules, TLS mode, Always Use HTTPS, bot settings. |

To make an area concrete, read [CHECKLIST.md](CHECKLIST.md) for its grep patterns and what counts as a pass.

## 3. Build findings

One finding per problem, per location (twenty unguarded routes means twenty findings with one `rule`). Use the `rule` ids in [CHECKLIST.md](CHECKLIST.md) so fingerprints stay stable across runs.

- **`locator`**: `path#symbol`, or the route (`POST /api/invoices/:id/void`). Never a line number.
- **`evidence`**: the quoted code, and for route findings the path from route to query. For secrets: the file and key name only.
- **`severity`**:
  - `critical`: exploitable now by an unauthenticated or cross-tenant actor, or a live secret is exposed.
  - `high`: exploitable by an authenticated user, or under a plausible misconfiguration.
  - `medium`: defence in depth missing where it matters.
  - `low`: hygiene.
- **`recommendation`**: the fix, and the test that would pin it (for example "an integration test that tenant B gets 404 for tenant A's record").
- **`fix`**: always `judgement`. **`source`**: `internal`.

If an `area` argument was given, run only the matching rows of the table above.

## 4. Publish

Call the Skill tool with "report-findings" to publish.

In interactive mode, after publishing, offer to grill the top finding (call the Skill tool with "grilling"). For a tenant-isolation finding, offer to sketch the integration test first.
