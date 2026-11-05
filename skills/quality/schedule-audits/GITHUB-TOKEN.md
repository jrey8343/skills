# The audit GitHub token

The publisher in `report-findings` writes issues and labels with `gh`, which reads `GH_TOKEN`. That token is the repo's own: a fine-grained personal access token, or a GitHub App the repo owner creates for audits. Pick one in `ci.github_auth`.

Not the workflow's `GITHUB_TOKEN`: issues it opens don't trigger other workflows, so automation that listens for new issues (the repo's Intake or Triage) would never see a finding, and the job would need `issues: write` on a token that can do more. Not the Fabrik App, or any App the delivery loop uses: those can push and open pull requests, and audits aren't Fabrik's to run.

Either way the token holds **Issues: read and write** (Metadata: read comes with it) on this one repo, and nothing else. It can't push, can't open a pull request and can't touch Actions, so a headless run can only file issues whatever the model is told. The workflow's own `GITHUB_TOKEN` is `contents: read`, and the checkout keeps no credentials.

## `github_auth: pat`

Wizard stages:

1. In GitHub, Settings, Developer settings, Fine-grained tokens: generate a token with the repo's owner as resource owner, **Only select repositories** (this repo), repository permission **Issues: Read and write**, and an expiry the human will remember to renew.
2. `gh secret set AUDITS_GITHUB_TOKEN`, which prompts with hidden input; paste the token there and nowhere else.
3. Check: `gh secret list` names `AUDITS_GITHUB_TOKEN`.

A PAT acts as the person who made it, so findings are filed under their name. When it expires, runs fail on `gh`; generate a new one and repeat stage 2.

## `github_auth: app`

Wizard stages:

1. Create a GitHub App owned by the repo's owner: no webhook, repository permission **Issues: Read and write**, installable on this account only.
2. Install it on this repo only.
3. `gh variable set AUDITS_APP_CLIENT_ID --body <client id>`, the App's **Client ID** from its settings page (not secret; `actions/create-github-app-token` v3 takes it in place of the deprecated App ID).
4. Generate a private key and run `gh secret set AUDITS_APP_PRIVATE_KEY < <key file>`, then delete the downloaded key file.
5. Check: `gh variable list` names `AUDITS_APP_CLIENT_ID`, `gh secret list` names `AUDITS_APP_PRIVATE_KEY`.

Each job mints a short-lived installation token with `permission-issues: write`, and findings are filed as the App. Prefer the App for a team repo: nothing expires, and no person's account is in the loop.
