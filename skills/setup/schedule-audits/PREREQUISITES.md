# Prerequisites

Check each item, and list the ones the human must do. Generate the wizard stages from this list.

| # | Prerequisite | How to check (agent) | Human step |
|---|---|---|---|
| 1 | `docs/agents/audits.md` exists | File exists | Run `/setup-standards` |
| 2 | `docs/agents/triage-labels.md` exists (for the triage label) | File exists | Run `/setup-standards` |
| 3 | A 1Password vault for the audits only, conventionally `<repo>-audits` (the `{{ci_vault}}` placeholder). Never a deploy vault: its item names collide with the read-only tokens below, and its service account can read write-scoped tokens | Ask; `op vault list` shows names only | Create the vault |
| 4 | Vault item `CLAUDE_CODE_OAUTH_TOKEN` | Ask (never read it) | Run `claude setup-token` locally (a one-year token tied to the subscription of whoever creates it) and store the output in the vault without printing it to a shared terminal |
| 5 | Vault item `SENTRY_AUTH_TOKEN`, if `sentry-triage` or `perf-audit` is enabled and Sentry is in use | Ask | Create a Sentry auth token with **read** scopes only (`org:read`, `project:read`, `event:read`) and store it |
| 6 | Vault item `CLOUDFLARE_API_TOKEN`, if the stack is on Cloudflare and audits use the Cloudflare MCP | Ask | Create a Cloudflare API token with **read-only** permissions on the account and zone, plus **User → User Details → Read** (the Cloudflare MCP refuses a user token without it: `403 insufficient_scope`, "Token lacks required user:read or account:read scope"), no IP filtering, and store it |
| 7 | A 1Password service account with **read** access to the audits vault only | Ask | `op service-account create <repo>-audits --vault <repo>-audits:read_items --raw`, piped straight into the next row's secret |
| 8 | GitHub environment `audits`, deployment branches limited to the default branch | `gh api repos/{owner}/{repo}/environments/audits` | `gh api -X PUT repos/{owner}/{repo}/environments/audits` with `deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}`, then `POST …/environments/audits/deployment-branch-policies` with `name: <default branch>` |
| 9 | Environment secret `OP_SERVICE_ACCOUNT_TOKEN` in `audits` | `gh secret list --env audits` shows the name | `gh secret set OP_SERVICE_ACCOUNT_TOKEN --env audits`, from the pipe in row 7 |
| 10 | Actions enabled, and the default branch protected | `gh api repos/{owner}/{repo}/actions/permissions` | Enable Actions in settings if disabled |
| 11 | Pushing workflow files is possible | `git remote get-url origin`: SSH needs nothing; HTTPS needs the `workflow` scope (`gh auth status` lists scopes) | `gh auth refresh -s workflow` |
| 12 | (Only for the optional fix job) the Claude GitHub App is installed | `gh api repos/{owner}/{repo}/installation` or ask | Run `/install-github-app` in Claude Code, or install from github.com/apps/claude |

## Notes

- Analysis jobs use the workflow's own read-only `GITHUB_TOKEN`, so the Claude GitHub App is **not** required unless you enable the fix job.
- Only `OP_SERVICE_ACCOUNT_TOKEN` is stored in GitHub, in the `audits` environment. Every other value lives in 1Password and is loaded into one step at a time.
- Tokens given to the analysis job must be read-only and low-value: a prompt-injected model could try to include them in a finding. The workflow refuses to publish findings that contain any loaded secret value, but scope the tokens as if that guard didn't exist.
- If the repo already uses `/adopt-1password`, don't reuse its CI vault or service account: that vault holds the deploy tokens, under the same names this workflow loads. Keep its secret in its own environment (`production`, say) and give the audits the separate vault, service account and `audits` environment above. A copy of the audits service-account token can live in the production vault for rotation.
- Paste tokens into the wizard from a clean clipboard: a modifier key pressed mid-paste (a window-manager shortcut, say) can add invisible non-ASCII bytes that a hidden prompt accepts. Afterwards, check each item's length and character class and make one live call to its provider, without printing the value.
