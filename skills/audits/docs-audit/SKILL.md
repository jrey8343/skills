---
name: docs-audit
description: "Check feature, user and agent docs against the code and the journeys: missing pages, drifted pages, and gaps between them, then file or fix them."
disable-model-invocation: true
argument-hint: "[coverage | drift] [headless] [dry-run] [full] [area]"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git ls-files:*)
---

# Docs Audit

Make sure every capability is documented for each of its readers, and that what the docs say is still true. Two passes, run both unless one is named:

- **coverage**: is there a doc for each journey and feature, for each reader?
- **drift**: has the code moved since the doc was last verified?

Agent-doc bloat (an oversized or stale `CLAUDE.md`) belongs to `/prune-docs`, not this skill. If the root agent doc is over 300 lines, mention `/prune-docs` in the summary and move on.

## 1. Mode and configuration

Call the Skill tool with "report-findings" to resolve the mode and scope. Read `docs/agents/audits.md`. If it is missing: interactively, tell the user to run `/setup-standards`; headless, emit one finding (`rule: audit-not-configured`, `locator: docs/agents/audits.md`) and stop.

Read `docs/agents/docs-targets.md` (where feature, user and in-product docs live) and `docs/agents/product.md` (journey and avatar paths). Call the Skill tool with "project-docs" for the doc formats and the drift rule.

## 2. Inventory

Build three lists from files, not memory:

- **journeys**: id, `core`, `features`, `user-docs`, `code`, `verified-at`;
- **feature docs**: `docs/features/*.md` with their `journeys`, `code`, `adrs`, `verified-at`;
- **user docs**: if `docs-targets.md` gives a local checkout of the docs site and it exists, list its pages and their `journey` and `audience` frontmatter. Otherwise rely on the journeys' `user-docs` links only, and say so in the summary.

## 3. Coverage pass

| Rule | Gap | Severity |
|---|---|---|
| `journey-without-feature-doc` | A journey whose `features` is empty or points at missing files | medium |
| `journey-without-user-doc` | A user-visible journey with no user doc (or a `user-docs` link that resolves to nothing) | medium (high for core journeys) |
| `feature-without-journey` | A feature doc no journey references, and that lists no journeys | low |
| `user-doc-orphan` | A user doc whose `journey` matches no journey file | low |
| `decision-without-adr` | A feature doc stating a hard-to-reverse choice with no ADR (domain-modeling's three tests) | low |
| `no-user-docs-site` | `docs-targets.md` says there is no public docs site (filed once) | medium |

A journey is user-visible unless every avatar it lists is internal staff with no public docs.

## 4. Drift pass

Follow [DRIFT.md](DRIFT.md). In short, for each feature doc and journey with `code` globs:

| Rule | Drift | Severity |
|---|---|---|
| `doc-drift` | Behaviour-changing commits touch the globs after `verified-at` | medium (high when a core journey's user doc is affected) |
| `doc-never-verified` | `code` globs present but no `verified-at` | low |
| `doc-dead-glob` | A `code` glob matches no files (fix: mechanical) | low |
| `doc-dead-path` | A doc names a path, script or route that no longer exists (fix: mechanical) | low |

With incremental scope, check only docs whose globs intersect files changed since the last run, plus the dead-glob and dead-path checks (cheap).

## 5. Fixes

- **Mechanical** (product repo only): correcting a dead glob or dead path when the new location is unambiguous from `git log --follow` or a rename. Flag these with `fix: mechanical`.
- **Judgement**: everything else. A drifted doc needs someone to read the commits and rewrite; never bump `verified-at` without doing that.
- **User docs live in another repo.** In headless runs, user-doc gaps and drift are always findings in this repo. Interactively, after publishing, offer to write the missing or drifted user doc in the docs repo on a branch, following `docs-targets.md` and the USER-DOC format from "project-docs", and to open the PR there.

## 6. Publish

Set `locator` to the doc path, or `journey:<id>` for coverage gaps; set `journey` where one applies. Call the Skill tool with "report-findings" to publish.
