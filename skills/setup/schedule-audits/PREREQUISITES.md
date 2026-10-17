# Prerequisites

Check each item, and list the ones the human must do. Generate the wizard stages from this list.

| # | Prerequisite | How to check (agent) | Human step |
|---|---|---|---|
| 1 | `docs/agents/audits.md` exists | File exists | Run `/setup-standards` |
| 2 | `docs/agents/triage-labels.md` exists (for the triage label) | File exists | Run `/setup-standards` |
| 3 | A 1Password vault for CI, conventionally `<repo>-ci` | Ask; `op vault list` shows names only | Create the vault |
| 4 | Vault item `CLAUDE_CODE_OAUTH_TOKEN` | Ask (never read it) | Run `claude setup-token` locally (a one-year token tied to the subscription of whoever creates it) and store the output in the vault without printing it to a shared terminal |
| 5 | Vault item `SENTRY_AUTH_TOKEN`, if `sentry-triage` or `perf-audit` is enabled and Sentry is in use | Ask | Create a Sentry auth token with **read** scopes only (`org:read`, `project:read`, `event:read`) and store it |
| 6 | Vault item `CLOUDFLARE_API_TOKEN`, if the stack is on Cloudflare and audits use the Cloudflare MCP | Ask | Create a Cloudflare API token with **read-only** permissions on the account and zone and store it |
| 7 | A 1Password service account with **read** access to the CI vault only | Ask | 1Password → Developer → Service accounts → create; grant read on `<repo>-ci` |
| 8 | GitHub secret `OP_SERVICE_ACCOUNT_TOKEN` | `gh secret list` shows the name | `gh secret set OP_SERVICE_ACCOUNT_TOKEN` (the wizard's `set_secret`) |
| 9 | Actions enabled, and the default branch protected | `gh api repos/{owner}/{repo}/actions/permissions` | Enable Actions in settings if disabled |
| 10 | Pushing workflow files is possible | `git remote get-url origin`: SSH needs nothing; HTTPS needs the `workflow` scope (`gh auth status` lists scopes) | `gh auth refresh -s workflow` |
| 11 | (Only for the optional fix job) the Claude GitHub App is installed | `gh api repos/{owner}/{repo}/installation` or ask | Run `/install-github-app` in Claude Code, or install from github.com/apps/claude |

## Notes

- Analysis jobs use the workflow's own read-only `GITHUB_TOKEN`, so the Claude GitHub App is **not** required unless you enable the fix job.
- Only `OP_SERVICE_ACCOUNT_TOKEN` is stored in GitHub. Every other value lives in 1Password and is loaded into one step at a time.
- Tokens given to the analysis job must be read-only and low-value: a prompt-injected model could try to include them in a finding. The workflow refuses to publish findings that contain any loaded secret value, but scope the tokens as if that guard didn't exist.
- If the repo already uses `/adopt-1password`, reuse its CI vault and service account.
