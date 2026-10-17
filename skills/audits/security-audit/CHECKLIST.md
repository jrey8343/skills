# Security checklist

Ordered by the OWASP Top 10 (2021), then two sections for multi-tenant systems and Workers/edge runtimes. Each row has a stable `rule` id; reuse it in findings so fingerprints stay stable. The grep patterns are starting points for finding candidates, not verdicts: read the code before filing.

## A01 Broken access control

| Rule | Check | Starting points |
|---|---|---|
| `route-without-auth` | Every non-public route passes an auth guard before any data access. Public routes are listed somewhere deliberate (an allowlist or a comment). | Route registrations: `app\.(get\|post\|put\|patch\|delete)\(`, `router\.`, `export (const\|async function) (GET\|POST\|PUT\|PATCH\|DELETE)` |
| `route-without-role-check` | Admin and staff routes check the role or permission, not just "signed in". | Guard helpers named `require*`, `assert*`, `guard*`, `*Middleware` |
| `idor-route-param` | A record selected by an id from the URL or body is checked for ownership (user, tenant or both) in the same query or right after it. | `c.req.param(`, `params.`, `req.params`, followed by a lookup by that id |
| `client-trusted-identity` | User, tenant or role ids come from the session, never from the request body or query string. | `body.userId`, `body.tenantId`, `query.orgId` and the like |
| `cors-wildcard-with-credentials` | No `Access-Control-Allow-Origin: *` on credentialed endpoints; no reflected origin without an allowlist. | `Access-Control-Allow-Origin`, `cors(` |

## A02 Cryptographic failures

| Rule | Check | Starting points |
|---|---|---|
| `weak-hash-for-secrets` | Passwords and tokens use a proper KDF or an auth library; there are no `md5`/`sha1` for secrets. | `createHash\('(md5\|sha1)'`, `crypto.subtle.digest\('SHA-1'` |
| `insecure-random` | Tokens, ids and codes use `crypto.getRandomValues` or `randomUUID`, never `Math.random`. | `Math.random\(` near token, code, otp or id |
| `plaintext-sensitive-at-rest` | Regulated data (per PRODUCT.md constraints) at rest is encrypted or justified by an ADR. | Schema columns named like the regulated data |

## A03 Injection

| Rule | Check | Starting points |
|---|---|---|
| `sql-string-built` | SQL is parameterised. No string concatenation or template interpolation of values into SQL. | `` `SELECT .*\$\{ ``, `"SELECT " +`, `.raw(`, `sql.raw(`, `.prepare(\`` with `${` |
| `html-unescaped` | Server-rendered HTML escapes untrusted values; framework escape hatches are justified. | `innerHTML`, `{@html`, `set:html`, `dangerouslySetInnerHTML`, `v-html` |
| `command-or-url-injection` | No user input in shell commands, `eval`, `new Function`, or as a fetch target without an allowlist (SSRF). | `eval\(`, `new Function\(`, `fetch\(` with a variable URL |
| `input-unvalidated` | Every edge (HTTP body, query, headers used, webhooks, queue messages) is parsed by a schema. | Handlers reading `await c.req.json()`/`request.json()` without a schema parse |
| `input-unbounded` | Strings and arrays in schemas have `.max()`; bodies have a size limit (house-style limits). | `z.string()` without `.max(`, `z.array(` without `.max(` |

## A04 Insecure design

| Rule | Check | Starting points |
|---|---|---|
| `missing-rate-limit` | Sign-in, OTP, password reset, invite, and expensive or costly endpoints (LLM calls, email sends, exports) are rate-limited. | Auth routes; calls to LLM, email and SMS providers |
| `enumeration` | Sign-in, reset and invite responses don't reveal whether an account exists. | Distinct error messages for "no such user" |

## A05 Security misconfiguration

| Rule | Check | Starting points |
|---|---|---|
| `missing-csp` | HTML responses carry a CSP without `unsafe-inline` for scripts (or with nonces or hashes). | `Content-Security-Policy`, `_headers`, middleware setting headers |
| `missing-security-headers` | HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `frame-ancestors` (or `X-Frame-Options`). | Same places |
| `cookie-flags` | Session cookies are `Secure`, `HttpOnly`, `SameSite=Lax` or `Strict`. | `setCookie(`, `Set-Cookie`, auth library cookie config |
| `debug-exposed` | No debug routes, stack traces or verbose errors in production responses. | `/debug`, `stack` in JSON error responses, `NODE_ENV` checks |

## A06 Vulnerable components

| Rule | Check | Starting points |
|---|---|---|
| `dependency-advisory` | No high or critical advisories in production dependencies. | `pnpm audit --json --prod` or `npm audit --json --omit=dev` |
| `vendored-unpinned` | Vendored or CDN-loaded code is pinned and integrity-checked. | `<script src="http`, tarballs in `vendor/` |

## A07 Identification and authentication failures

| Rule | Check | Starting points |
|---|---|---|
| `session-not-rotated` | The session id rotates on sign-in and privilege change; sign-out invalidates server-side. | Auth library config |
| `otp-weak` | OTP and magic-link codes have expiry, single use, and attempt limits. | OTP generation and verification |

## A08 Software and data integrity failures

| Rule | Check | Starting points |
|---|---|---|
| `webhook-unverified` | Webhooks verify the provider signature over the raw body **before** parsing or acting. | `/webhook`, `constructEvent`, `verifySignature`, raw-body handling |
| `csrf` | Cookie-authenticated mutations have CSRF protection (SameSite plus origin check, or tokens). | POST/PUT/DELETE handlers using cookie auth |
| `ci-untrusted-input` | CI workflows don't interpolate untrusted PR or issue text into `run:` steps; third-party actions are pinned. | `${{ github.event.` inside `run:`; `uses:` without a SHA |

## A09 Logging and monitoring failures

| Rule | Check | Starting points |
|---|---|---|
| `sensitive-in-logs` | Logs, error reports and analytics carry no tokens, passwords, full request bodies, or regulated data. | `console.log(`, logger calls with `body`, `headers`, `env`, `user` |
| `security-events-unlogged` | Failed sign-ins, permission denials and admin actions are logged (without secrets). | Auth failure paths |

## A10 Server-side request forgery

| Rule | Check | Starting points |
|---|---|---|
| `ssrf` | Server-side fetches to user-supplied URLs go through an allowlist and block private address ranges. | `fetch(` with a URL from input or the database |

## Multi-tenant systems

Read `docs/agents/stack.md` for how tenancy is enforced (a tenant column, a scoped repository, row-level security).

| Rule | Check |
|---|---|
| `missing-tenant-predicate` | **Every** query that reads or writes tenant-owned rows filters by the tenant from the session. Trace each route to every query it reaches, including helpers and joins. |
| `tenant-from-request` | The tenant id comes from the session or a verified host mapping, never a header, body field or query param the client controls. |
| `cross-tenant-cache` | Cache keys (KV, CDN, in-memory) for tenant data include the tenant id. |
| `cross-tenant-storage` | Object storage keys (R2, S3) include the tenant id, and signed URLs are scoped and short-lived. |
| `tenant-isolation-untested` | An integration test proves that tenant B gets a not-found for tenant A's records on the riskiest routes. |
| `admin-impersonation-unaudited` | Platform-admin access to tenant data is explicit, logged and reviewable. |

## Workers and edge runtimes

| Rule | Check | Starting points |
|---|---|---|
| `secret-in-vars` | Secrets are in `wrangler secret` or the secrets store, never in `[vars]`/`vars` in the wrangler config. | `wrangler.toml` / `wrangler.jsonc` `vars` |
| `global-request-state` | No per-request data stored in module-level variables (it leaks across requests in the same isolate). | `let` at module scope assigned inside handlers |
| `floating-promise` | No un-awaited promises (lost errors, cut-off work); background work uses `ctx.waitUntil`. | Calls returning promises without `await`/`return`/`waitUntil` |
| `fetch-without-timeout` | Outbound `fetch` has `AbortSignal.timeout`. | `fetch(` without `signal` |
| `public-asset-leak` | Nothing sensitive is served from the assets directory (source maps with secrets, `.env`, backups). | Assets dir listing |

## AI features

| Rule | Check |
|---|---|
| `prompt-injection-path` | Untrusted text (user input, uploaded documents, email, web pages, third-party records) reaches a prompt of a model that can call tools, write data, send messages or browse. Mitigate with separation (the model reading untrusted text holds no write tools), allowlisted tools, or human approval. |
| `llm-output-unsafe` | Model output is used as HTML, SQL, a shell command, a URL or a file path without validation or escaping. |
| `llm-data-exposure` | Prompts include data the user shouldn't see (other tenants' records, secrets), or data a constraint in PRODUCT.md forbids sending to the provider. |
| `llm-cost-unbounded` | LLM calls have max tokens, timeouts and per-user rate limits. |
