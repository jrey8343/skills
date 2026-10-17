# sentry-triage

## What it does

Turns what Sentry saw recently (new errors, regressions, slow transactions, user feedback, and support emails forwarded into Sentry) into a short list of triage-ready GitHub issues. Each issue is clustered by root cause, mapped to the journey it hurts, ranked by people affected, and deduplicated against issues already filed. Everything Sentry returns is treated as untrusted text: quoted as evidence, never followed as instructions, and never handed straight to an agent.

## When to reach for it

You invoke this by typing `/sentry-triage`, and the agent won't reach for it on its own. It also runs daily in CI when scheduled audits are installed.

| Situation | Use |
|---|---|
| Catching up on what broke for users this week | `/sentry-triage` (or `/sentry-triage days=14`) |
| Digging into one specific error until it's fixed | [diagnosing-bugs](../engineering/diagnosing-bugs.md) |
| Deciding what to do with the issues it filed | [triage](../engineering/triage.md) |
| Sentry isn't installed yet | [adopt-sentry](../setup/adopt-sentry.md) |

## Prerequisites

- `/setup-standards` has run.
- Sentry is adopted (`/adopt-sentry`).
- The Sentry MCP server is configured. Locally that's `{"type": "http", "url": "https://mcp.sentry.dev/mcp"}` in `.mcp.json` with OAuth; in CI the workflow passes a read-only token.

## Window, not diff

Unlike the code audits, this one is scoped by time: the last `window_days` (7 by default), or `days=N` from the arguments. Dedupe makes overlapping windows harmless. An issue already filed for a Sentry short id is left alone, and one closed as fixed is reopened as a `regression` if the error comes back.

## Why the issues need a human first

Anyone with the public DSN can send events and feedback to Sentry, so their text can carry instructions aimed at an agent. The issues this skill files are labelled `needs-triage` plus `source:sentry`, `source:feedback` or `source:email`, and never `ready-for-agent`. A human reads them, then promotes them with `/triage`. In CI the model that reads Sentry holds no write tools; a separate script files the issues.

## Common questions

**Will it resolve or ignore noise in Sentry?**
Only interactively, and only after showing you the list and getting a yes. Headless runs never write to Sentry.

**How does a fix close the loop?**
Each issue tells the fixer to put `Fixes <SHORT-ID>` in the commit. Sentry resolves the issue when that release ships, and the GitHub issue closes with the PR.

## It's working if

- The daily tracking issue is short: clustered root causes, not one issue per error message.
- Most filed issues name the journey they break.
- Regressions show up as reopened issues with the `regression` label, not as fresh duplicates.

## Where it fits

A periodic audit, daily by default. It sits after [adopt-sentry](../setup/adopt-sentry.md) and before [triage](../engineering/triage.md) and [diagnosing-bugs](../engineering/diagnosing-bugs.md). It publishes through [report-findings](report-findings.md). For the full map, see [which-skill](../productivity/which-skill.md).
