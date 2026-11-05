# Cloudflare Workers

Read this when the repo deploys to Cloudflare Workers (a `wrangler.toml`, `wrangler.json` or `wrangler.jsonc` is present). It adds stack detail to the coverage map; the rules and severities don't change.

## Integration stand-ins

- The local stand-in for slice integration tests is `@cloudflare/vitest-pool-workers`, which runs tests inside the Workers runtime with local D1, KV, R2, Durable Objects and Queues. Find it in the Vitest config (`poolOptions.workers` or `defineWorkersConfig`).
- A slice test that mocks a binding (`env.DB`, `env.KV`, …) by hand instead of using the pool's local binding is testing past the interface: `test-past-interface`, recommending the pool.
- D1 migrations must be applied in the test setup (for example via `applyD1Migrations` with the migrations the config reads). A suite whose tests pass against an empty schema is thin, not covered.

## Finding the seams

- The Worker's entry (`main` in the wrangler config) is the shell. Routes it registers, grouped per feature, are slice candidates when the repo's placement names no slice root.
- Scheduled (`scheduled`), queue (`queue`) and Durable Object handlers are slice interfaces too; each needs an integration test that drives the handler, not only the core it calls.

## CI

- A Vitest project configured with the Workers pool but excluded from the CI test command is `ci-missing-suite`.
- e2e against `wrangler dev` or a preview deployment counts as e2e; check that CI starts the app (or targets the preview) before the e2e command runs.
