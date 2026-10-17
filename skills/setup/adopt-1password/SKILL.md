---
name: adopt-1password
description: "Move this repo's secrets into 1Password so local dev, deploys and CI read op:// references, and no plaintext secret lives in the repo or in the model's context."
disable-model-invocation: true
---

# Adopt 1Password

Replace plaintext secret files and hand-pasted `wrangler secret put` calls with **`op://` references**. Local dev, production deploys and CI resolve those references at the moment of use, so secret values sit in 1Password and nowhere else.

## The one rule

**You never see a secret value.** Work with secret *names* only.

- Never run `op read`, `op item get --reveal`, `op inject` to stdout, or any command that prints a value.
- Never `cat`, `head`, `grep -v` or otherwise display `.env*`, `.dev.vars*` or secret JSON. Read key names only: `cut -d= -f1 <file> | grep -v '^#'`.
- Never put a value in a command you run, a file you write, or a message.
- Scripts that move values (import, sync) are written by you and **run by the human**. When something needs a value to test, ask the human to run it and report pass or fail.

If a value appears in your context anyway (pasted, or printed by a tool), say so, stop, and tell the user to rotate that secret.

## Process

### 1. Inventory names

Build one table of every secret-like name and where it is used, from:

- key names in `.dev.vars*`, `.env*` and `*.example` files (with `cut -d= -f1`);
- `npx wrangler secret list` (names only) for each environment;
- `gh secret list` and `gh variable list`, plus every `secrets.*` reference in `.github/workflows/`;
- `env.<NAME>` and `process.env.<NAME>` reads in code, and the Worker's `Env`/`Bindings` type;
- plain `[vars]` in the wrangler config, and runbooks that mention `wrangler secret put`.

Note duplicates: the same name in several checkouts, worktrees or example files.

### 2. Classify

Mark each name **secret** (API keys, signing secrets, tokens, passwords), **config** (non-secret settings that vary by environment) or **public** (safe in a bundle, e.g. a Sentry DSN or a publishable key). Only secrets move to 1Password; config stays in `[vars]` or `.env.op` as literals; public values may stay in code. Flag anything in `[vars]` that looks secret-ish (link-signing keys, shared secrets) for the user to decide.

Confirm the table with the user before going on.

### 3. Plan the vaults

Propose the layout in [VAULT-LAYOUT.md](VAULT-LAYOUT.md): `<repo>-dev`, `<repo>-prod` and `<repo>-ci`, one item per secret, named after the env var. Ask which 1Password account to use (`op account list` shows account names, not secrets).

### 4. Move the values (human-run)

Call the Skill tool with "wizard" to build a script for the human. Its stages:

1. Create the vaults.
2. Import existing values from the local plaintext files. The script reads them itself and pipes each value to `op item create` on stdin, as VAULT-LAYOUT.md shows, so values never appear in arguments or output.
3. Paste in values that exist only in dashboards (prod secrets), using hidden input.
4. Create the CI service account with read access to `<repo>-ci` only, and set `OP_SERVICE_ACCOUNT_TOKEN` as the one GitHub secret.

Hand it over; the human runs it.

### 5. Wire the references

Following [WRANGLER.md](WRANGLER.md) (or its generic `.env` section for non-Cloudflare apps):

- Write `.env.op`: `op://` references for local dev. Safe to commit; it holds no values.
- Write `secrets.production.json.tpl` (and one per extra environment): `op://` references for deploy.
- Add package scripts: `dev` via `op run --env-file=.env.op -- wrangler dev`, and `secrets:sync` via `op inject -i secrets.production.json.tpl | wrangler secret bulk`.
- Check the installed `wrangler --version` against the current docs for `CLOUDFLARE_INCLUDE_PROCESS_ENV` and the `secrets.required` config property, and use them only if supported. Tell the user what you verified and how.
- Gitignore `.dev.vars*`, `.env`, `.env.local`, and any generated secret files.

### 6. Wire CI

Update workflows per [CI.md](CI.md): `1password/load-secrets-action@v5` loads exactly the values a job needs, and the service account token goes only to that step. Never pass `OP_SERVICE_ACCOUNT_TOKEN`, or the whole environment, to an AI step.

### 7. Verify (human-run), then remove plaintext

Ask the human to run `pnpm dev` (or the repo's dev command), the test suite, and a dry run of `secrets:sync` against a non-production environment, and report the results. Only when they confirm, offer to delete the plaintext files, listing each path, and repeat the list for stale checkouts and worktrees that hold copies. Delete only on an explicit yes.

### 8. Document

- Update the Secrets section of `docs/agents/stack.md`.
- Write `docs/runbooks/secrets.md`: adding a secret, rotating one, onboarding a developer, and the CI service account.
- If the repo previously documented a different approach (manual `wrangler secret put`, shared `.dev.vars`), call the Skill tool with "domain-modeling" and record an ADR for the switch, then replace the old instructions with pointers to the runbook.
- Optional, local only: the 1Password Environments MCP server and Claude Code plugin (beta) let agents list and mount environments without returning values. Mention it; don't install it unasked.

Leave the changes uncommitted for review unless the user asks you to commit.
