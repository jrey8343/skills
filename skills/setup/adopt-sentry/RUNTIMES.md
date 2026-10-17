# Runtime setup shapes

> **Verify against current docs before writing code.** These are shapes, not copy-paste snippets. SDK APIs, package names and compatibility change. Resolve versions with `npm view` and read the current guide (sentry MCP `search_docs`/`get_doc`, or docs.sentry.io) for each runtime. Facts below were checked in October 2026.

## Cloudflare Workers

- Package: `@sentry/cloudflare`. Needs the `nodejs_compat` compatibility flag and a recent `compatibility_date` (the guide states the minimum).
- **Plain wrangler**: wrap the exported handler.

  ```ts
  import * as Sentry from "@sentry/cloudflare";

  export default Sentry.withSentry(
    (env: Env) => ({
      dsn: env.SENTRY_DSN,
      release: env.CF_VERSION_METADATA?.id,
      environment: env.ENVIRONMENT,
      sendDefaultPii: false,
      tracesSampleRate: env.ENVIRONMENT === "production" ? 0.1 : 1.0,
      beforeSend: scrubEvent, // see PRIVACY.md
    }),
    { fetch: app.fetch, scheduled, email } satisfies ExportedHandler<Env>,
  );
  ```

- **Vite-built Workers**: the SDK also ships a Vite plugin (`@sentry/cloudflare/vite`) for build-time instrumentation; check the guide for when to prefer it.
- Recent major versions instrument D1, R2, queues and Durable Object bindings automatically. Check the changelog rather than adding manual wrappers.
- **Release**: add a version metadata binding (`[version_metadata] binding = "CF_VERSION_METADATA"`) and use its `id`, or set `SENTRY_RELEASE` at deploy time.
- **Source maps**: `upload_source_maps = true` in the wrangler config, plus a CI step that uploads them to Sentry (the Sentry wizard's `sourcemaps` flow, or `sentry-cli sourcemaps upload` with the release). The auth token comes from 1Password.

### Hono on Workers

`@sentry/hono` provides middleware for Hono on Cloudflare (`import { sentry } from "@sentry/hono/cloudflare"`, then `app.use(sentry(app, (env) => ({ dsn: env.SENTRY_DSN, … })))`). Its `@sentry/cloudflare` peer must be the same version. Use it **or** `withSentry`, not both. Check the guide for which one covers `scheduled` and `email` handlers in your version.

## Browser clients

- Framework SDKs: `@sentry/svelte`, `@sentry/react`, `@sentry/vue` and others; otherwise `@sentry/browser`.
- Add `Sentry.feedbackIntegration({ colorScheme: "system", autoInject: false })` and open it from your own "Send feedback" control, so it fits the UI.
- `tracePropagationTargets`: only your own API origins, never third parties.

## Astro

- `@sentry/astro` supports Node runtimes. On the Cloudflare adapter it needs recent Astro and adapter majors (in October 2026: Astro 6+ with `@astrojs/cloudflare` 13+). Check the repo's versions.
- If unsupported, instrument the client with the framework or browser SDK in a client-side entry, and the server through the Worker setup above.

## Capacitor (iOS and Android)

- Package: `@sentry/capacitor`, plus a companion browser or framework SDK **pinned to the exact version** the Capacitor SDK declares in its peer dependencies (`npm view @sentry/capacitor peerDependencies`).
- **Warning**: when the native app and the web app share one bundle, the web client must use that same pinned line, which may be a major version behind the Workers SDK. That's fine, because they are separate projects, but it decides which docs version to follow for the client.
- Native crash reporting needs the iOS and Android setup steps from the guide (dSYM and ProGuard/R8 mapping uploads in the native build).
- Check Capacitor major-version support in the SDK's changelog.

## Node, Next, other runtimes

Follow the guide for the runtime. The same rules apply: privacy defaults, release and environment, source maps, feedback on user-facing clients.

## Projects and DSNs

- One Sentry project per deployable surface (API, web, native).
- DSNs are public. Store them as config (`[vars]`, build-time env), not as secrets.
- Tag events with a `surface` and, where the app is multi-tenant, an opaque tenant id. Never a tenant name or user email.
