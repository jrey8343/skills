# Secrets

## The one rule

**A secret value never enters the context.** Report the file and the key name, never the value. Don't `cat`, `Read` or print a file you believe holds live secrets, and never `git show` or `git log -p` a commit or path that holds a suspected secret (use `--name-only` or `--stat`). Search with the Grep tool in files-with-matches mode (filenames only); when you need the key name, use a pattern that matches the name but not the value. If a tool output shows a value by accident, don't repeat it in findings, issues or messages; treat it as exposed and say so.

## What counts as a secret

- API keys and tokens for third parties (payments, email, LLM providers, telephony, storage).
- Signing and encryption keys: session secrets, JWT keys, webhook signing secrets, private keys.
- Database URLs with credentials, service-account JSON, OAuth client secrets.
- Not secrets (but check the context): publishable or public keys meant for the client, Sentry DSNs, VAPID public keys, Firebase client config. Flag them only if they are labelled secret elsewhere, or used server-side as if secret.

## Where to look

| Rule | Where | How (names only) |
|---|---|---|
| `secret-file-tracked` | Tracked files that typically hold secrets | `git ls-files` with pathspecs: `git ls-files '*.env' '.env*' '**/.env*' '**/.dev.vars*' '.dev.vars*' '*.pem' '*.key' '*id_rsa*' '*credentials*.json' '*service-account*.json'`. This covers `.dev.vars` for Workers too. Templates and examples (`.example`, `.tpl`, `.op`) are fine if they hold no values: check with the Grep tool in count mode for value-shaped strings. |
| `secret-in-vars` | Deploy and framework config committed to git (plain environment-variable blocks; for Workers see [CLOUDFLARE.md](CLOUDFLARE.md)) | List key names whose names suggest secrets (`SECRET`, `TOKEN`, `KEY`, `PASSWORD`, `PRIVATE`). |
| `secret-in-code` | Source files | The Grep tool in files-with-matches mode for provider prefixes: `sk_live_`, `sk_test_`, `rk_live_`, `whsec_`, `ghp_`, `github_pat_`, `xox[abp]-`, `AKIA[0-9A-Z]{16}`, `AIza[0-9A-Za-z_-]{35}`, `-----BEGIN (RSA \|EC \|OPENSSH )?PRIVATE KEY-----`, `sk-ant-`. Report the file and the provider, not the match. |
| `secret-in-history` | Git history (full scope only) | `git log --all --diff-filter=D --name-only` for deleted secret files; `git log -S'<prefix>' --oneline` per provider prefix. A secret once committed is exposed until rotated, even if the file is now deleted. |
| `env-printed` | Code that logs or returns environment objects | `console.log(env`, `JSON.stringify(c.env`, `JSON.stringify(process.env`, error handlers serialising `env` |
| `secret-in-ci` | Workflows | Secrets echoed in `run:` steps; secrets passed to untrusted actions; `pull_request_target` with checkout of PR code |
| `secret-to-client` | Client bundles | Server-only env names referenced from client code (`import.meta.env.<SECRET>`, `PUBLIC_` prefix misuse) |

## Severity

- `critical`: a live production secret is in tracked files, history, or a client bundle.
- `high`: a test-mode or low-privilege secret is exposed, or secrets are logged on a production path.
- `medium`: a secret-like value lives in config `vars`; templates drift from the real key set.
- `low`: naming hygiene, or missing `.gitignore` entries for secret files that don't yet exist.

## Recommendation shape

For an exposed secret, the recommendation always starts with **rotate**, then remove, then prevent ("move it to the repo's secret store and load it from there"). Removing it from git without rotating leaves it exposed.
