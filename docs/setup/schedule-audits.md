# schedule-audits

## What it does

Installs a GitHub Actions workflow that runs the audit skills on their cadence (daily, weekly, fortnightly, monthly) with Claude Code, and files what they find as deduplicated GitHub issues, with nobody at the keyboard. It renders the workflow from `docs/agents/audits.md` and never invents settings. The workflow splits trust: the job where the model reads code and untrusted text has read-only tools and tokens, and a separate deterministic job is the only one allowed to write issues.

## When to reach for it

You invoke this by typing `/schedule-audits`, and the agent won't reach for it on its own. Reach for it once the audits are worth running unattended: after [setup-standards](setup-standards.md), ideally after [prune-docs](../audits/prune-docs.md) (every run loads `CLAUDE.md`) and [adopt-1password](adopt-1password.md) (the workflow loads its tokens from 1Password, from a vault of its own). Re-run it whenever you edit `docs/agents/audits.md`. To run one audit once, just type the audit's own command instead.

## Prerequisites

- `docs/agents/audits.md` and `docs/agents/triage-labels.md` from [setup-standards](setup-standards.md).
- A 1Password vault for the audits alone, never the deploy vault. It holds `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) plus read-only Sentry and Cloudflare tokens where used. It needs a service account that can read only that vault, with that account's token as `OP_SERVICE_ACCOUNT_TOKEN` in an `audits` GitHub environment limited to the default branch. That is the only GitHub secret. The skill builds a wizard for the parts only you can do.
- Writes: `.github/workflows/claude-audits.yml`, on a branch, as a PR.

## The three jobs

| Job | Does | Can write |
|---|---|---|
| **plan** | Picks the audits due now; skips diff-scoped audits with no new commits since their last run | Nothing |
| **analyse** | Runs `/jrey-skills:<audit> headless` per audit, with read-only tools; returns findings as structured output; refuses to continue if a loaded secret appears in them | Nothing outside the runner's temp dir |
| **publish** | Runs the `report-findings` publisher: dedupe, tracking issue, caps | Issues only |

An optional fix job for mechanical findings is included but commented out.

## Common questions

**What does it cost?**
About 50 runs a month with the default cadence, fewer with skips, all on the subscription that issued the OAuth token. It shares rate limits with your interactive use, so schedule outside working hours. The skill's COSTS reference has the estimate and tuning levers.

**Why does it start in dry-run?**
The first week of scheduled runs plans issue changes without writing any, so you can see the volume before it lands in your tracker. Flip `SCHEDULED_DRY_RUN` to `"false"` when you're happy.

**Does it need the Claude GitHub App?**
Not for analysis: it uses the workflow's own read-only token. Only the optional fix job needs the app, so its PRs trigger CI.

## It's working if

- Each audit's tracking issue appears on schedule, listing its findings, and closes the previous run's.
- Re-runs don't create duplicates; fixed-then-broken findings come back labelled `regression`.
- The Actions tab shows runs skipped on quiet weeks.
- Each analyse log's "Report permission denials" step lists nothing an audit needed, and no tracking summary says an MCP server failed to connect or that its subagents hadn't reported back.

## Where it fits

The last run-once setup step: it puts every audit in [the audits bucket](../audits/) on a schedule. Upstream: [setup-standards](setup-standards.md), [adopt-1password](adopt-1password.md) and [adopt-sentry](adopt-sentry.md). The findings land for [triage](../engineering/triage.md). See [which-skill](../productivity/which-skill.md) for the full map.
