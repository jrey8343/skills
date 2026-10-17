# Secrets

## The one rule

**A secret value never enters the context.** Report the file and the key name, never the value. Don't `cat`, `Read` or print a file you believe holds live secrets. Grep for key **names** and patterns with `-l` (filenames only), or with `-o` and a pattern that captures the name but not the value. If a tool output shows a value by accident, don't repeat it in findings, issues or messages; treat it as exposed and say so.

## What counts as a secret

- API keys and tokens for third parties (payments, email, LLM providers, telephony, storage).
- Signing and encryption keys: session secrets, JWT keys, webhook signing secrets, private keys.
- Database URLs with credentials, service-account JSON, OAuth client secrets.
- Not secrets (but check the context): publishable or public keys meant for the client, Sentry DSNs, VAPID public keys, Firebase client config. Flag them only if they are labelled secret elsewhere, or used server-side as if secret.

## Where to look

| Rule | Where | How (names only) |
|---|---|---|
| `secret-file-tracked` | Tracked files that typically hold secrets | `git ls-files \| grep -E '(^\|/)(\.env(\..*)?\|\.dev\.vars(\..*)?\|.*\.pem\|.*\.key\|id_rsa.*\|.*credentials.*\.json\|service-account.*\.json)$'`. Templates and examples (`.example`, `.tpl`, `.op`) are fine if they hold no values: check by grepping for value-shaped strings with `-c`. |
| `secret-in-vars` | Wrangler and framework config committed to git | `vars` / `[vars]` blocks: list key names whose names suggest secrets (`SECRET`, `TOKEN`, `KEY`, `PASSWORD`, `PRIVATE`). |
| `secret-in-code` | Source files | `grep -rlE` for provider prefixes: `sk_live_`, `sk_test_`, `rk_live_`, `whsec_`, `ghp_`, `github_pat_`, `xox[abp]-`, `AKIA[0-9A-Z]{16}`, `AIza[0-9A-Za-z_-]{35}`, `-----BEGIN (RSA \|EC \|OPENSSH )?PRIVATE KEY-----`, `sk-ant-`. Report the file and the provider, not the match. |
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

For an exposed secret, the recommendation always starts with **rotate**, then remove, then prevent ("move to the secret store; if 1Password is the standard here, run `/adopt-1password`"). Removing it from git without rotating leaves it exposed.
