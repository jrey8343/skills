# Audits

Settings for the audit skills, and for the scheduled CI runs that `/schedule-audits` renders from this file into `.github/workflows/audits.yml`. Edit freely; run `/schedule-audits` again after changing schedules, models or the `ci` and `skills` blocks.

Crons are **UTC** (GitHub Actions runs schedules in UTC). Pick times when nobody is working, off the hour: GitHub delays runs queued at the top of the hour. Models are Claude model ids or aliases, as `claude --model` takes them; scheduled runs bill the Claude subscription, so a metered model is refused.

```yaml
defaults:
  model: claude-sonnet-5-5
  max_turns: 60
  timeout_minutes: 30
  severity_min: medium       # findings below this stay in the tracking issue, not as issues
  new_issues_max: 5          # per audit, per run
  subagents_max: 4           # parallel explorers per audit run
  scope_ignore:              # never audited
    - "dist/**"
    - "node_modules/**"
    - "**/*.snap"

ci:
  claude_auth: subscription  # the only value scheduled runs accept: never per-token billing
  claude_token: "op://<repo>-audits/CLAUDE_CODE_OAUTH_TOKEN/password"
  github_auth: pat           # pat: secret AUDITS_GITHUB_TOKEN; app: variable AUDITS_APP_CLIENT_ID and secret AUDITS_APP_PRIVATE_KEY
  dry_run: true              # plan only, publish nothing; set false after a week of clean runs
  claude_code_version: latest   # or pin an exact version, e.g. 2.1.0
  runner: ubuntu-latest

skills:
  repository: jrey8343/skills
  sha: ""                    # the full commit the workflow installs the audit skills from
  matt:                      # Matt Pocock's skills, which the audits call by name
    repository: mattpocock/skills
    sha: ""                  # the full commit your install pins (Fabrik's skills.lock.json)

third_party_text: []         # sources in use that the repo doesn't show: sentry, user-feedback, cloudflare-mcp

audits:
  security-audit:
    cron: "23 19 * * 0"      # weekly
  test-audit:
    cron: "41 19 * * 1"      # weekly
  docs-audit:
    cron: "7 20 * * 2"       # weekly
  perf-audit:
    cron: "29 19 1,15 * *"   # fortnightly
    live_targets: []         # interactive runs only (Core Web Vitals pass). Non-production URLs
  prune-docs:
    cron: "53 19 8,22 * *"   # fortnightly
  product-review:
    cron: "37 19 5 * *"      # monthly
  persona-review:
    cron: "47 19 7 * *"      # monthly
    live_targets: []         # interactive runs only; scheduled runs are static. Non-production URLs, e.g. ["http://localhost:8788"]
```

## Notes

- **Disable an audit** by deleting its entry. Re-running `/schedule-audits` removes its job.
- **Overrides**: any default can be set per audit (`model`, `max_turns`, `timeout_minutes`, `severity_min`, `new_issues_max`, `subagents_max`, `scope_ignore`). An audit can also declare `reads: [user-feedback]` when it reads a third-party source the schedule-audits skill doesn't already know about.
- **Third-party text**: an audit that reads text others wrote (Sentry events, user feedback, the Cloudflare MCP) is left out of the schedule while that source is in use. Run it by hand.
- **`live_targets`** (perf-audit's Core Web Vitals pass, persona-review's live pass) apply to interactive runs only: a scheduled run never boots or drives the app. They must never include production. Persona review drives the app with seeded test data only.
- **Budgets** for perf-audit live in `docs/agents/perf-budgets.md` (perf-audit drafts it on first run).
- **Policy constraints** (data residency, regulated data) that audits must respect are listed under Constraints in the product model (`PRODUCT.md` by default; see `docs/agents/product.md`).
