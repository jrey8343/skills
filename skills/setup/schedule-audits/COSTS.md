# Costs and tuning

Scheduled audits spend three things: Claude usage (on the subscription that issued `CLAUDE_CODE_OAUTH_TOKEN`), GitHub Actions minutes (free on public repos; metered on private ones), and attention (issues someone has to read).

## Estimate before enabling

```
runs/month   = sum over audits of runs per month at its cadence
                 (daily ≈ 30, weekly ≈ 4.3, fortnightly = 2, monthly = 1),
               minus runs skipped for "no commits since the last run"
turns/run    ≈ well under max_turns for an incremental run; near it for a full one
minutes/run  ≈ 3–15 on a GitHub-hosted runner (persona-review with a browser is the slowest)
```

With the balanced defaults in `audits.md` (one daily, three weekly, two fortnightly, three monthly), that's about 50 runs a month before skips. On an active repo, skips remove only a few.

For scale, from the first full-scope dry runs on one mid-sized repo (October 2026): each Sonnet audit cost $0.15–$0.35 of usage over 14–36 turns and 1–3 runner minutes, and persona-review took about 3 minutes, booting the app included. The Opus architecture audit, with its explorers running to completion, cost about $3.50 and took 6 minutes. The result message's `total_cost_usd` is in each analyse log.

Each run also loads the repo's `CLAUDE.md` before doing anything. A bloated agent doc multiplies across every run, so run `/prune-docs` first.

## The subscription caveat

The OAuth token draws on the same plan as your interactive sessions, with the same rate limits. Audits that run while you're working compete with you. Mitigations:

- schedule outside your working hours (crons are UTC);
- `max-parallel: 2` in the analyse matrix;
- per-audit `max_turns` and `timeout_minutes`;
- a cheaper model (`claude-sonnet-5-5`) for everything but architecture.

If runs start failing on rate limits, move to an Anthropic API key with spend limits, or reduce cadence.

## Tuning

| Symptom | Change in `docs/agents/audits.md` |
|---|---|
| Too many issues | Raise `severity_min`, lower `new_issues_max` |
| Same finding keeps coming back after a fix | It's a regression. The issue is reopened with the `regression` label; fix the root cause or close it as not planned to suppress it |
| A run hits `max_turns` | Raise it for that audit, or narrow `scope_ignore` |
| A run calls itself partial and skips areas, well under `max_turns` | The audits see `max_turns` in `audits.md` and seem to budget for it. Raise it for that audit if you want the whole checklist each run |
| An audit never finds anything | Drop its cadence to monthly, or remove it |
| Sentry triage is noisy | Raise `severity_min` for it; set Sentry inbound filters |
| Runs collide with your work | Move the crons; they're UTC |

Possible later optimisation: a cheap pre-check in the plan job that skips `sentry-triage` when the Sentry API reports no new or regressed issues since the last run. It needs the Sentry token in the plan job, so it is left out by default.

## Scheduled-workflow quirks (GitHub)

- Scheduled runs only run from the default branch's copy of the workflow.
- In **public** repos, GitHub disables scheduled workflows after 60 days without repository activity. Re-enable them in the Actions tab.
- Scheduled runs are attributed to whoever last edited the cron lines, and can start late under load.
