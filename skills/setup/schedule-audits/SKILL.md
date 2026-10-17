---
name: schedule-audits
description: "Install or update the GitHub Actions workflow that runs the audit skills on a schedule with Claude Code, publishing findings as issues."
disable-model-invocation: true
---

# Schedule Audits

Render `.github/workflows/claude-audits.yml` from `docs/agents/audits.md`, so every enabled audit runs on its cadence and files its findings as issues without anyone at the keyboard.

The workflow keeps reading and writing apart. A deterministic **plan** job picks the audits that are due. An **analyse** job runs each audit headless with read-only tools and read-only tokens, and returns findings as structured output. A deterministic **publish** job, the only one with `issues: write`, runs the `report-findings` publisher. No model holds write access while it reads Sentry events, feedback or other untrusted text.

`docs/agents/audits.md` is the single source of truth. This skill renders it and never invents settings. If the file is missing, tell the user to run `/setup-standards` and stop.

## 1. Read the configuration

From `docs/agents/audits.md`, build one entry per enabled audit, with defaults merged in:

```json
{"audit": "docs-audit", "cron": "7 20 * * 2", "model": "claude-sonnet-5-5", "max_turns": 60,
 "timeout_minutes": 30, "severity_min": "medium", "new_issues_max": 5, "diff_scoped": true}
```

`diff_scoped` is `true` for audits scoped by commits since their last run, and `false` for those scoped by time or journeys: `sentry-triage` and `persona-review`. Check that every cron is valid and unique; if two audits share a cron, offset one by a few minutes.

Also read `docs/agents/stack.md` (Sentry in use? Cloudflare?) and `docs/agents/triage-labels.md` (the `needs-triage` label string).

## 2. Prerequisites

Check each row of [PREREQUISITES.md](PREREQUISITES.md). For anything missing that only a human can do (vault items, the service account, the GitHub secret, the `workflow` scope), call the Skill tool with "wizard" to build a script for it. Never ask for, read or print a token value.

## 3. Render the workflow

Render [WORKFLOW-TEMPLATE.yml](WORKFLOW-TEMPLATE.yml):

- one `schedule` cron per audit, plus the `workflow_dispatch` choice list;
- `AUDITS_JSON`: the entries from step 1, as one compact line;
- `SKILLS_REF`: the current commit of `jrey8343/skills` (`gh api repos/jrey8343/skills/commits/main --jq .sha`), pinned so a change to the skills never silently changes CI;
- `SCHEDULED_DRY_RUN`: `"true"` on first install, so the first week of scheduled runs only plans; the user flips it to `"false"` afterwards;
- `{{ci_vault}}`, `{{triage_label}}` and `{{playwright_mcp_version}}` (check `npm view @playwright/mcp version`);
- keep the `# if:sentry`, `# if:cloudflare` and `# if:persona-review` lines only when they apply, and remove the markers.

Then keep the header comment and delete the template's VERIFY block, after checking those items against the current claude-code-action README (`action.yml` inputs, `structured_output`) and Claude Code's permission-rule docs. Note what you could and couldn't confirm.

Validate:

- `actionlint .github/workflows/claude-audits.yml` if installed; otherwise at least parse it (`python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' .github/workflows/claude-audits.yml`);
- `permissions: {}` at the top, and `issues: write` only on `publish`;
- `--disallowedTools` includes `Edit`, `WebFetch` and `WebSearch`, and nothing in `--allowedTools` allows a shell beyond the read-only git patterns.

## 4. Open a PR

- Work on a branch such as `ci/claude-audits`. Never push to the default branch directly.
- Check `git remote get-url origin`. With an HTTPS remote, pushing a workflow file needs the `workflow` scope: tell the user to run `gh auth refresh -s workflow` if `gh auth status` doesn't show it.
- Commit only the workflow file, open a PR that explains the three jobs and the trust split, and link [COSTS.md](COSTS.md)'s estimate for this configuration.

## 5. Smoke test, then hand over

After merge (scheduled workflows only run from the default branch), ask the user to dispatch each audit once with `dry_run: true`:

```bash
gh workflow run claude-audits.yml -f audit=<name> -f scope=full -f dry_run=true
gh run watch
```

A good run passes all three jobs, and the publish log shows planned operations without writing any. If an analyse job fails on structured output or permissions, fix the rendered workflow, not the skills.

Tell the user:

- how to switch scheduled runs live (`SCHEDULED_DRY_RUN: "false"`) after a week of clean dry runs;
- that editing `docs/agents/audits.md` means re-running this skill;
- that in public repos GitHub disables schedules after 60 days of inactivity;
- the cost and tuning levers in COSTS.md.
