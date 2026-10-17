# Audits

Settings for the audit skills and for the scheduled workflow that `/schedule-audits` renders from this file. Edit freely; re-run `/schedule-audits` after changing schedules or models.

Times are UTC. Pick times when nobody is waiting on CI, off the hour.

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

audits:
  sentry-triage:
    cron: "17 20 * * *"      # daily
    window_days: 7
  security-audit:
    cron: "23 19 * * 0"      # weekly
  test-audit:
    cron: "41 19 * * 1"      # weekly
  docs-audit:
    cron: "7 20 * * 2"       # weekly
  perf-audit:
    cron: "29 19 1,15 * *"   # fortnightly
  prune-docs:
    cron: "53 19 8,22 * *"   # fortnightly
  improve-codebase-architecture:
    cron: "11 19 3 * *"      # monthly
    model: claude-opus-5-5
  product-review:
    cron: "37 19 5 * *"      # monthly
  persona-review:
    cron: "47 19 7 * *"      # monthly
    live_targets: []         # non-production URLs only, e.g. ["http://localhost:8788"]; empty = static review only
```

## Notes

- **Disable an audit** by deleting its entry.
- **`live_targets`** must never include production. Persona review drives the app with seeded test data only.
- **Budgets** for perf-audit live in `docs/agents/perf-budgets.md` (perf-audit drafts it on first run).
- **Policy constraints** (data residency, regulated data) that audits must respect are listed in `PRODUCT.md` under Constraints.
