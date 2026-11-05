# 1Password for scheduled audits

The Claude token a scheduled run uses lives in 1Password. GitHub holds one secret for it, `OP_SERVICE_ACCOUNT_TOKEN`, for a service account that can read one vault and nothing else. Each job loads the Claude token at the step that needs it, and the service account token never reaches the model.

## Layout

| What | Name | Notes |
|---|---|---|
| Vault | `<repo>-audits` | Holds only what audit runs need. A job that runs a model never shares a vault or a service account with deploy jobs. |
| Item | `CLAUDE_CODE_OAUTH_TOKEN` | Category **Password**, value in the `password` field. Notes: "from `claude setup-token`; expires; rotate by running it again". Never the value itself. |
| Reference | `op://<repo>-audits/CLAUDE_CODE_OAUTH_TOKEN/password` | What `ci.claude_token` in `docs/agents/audits.md` holds. |
| Service account | `<repo>-audits` | Read-only (`read_items`) on `<repo>-audits` only. |
| GitHub secret | `OP_SERVICE_ACCOUNT_TOKEN` | The service account's token. The only 1Password secret in GitHub. |

## Wizard stages

Call the Skill tool with `wizard` and give it these stages. The human runs the script; you never run a stage that handles a value.

1. **Create the vault.** `op vault create <repo>-audits` in the 1Password account the human picks (`op account list` shows account names, not secrets).
2. **Store the Claude subscription token.** The human runs `claude setup-token` while signed in to the Claude subscription that should pay for audits, and pastes the token into hidden input (`read -rs`). The script pipes a Password item template holding it to `op item create --vault <repo>-audits -` on **stdin**, so the value never appears in arguments, output or shell history. Check the item JSON against `op item template get Password` for the installed CLI first.
3. **Create the service account and hand its token to GitHub.** `op service-account create <repo>-audits --vault <repo>-audits:read_items --raw | gh secret set OP_SERVICE_ACCOUNT_TOKEN`. `--raw` makes it print the bare token, with no message around it, and `gh secret set` reads it from stdin, so it is never shown. Check the flags against `op service-account create --help` for the installed CLI. The token is shown only once: if the pipe fails, delete the service account and run the stage again.
4. **Check.** `gh secret list` names `OP_SERVICE_ACCOUNT_TOKEN`; `op item list --vault <repo>-audits` lists `CLAUDE_CODE_OAUTH_TOKEN` (titles only).

## Rules

- `export-env: false`, with the value passed by `steps.op.outputs.CLAUDE_CODE_OAUTH_TOKEN` to the one step that runs Claude. Loaded values are masked in logs.
- `OP_SERVICE_ACCOUNT_TOKEN` goes to the 1Password step only. Never pass it, or the whole environment, to the step that runs a model.
- No `ANTHROPIC_API_KEY` anywhere in the workflow: Claude Code prefers an API key over the subscription token when both are set, and an API key bills per token.
- The workflow pins `1password/load-secrets-action` to a major version in the renderer; check the action's README for the current major and inputs when bumping it.

## Rotation

`claude setup-token` tokens expire. When runs start failing on authentication, the human runs `claude setup-token` again and updates the item's `password` field (the same hidden-input, stdin route as stage 2). Nothing in the repo changes, because the reference stays the same.
