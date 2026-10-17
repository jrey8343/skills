# Stack

What this repo is built on, so skills don't have to rediscover it each run. `/setup-standards` drafts this from what it detects; keep it current by hand or by re-running the skill. Facts the environment already states (exact dependency versions, script bodies) are pointed at, not copied.

## Runtime and deploy

- **Runtime**: {e.g. Cloudflare Workers (Hono), with static assets}
- **Deploy**: {how a change reaches production, e.g. CI `deploy` job on push to main running `wrangler deploy`}
- **Environments**: {production, preview, local; their URLs}
- **Config**: {e.g. `wrangler.toml`}

## Code

- **Languages and frameworks**: {e.g. TypeScript (strict), Astro, Svelte}
- **Package manager / workspaces**: {e.g. pnpm workspaces: `.` and `worker/`}
- **Slice root for new capabilities**: {e.g. `worker/src/features/`, `src/features/`}
- **Assert helper**: {path, or "not yet created"}

## Data

- **Stores**: {e.g. D1 via Drizzle (schema at ...), KV, R2}
- **Migrations**: {where, and how they run}
- **Tenancy**: {single-tenant, or how tenant isolation is enforced (the column, the guard)}

## Auth

- {library, methods, roles, where guards live}

## Tests

| Kind | Framework | Location | Command |
|---|---|---|---|
| Unit | {vitest} | {path} | `{command}` |
| Integration | {vitest-pool-workers} | {path} | `{command}` |
| e2e | {Playwright} | {path} | `{command}` |

- **CI**: {workflow file and what it runs}

## Error tracking and observability

- **Errors**: {Sentry project(s) and SDKs per runtime, or what is used instead}
- **Logs / traces**: {e.g. Workers Logs, Sentry tracing}
- **User feedback**: {Sentry feedback widget, support email path}

## Secrets

- **Store**: {1Password vaults, or current state}
- **Local dev**: {e.g. `op run --env-file=.env.op -- wrangler dev`}
- **Production**: {e.g. `op inject ... | wrangler secret bulk`}
- **CI**: {e.g. 1Password service account via load-secrets-action}

## Platform limits (for napkin math)

- {e.g. Workers CPU time per request, subrequests per request, D1 rows read per query, KV write rate, request body size}

## Other repos

- **Marketing / user docs site**: {repo and local path, see docs-targets.md}
- {other sibling repos this one depends on}

## MCP servers

- {e.g. cloudflare (mcp.cloudflare.com, OAuth), sentry (mcp.sentry.dev, OAuth)}
