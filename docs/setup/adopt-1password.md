# adopt-1password

## What it does

Moves a repo's secrets out of plaintext files and dashboard copy-paste and into 1Password, so local dev, production deploys and CI all resolve `op://` references at the moment they're used. The agent works with secret **names** only: it inventories, plans and wires everything, but every step that touches a value is a script the human runs. A secret value never enters the model's context.

## When to reach for it

You invoke this by typing `/adopt-1password`, and the agent won't reach for it on its own. Reach for it when a repo has `.env` or `.dev.vars` files with real values, secrets set by hand with `wrangler secret put`, or a pile of individual GitHub secrets. It's usually listed as the `secrets-managed` gap by [setup-standards](setup-standards.md). For the CI workflow that consumes the CI vault, use [schedule-audits](schedule-audits.md) afterwards.

## Prerequisites

- The 1Password CLI (`op`), signed in, and a 1Password account you can create vaults in.
- Writes: `.env.op` and `secrets.<env>.json.tpl` (references only, safe to commit), package scripts, `.gitignore` entries, `docs/runbooks/secrets.md`, the Secrets section of `docs/agents/stack.md`, and possibly an ADR.

## The shape it leaves behind

| Where | Before | After |
|---|---|---|
| Local dev | `.dev.vars` with real values | `op run --env-file=.env.op -- wrangler dev` |
| Production | `wrangler secret put` by hand, per key | `op inject -i secrets.production.json.tpl \| wrangler secret bulk` |
| CI | One GitHub secret per value | One GitHub secret (`OP_SERVICE_ACCOUNT_TOKEN`) for a read-only service account; values loaded per step |
| Rotation | Find every copy | Change it in 1Password, re-sync |

Three vaults by convention: `<repo>-dev`, `<repo>-prod` and `<repo>-ci`.

## Common questions

**Does the agent ever see my secrets?**
No. It reads key names (`cut -d= -f1`), never files' values, and never runs `op read`. Moving values is a wizard script you run. If a value shows up in the session anyway, it stops and tells you to rotate it.

**Is `.env.op` safe to commit?**
Yes. It contains `op://vault/item/field` references and non-secret literals, which are useless without 1Password access.

**What about plaintext copies in other checkouts or worktrees?**
It lists them, and deletes them only after you've confirmed the new path works and said yes.

## It's working if

- `git grep` finds no secret values, and the only secret-looking files are gitignored.
- A new developer runs `pnpm dev` after being added to the dev vault, with no file to copy around.
- Rotating a key means changing one 1Password item.
- GitHub shows one Actions secret.

## Where it fits

A run-once adoption skill, usually right after [setup-standards](setup-standards.md) flags the gap. It feeds [schedule-audits](schedule-audits.md), which reads its CI vault, and pairs with [adopt-sentry](adopt-sentry.md), whose auth token lands in the same vaults. See [which-skill](../productivity/which-skill.md) for the full map.
