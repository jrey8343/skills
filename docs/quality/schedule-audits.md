# schedule-audits

## What it does

Sets a repo up to run its audits on a schedule in its own GitHub Actions: it seeds `docs/agents/audits.md` and renders `.github/workflows/audits.yml` from it, one job per audit running `claude -p "/<audit> headless"`. A deterministic script does the rendering, so the workflow only ever says what `audits.md` says. It refuses outright when a setting is missing or a model would bill per token, and it leaves out, by name, any audit that reads text strangers can write.

## When to reach for it

You type `/schedule-audits`; the agent never reaches for it on its own. Run it once to set a repo up, and again whenever you change `docs/agents/audits.md`. It schedules audits and sets up their tokens; it never runs one. Running an audit now is that audit's own command (`/security-audit`, …), and what its findings become is [report-findings](report-findings.md) and Matt's `triage`. Fabrik doesn't run audits: the issues they file reach a Fabrik Product repo through Intake and Triage like any other.

## Prerequisites

- A GitHub repo, an authenticated `gh`, and Node 22 or later.
- A 1Password account and a Claude subscription. The skill writes a script that walks you through the steps only you can do: storing a `claude setup-token` token in a vault of its own, a read-only service account, and the GitHub secrets.
- `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` from Matt's `setup-matt-pocock-skills`, which the audits' publisher reads.
- It writes `docs/agents/audits.md` (when missing) and `.github/workflows/audits.yml`, and leaves both uncommitted.

## What a scheduled run can and can't do

Each job checks out the repo without credentials, installs this collection's skills and Matt Pocock's (which the audits call by name) at the commits `audits.md` pins, loads the Claude token from 1Password, and runs one audit headless. Its GitHub token is the repo's own fine-grained PAT or GitHub App, holding Issues access on this repo and nothing more. So it can file issues and labels, and can't push, open a pull request or touch Actions. The 1Password service account token never reaches the model's step, and no API key is ever set.

## What it refuses, and what it leaves out

- **Metered models.** Scheduled runs bill the Claude subscription only. A model billed per token (an API key, Bedrock, Vertex, another provider) or one the renderer doesn't recognise is refused with the audit's name and the reason, and nothing is written.
- **Invalid crons.** Five numeric fields, UTC, with the minute a single number. Two audits that would fire in the same minute aren't refused: the second in name order moves on 5 minutes at a time, and the summary says so. A move that would cross into the next day, or into an hour the cron doesn't give as one number, is refused instead.
- **Third-party text.** An audit that reads Sentry events, user feedback or the Cloudflare MCP while that source is in use (as the repo shows, or `audits.md` declares) stays off the schedule, named with its source. It runs interactively until reading and writing are split. With Sentry in the repo, that's `perf-audit` and `product-review`; with a Cloudflare MCP server, `security-audit` and `perf-audit`.

## Common questions

**Why not the workflow's `GITHUB_TOKEN`?** Issues it opens don't trigger other workflows, so the repo's Intake and Triage automation would never see a finding.

**Why not the Fabrik App?** It can push and open pull requests. A job that runs a model gets the narrowest token there is, and audits aren't Fabrik's to run.

**Do the first runs file issues?** No. They start as dry runs, which plan and publish nothing. Switch them live in `audits.md` after a week of clean runs.

## It's working if

- Running `/schedule-audits` twice with an unchanged `audits.md` leaves `.github/workflows/audits.yml` byte-identical.
- Every audit in `audits.md` is either a job in the workflow or named in its header as left out, with the source that kept it off.
- A run started with `gh workflow run audits.yml -f audit=<audit>` ends with the publisher's JSON summary in its log.
- Issues from scheduled runs carry `audit:<audit>` and no state label, and no scheduled run ever pushes or opens a pull request.
- The audits workflow references only `OP_SERVICE_ACCOUNT_TOKEN` and the GitHub token's secret, and no Anthropic API key appears anywhere in it.

## Where it fits

Run-once setup for the periodic audits: [security-audit](security-audit.md), [test-audit](test-audit.md), [perf-audit](perf-audit.md), [docs-audit](docs-audit.md), [prune-docs](prune-docs.md), [product-review](../product/product-review.md) and [persona-review](../product/persona-review.md). It owns the `docs/agents/audits.md` they all read; [report-findings](report-findings.md) publishes what they find, and Matt's `triage` decides what happens next.
