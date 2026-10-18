# Vault layout

## Vaults

| Vault | Holds | Who reads it |
|---|---|---|
| `<repo>-dev` | Development and test values: sandbox API keys, local signing secrets | Every developer on the project |
| `<repo>-prod` | Production values | The people who deploy; never CI analysis jobs |
| `<repo>-ci` | Only what deploy jobs need: deploy tokens | The CI service account (read-only), plus admins |

Add `<repo>-staging` only if a staging environment exists. Scheduled audits get a vault of their own, `<repo>-audits`, with its own service account. A job that runs a model must never share a vault or a service account with deploy jobs, and the audits load read-only tokens under the same names (`CLOUDFLARE_API_TOKEN`, `SENTRY_AUTH_TOKEN`) as the deploy tokens. The schedule-audits skill sets that vault up. For a solo developer, one personal account with these three vaults is fine; the separation matters most for the CI vault.

## Items

- **One item per secret**, titled exactly with the env var name: `STRIPE_SECRET_KEY`.
- Category **Password** (or **API Credential**), value in the `password` (or `credential`) field.
- Tags: the repo name and the environment.
- Reference format: `op://<vault>/<item>/<field>`, e.g. `op://bookings-dev/STRIPE_SECRET_KEY/password`.
- Notes field: where the value comes from (the dashboard path) and how to rotate it. Never the value itself.

## Importing values from an existing plaintext file

The human runs this; the agent writes it, never runs it. It reads `KEY=VALUE` lines and pipes one JSON item template per key to `op item create` on **stdin**, because values in command arguments are visible to other processes and shell history (1Password's own `op item create --help` warns about this).

```js
#!/usr/bin/env node
// import-dotenv-to-1password.mjs <file> <vault>
// Reads KEY=VALUE pairs and creates one Password item per key. Prints key names only.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const keysMax = 200;
const [file, vault] = process.argv.slice(2);
if (!file || !vault) throw new Error("usage: import-dotenv-to-1password.mjs <file> <vault>");

const lines = readFileSync(file, "utf8").split("\n").filter((line) => /^[A-Z0-9_]+=/.test(line));
if (lines.length > keysMax) throw new Error(`more than ${keysMax} keys; refusing`);

for (const line of lines) {
  const key = line.slice(0, line.indexOf("="));
  const value = line.slice(line.indexOf("=") + 1).replace(/^(["'])(.*)\1$/, "$2");
  const item = {
    title: key,
    category: "PASSWORD",
    fields: [{ id: "password", type: "CONCEALED", purpose: "PASSWORD", label: "password", value }],
  };
  const result = spawnSync("op", ["item", "create", "--vault", vault, "--format", "json", "-"], {
    input: JSON.stringify(item),
    stdio: ["pipe", "ignore", "inherit"],
  });
  console.log(`${result.status === 0 ? "created" : "FAILED "} ${key}`);
}
```

Verify the item JSON shape against `op item template get Password` for the installed CLI before handing this over. If an item already exists, `op item create` makes a duplicate. Tell the human to check `op item list --vault <vault>` (it lists titles only) before re-running.

## Rotation

Rotate in the provider's dashboard, update the 1Password item, then run `secrets:sync` (production) or restart `dev` (local). Nothing in the repo changes, because the references stay the same.
