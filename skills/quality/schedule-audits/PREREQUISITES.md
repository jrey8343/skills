# Prerequisites

Check each item, and list the ones the human must do. Generate the wizard stages from this list.

| # | Prerequisite | How to check (agent) | Human step |
|---|---|---|---|
| 1 | `docs/agents/audits.md` exists, with `ci.claude_token`, `skills.sha` and `skills.matt.sha` filled in | The renderer runs without refusing | Step 1 of the skill |
| 2 | The repo is on GitHub and `gh` is authenticated | `gh repo view --json nameWithOwner` | `gh auth login` |
| 3 | `docs/agents/issue-tracker.md` exists, so `report-findings` knows the tracker | File exists | Run `/setup-matt-pocock-skills` |
| 3a | Optional: `docs/agents/triage-labels.md`, only when the repo renamed its triage state labels; otherwise the publisher's built-in defaults apply | File exists, or the repo uses the default label names | Nothing, unless labels were renamed: then run `/setup-matt-pocock-skills` with Matt's `triage` installed |
| 4 | The `<repo>-audits` vault holds `CLAUDE_CODE_OAUTH_TOKEN`, a subscription token | Ask the human; the agent never lists vault contents | [ONEPASSWORD.md](ONEPASSWORD.md), stages 1 and 2 |
| 5 | GitHub secret `OP_SERVICE_ACCOUNT_TOKEN` exists, for a service account that reads only that vault | `gh secret list` names it | [ONEPASSWORD.md](ONEPASSWORD.md), stage 3 |
| 6 | With `github_auth: pat`: secret `AUDITS_GITHUB_TOKEN` exists | `gh secret list` names it | [GITHUB-TOKEN.md](GITHUB-TOKEN.md), PAT |
| 7 | With `github_auth: app`: variable `AUDITS_APP_CLIENT_ID` (the App's Client ID) and secret `AUDITS_APP_PRIVATE_KEY` exist | `gh variable list`, `gh secret list` | [GITHUB-TOKEN.md](GITHUB-TOKEN.md), App |
| 8 | The skills repository at `skills.sha` is reachable from Actions | `gh repo view <skills.repository> --json visibility` says `PUBLIC` | Pin a public skills repository, or give the skills checkout step a token that can read it |
| 9 | Matt's skills at `skills.matt.sha` are reachable from Actions, so the audits' calls to Matt's skills by name (`domain-modeling`, `writing-for-agents`, `tdd`) resolve | `gh api repos/<skills.matt.repository>/commits/<skills.matt.sha> --jq .sha` prints the sha | Pin a commit that exists in a public repository |

## Notes

- `gh secret list` and `gh variable list` print names, never values. That is all the agent needs.
- The repo's GitHub Actions must be enabled. In a public repo, GitHub disables scheduled workflows after 60 days without repository activity. Re-enable them from the Actions tab.
