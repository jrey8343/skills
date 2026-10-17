# Wiring op:// references

## Cloudflare Workers (wrangler)

Wrangler reads local dev values from `.dev.vars` **or** `.env` files, never both: a `.dev.vars` file suppresses `.env`. The goal is neither, with values injected into the process environment at start-up.

### Local dev

`.env.op` (committed; references and non-secret literals only):

```dotenv
STRIPE_SECRET_KEY=op://<repo>-dev/STRIPE_SECRET_KEY/password
WEBHOOK_SIGNING_SECRET=op://<repo>-dev/WEBHOOK_SIGNING_SECRET/password
APP_BASE_URL=http://localhost:8787
```

Run dev with the references resolved into the child process only:

```json
{
  "scripts": {
    "dev": "op run --env-file=.env.op -- wrangler dev"
  }
}
```

For wrangler to pass those process variables to the Worker, use one of:

- **`secrets.required`** in the wrangler config, listing the secret names. Recent wrangler then loads those keys from `process.env` automatically, warns about missing keys locally, and makes `wrangler deploy` fail when a required secret isn't configured. It was added in 2026 (Cloudflare changelog, 2026-03-24); check the installed version supports it, for example by adding it and running `wrangler deploy --dry-run` to see whether wrangler warns about an unknown field.
- **`CLOUDFLARE_INCLUDE_PROCESS_ENV=true`**, with no `.dev.vars` present: `"dev": "CLOUDFLARE_INCLUDE_PROCESS_ENV=true op run --env-file=.env.op -- wrangler dev"`. Not needed when `secrets.required` is in use.

`op run` masks values in the child's output by default. Treat the masking as best effort, not a guarantee.

**Verify** both against <https://developers.cloudflare.com/workers/configuration/secrets/> for the installed wrangler version, and say which you checked.

Tests that need secrets (rare; most should use stubs) run the same way: `op run --env-file=.env.op -- pnpm test`.

### Production deploy

`secrets.production.json.tpl` (committed):

```json
{
  "STRIPE_SECRET_KEY": "op://<repo>-prod/STRIPE_SECRET_KEY/password",
  "WEBHOOK_SIGNING_SECRET": "op://<repo>-prod/WEBHOOK_SIGNING_SECRET/password"
}
```

Sync without writing plaintext to disk:

```json
{
  "scripts": {
    "secrets:sync": "op inject -i secrets.production.json.tpl | wrangler secret bulk"
  }
}
```

- `wrangler secret bulk` accepts JSON or `.env` format, up to 100 secrets per request. Reading from stdin when no file is given is **verify**: if the installed version requires a path, use process substitution instead (`wrangler secret bulk <(op inject -i secrets.production.json.tpl)`), which still writes nothing to disk.
- Add `--env <name>` for named wrangler environments, and one template per environment.
- Secrets that only CI deploys need go in `<repo>-ci` instead (see CI.md).

### Removing the old path

- Delete runbook steps that say `wrangler secret put` for each key; point to `secrets:sync`.
- Replace any committed `.dev.vars.example` with `.env.op`. It documents the same names, but every reference resolves.

## Any other runtime (generic .env path)

For Node, Vite, Next or anything that reads `process.env`:

- Commit `.env.op` (references) instead of `.env.example`.
- Run everything through `op run`: `"dev": "op run --env-file=.env.op -- vite"`.
- For tools that insist on reading a `.env` file, `op inject -i .env.op -o .env` works, but writes plaintext. Gitignore the output, and prefer `op run` wherever possible.
- Deploy platforms with their own secret store (Vercel, Fly, Render): sync with their CLI from `op inject` piped to stdin, as for wrangler above.
