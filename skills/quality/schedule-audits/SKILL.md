---
name: schedule-audits
description: "Set this repo up to run the audit skills on a schedule in its own GitHub Actions: seed docs/agents/audits.md, render .github/workflows/audits.yml from it, and walk the 1Password and GitHub token setup."
disable-model-invocation: true
---

# Schedule Audits

Render one scheduled GitHub Actions job per enabled audit from `docs/agents/audits.md`, so each audit runs `claude -p "/<audit> headless"` in the repo's own CI on its cadence and files its findings as issues through `report-findings`. The issues carry an `audit:<audit-name>` label and no state label; the repo's Triage takes them from there.

`docs/agents/audits.md` is the single source of truth. The renderer turns it into `.github/workflows/audits.yml` deterministically and never invents a setting: what the file leaves out, the renderer refuses, and you settle with the user.

`<skill-dir>` below is the absolute path of the folder holding this SKILL.md.

## The one rule

**You never see a secret value.** Work with secret *names* and `op://` references only.

- Never run `op read`, `op item get --reveal`, `op inject` to stdout, `gh secret` with a value in the arguments, or anything else that prints or carries a value.
- Scripts that create or move a secret are generated for the human and **run by the human**.

If a value appears in your context anyway (pasted, or printed by a tool), say so, stop, and tell the user to rotate it.

## 1. Seed the settings

If `docs/agents/audits.md` is missing, copy [audits.md](audits.md) there. It is also the file every audit reads for its defaults (`severity_min`, `new_issues_max`, `subagents_max`, `scope_ignore`).

Three settings have no default, and the renderer refuses them until they're filled in:

- `ci.claude_token`: replace `<repo>` with the repo's name, so the reference points at the vault [ONEPASSWORD.md](ONEPASSWORD.md) sets up. Confirm the vault name with the user.
- `skills.sha`: the full commit of this skills repo the workflow installs. Ask the user which commit their install pins and write that one. If they have no pin, offer the current head (`git ls-remote https://github.com/<skills.repository> HEAD`) and write it only on a yes.
- `skills.matt.sha`: the full commit of Matt Pocock's skills the workflow installs beside them. Scheduled audits call his skills by name (`domain-modeling`, `writing-for-agents`, `tdd`: docs-audit calls `domain-modeling`, prune-docs calls `domain-modeling` and `writing-for-agents`, test-audit calls `tdd`), and in CI nothing else puts them in `.claude/skills`. Offer the sha the user's install pins (the `sha` in Fabrik's `skills.lock.json` when they use Fabrik) and write it on a yes; with no pin, offer `git ls-remote https://github.com/<skills.matt.repository> HEAD` the same way.

Show the user the crons (UTC), models and `ci.github_auth`, and let them edit before going on.

## 2. Render the workflow

```bash
node <skill-dir>/scripts/render-workflow.mjs --repo "$(git rev-parse --show-toplevel)"
```

On **refusal** it writes nothing and prints one `refused:` line per problem. Show them to the user verbatim and fix `docs/agents/audits.md` with them; never swap a model or a cron on your own. The refusals that matter most:

- **A metered model.** Scheduled runs bill the Claude subscription only, never per token. What counts as metered, and why, is in [COSTS.md](COSTS.md). The fix is a Claude model id or alias in `audits.md`, or running that audit by hand.
- **An invalid cron.** Five numeric fields in UTC, with the minute a single number.

On **success** it prints a JSON summary. Report:

- `scheduled`: each audit, its cron and model.
- `left_out`: every audit left out because it reads text others wrote, named with its source and the file that shows the source in use (`detected`). Say why, from [THIRD-PARTY-TEXT.md](THIRD-PARTY-TEXT.md): those audits run interactively (`/<audit>`) until a design splits reading from writing.
- `offsets`: any cron moved later, in steps of 5 minutes (carrying into the next hour, never onto the top of it), because it clashed with another audit's. Offer to write the moved cron into `audits.md`, so the file says what runs. A move that would cross into an hour the cron doesn't name as one number, or into the next day, is refused instead: pick another minute with the user.
- `status`: `created` or `changed` means the workflow was written. `unchanged` means the workflow on disk already matches; nothing was rewritten. `removed` means nothing is left to schedule (every audit was deleted from `audits.md` or left out), so the workflow was deleted: name the left-out audits and tell the user nothing will run on a schedule until one is.

## 3. Secrets and tokens

Check each row of [PREREQUISITES.md](PREREQUISITES.md). For every row only a human can do, call the Skill tool with `wizard` to build one script for them, with the stages from [ONEPASSWORD.md](ONEPASSWORD.md) and [GITHUB-TOKEN.md](GITHUB-TOKEN.md). Hand it over; the human runs it and tells you when it's done. Re-check the rows (names only: `gh secret list`, `gh variable list`).

## 4. Hand over

Leave `docs/agents/audits.md` and `.github/workflows/audits.yml` uncommitted for the user and the repo's usual flow. Nothing here commits, pushes or opens a PR. Tell the user:

- schedules run from the default branch only, so nothing runs until the workflow is merged;
- once merged, run one audit now to smoke-test it: `gh workflow run audits.yml -f audit=<audit>`, then `gh run watch`. The log should end with the publisher's JSON summary of planned operations. A run that stops early means a token or install problem in the workflow: fix the setup, not the skills;
- runs start as dry runs (`ci.dry_run: true`), so they publish nothing. After a week of clean runs, set it to `false` and run `/schedule-audits` again;
- editing `docs/agents/audits.md`, or taking up a third-party source (Sentry, a Cloudflare MCP server, user feedback), means running `/schedule-audits` again; an unchanged file leaves the workflow byte-identical. Each job first re-checks that its audit reads no third-party source now in use, and fails with that message if it does;
- a scheduled run can't drop dry-run or headless: the run step's environment forces both on the publisher, and it may not run package runners (`npx`, `wrangler`) or read issue and PR text;
- the cost and tuning levers are in [COSTS.md](COSTS.md).
