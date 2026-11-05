# Costs and tuning

Scheduled audits spend three things: Claude subscription usage, GitHub Actions minutes, and attention (issues someone has to read).

## Metered models are refused

A **metered** model bills per token: through an Anthropic API key, Amazon Bedrock, Google Vertex AI, or another provider. Scheduled runs only use the Claude subscription, through the `claude setup-token` token in 1Password, so an unattended schedule can't run up a bill nobody sees.

The renderer refuses, writing nothing, when `docs/agents/audits.md` names a metered model or anything it can't recognise as a subscription model:

- `ci.claude_auth` other than `subscription` (for example `api-key`);
- a Bedrock id (`anthropic.…`, `us.anthropic.…`, `…-v1:0`), a Vertex id (`…@<date>`), a provider route (`provider/model`), a variant suffix (`…[1m]`), or a model that isn't Claude.

What passes is a Claude model id (`claude-sonnet-5-5`, `claude-opus-5-5`, dated ids included) or an alias (`sonnet`, `opus`, `haiku`, `opusplan`). The workflow never sets `ANTHROPIC_API_KEY`, so Claude Code can't fall back to per-token billing. To run an audit on a metered model, run it by hand.

## Estimate before enabling

```
runs/month   = sum over audits of runs per month at its cadence
                 (daily ≈ 30, weekly ≈ 4.3, fortnightly = 2, monthly = 1)
minutes/run  ≈ 1–6 of model time, plus a minute or two of setup
               (scheduled persona-review runs are static-only: no app is booted)
```

With the defaults in `audits.md` (three weekly, two fortnightly, two monthly), that's about 17 runs a month. Each run's Actions minutes count against the repo owner's plan on a private repo.

For scale, from the first full-scope dry runs on one mid-sized repo (October 2026): each Sonnet audit ran 14–36 turns over 1–3 minutes. A scheduled persona-review never boots the app (its live pass is interactive only), so it costs about what the other audits do.

Each run also loads the repo's agent docs before doing anything. A bloated agent doc multiplies across every run, so run `/prune-docs` first.

## The subscription caveat

A subscription's usage limits are shared with the interactive sessions on it, so audits that run while you're working compete with you. Schedule outside working hours (crons are UTC), keep the cheaper model for everything but the audits that need more, and reduce cadence if runs start failing on usage limits.

## Tuning

| Symptom | Change in `docs/agents/audits.md` |
|---|---|
| Too many issues | Raise `severity_min`, lower `new_issues_max` |
| Same finding keeps coming back after a fix | It's a regression. The issue is reopened with the `regression` label; fix the root cause or close it as not planned to suppress it |
| A run stops before publishing, or reports partial scope | Raise `max_turns` (passed to `claude --max-turns`) for that audit |
| A job is cancelled at its time limit | Raise `timeout_minutes` for that audit |
| An audit never finds anything | Drop its cadence to monthly, or remove it |
| Runs collide with your work | Move the crons; they're UTC |

Run `/schedule-audits` again after any change.
