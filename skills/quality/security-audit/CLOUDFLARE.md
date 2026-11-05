# Cloudflare Workers

Extra checks for a repo that deploys to Cloudflare Workers (a `wrangler.toml`, `wrangler.json` or `wrangler.jsonc` is present). They run alongside [CHECKLIST.md](CHECKLIST.md), whose **Server runtimes** rows apply to Workers too. Rule ids are shared with the main checklist where the problem is the same, so fingerprints stay stable whichever file found it.

## Config and secrets

A tracked `.dev.vars` or `.dev.vars.*` (local Worker secrets) is caught by SECRETS.md's `secret-file-tracked` check; it isn't repeated here.

| Rule | Check | Starting points |
|---|---|---|
| `secret-in-vars` | Secrets are set with `wrangler secret` or the Secrets Store, never in `[vars]` / `vars` in the wrangler config. List key names only (see [SECRETS.md](SECRETS.md)). | `wrangler.toml` / `wrangler.jsonc` `vars`, including per-environment blocks |

## Isolate behaviour

| Rule | Check | Starting points |
|---|---|---|
| `global-request-state` | No per-request data in module-level variables: one isolate serves many requests, so it leaks across users and tenants. | `let` at module scope assigned inside `fetch`, `scheduled` or `queue` handlers |
| `floating-promise` | Background work after the response uses `ctx.waitUntil` (or a Queue); a bare promise is cut off when the response returns. | Calls returning promises without `await`/`return`/`waitUntil` |
| `public-asset-leak` | The static assets directory configured in the wrangler config serves nothing sensitive. | The `assets` / `site` directory in the wrangler config |

## Data bindings

| Rule | Check | Starting points |
|---|---|---|
| `sql-string-built` | D1 queries bind values with `.bind()`; no interpolation into `prepare()`. | `.prepare(\`` with `${`, `.exec(` with variables |
| `cross-tenant-cache` | KV keys for tenant data include the tenant id. | `.get(`, `.put(` on KV bindings |
| `cross-tenant-storage` | R2 object keys include the tenant id; presigned URLs are scoped and short-lived. | `.put(`, `.get(` on R2 bindings, presigned URL helpers |

## Edge posture

If a `cloudflare` MCP server is configured, read (never change) the zone settings and file what falls short. Skip this section when no such server is available, and say so in the summary.

| Rule | Check |
|---|---|
| `edge-waf-off` | WAF managed rules are enabled for the zone serving production. |
| `edge-rate-limit-missing` | Rate-limiting rules cover the auth and costly endpoints the code doesn't rate-limit itself. |
| `edge-tls-weak` | SSL/TLS mode is Full (strict), and Always Use HTTPS is on. |
| `edge-bot-settings` | Bot protection matches the exposure of public forms and sign-in. |
