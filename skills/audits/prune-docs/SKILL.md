---
name: prune-docs
description: Clean up agent-facing and internal docs. Slim CLAUDE.md to an index, move history and how-it-works into feature docs and ADRs, delete stale facts and dead references.
disable-model-invocation: true
argument-hint: "[headless] [dry-run] [path, default the root agent doc]"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git ls-files:*), Bash(wc:*)
---

# Prune Docs

Agent docs accrete **sediment**: milestone logs, superseded plans, counts that were true once, pointers to files that moved. Every line of a root `CLAUDE.md` is paid for by every session and every CI run. This skill cores down through the sediment: keep what is live, move what belongs elsewhere to its proper home, delete the rest.

Call the Skill tool with "project-docs" for where each kind of content belongs and the agent-doc budget, and with "writing-for-agents" for how to write what stays. Call the Skill tool with "report-findings" to resolve the mode.

**Interactive** (default): restructure and land a PR. **Headless**: report findings only; never edit.

## 1. Inventory

Target the path given, or by default the root `CLAUDE.md` / `AGENTS.md`, then nested agent docs, then `docs/**/*.md`. Record for each: line count, last commit touching it (`git log -1 --format=%cs -- <file>`), and its sections.

Also look for:

- copies of the agent doc in other worktrees or checkouts (`git worktree list`), and plan or notes files the doc links to that live outside the repo;
- docs that declare themselves superseded or historical.

## 2. Classify every section

Sort each section of the target into exactly one bucket, using project-docs' triage table:

| Bucket | Action |
|---|---|
| **Keep** | Live orientation, commands, repo map, traps. Tighten the wording. |
| **Move: feature doc** | How a capability works now. Goes to `docs/features/<feature>.md` (named with a `GLOSSARY.md` term) with `code:` globs and `verified-at`. |
| **Move: ADR** | Why a hard-to-reverse choice was made. Goes to `docs/adr/`. |
| **Move: standards** | A rule every change follows. Goes to `CODING_STANDARDS.md`. |
| **Move: runbook** | A human procedure. Goes to `docs/runbooks/`. |
| **Move: issue** | A plan, todo or "what comes next". Filed to the tracker. |
| **Delete** | History, stale facts, restated config, duplicates of another doc. |

Check every factual claim against the repo before keeping or moving it (AGENT-DOC-RULES staleness checks): paths, scripts, counts, "not yet" statements, links. A stale claim is corrected at its destination, or deleted; it is never moved as-is.

A milestone or slice log usually splits several ways: the still-true "how it works" becomes feature docs, the load-bearing "why" becomes ADRs, the rules go to standards, and the narrative is deleted (git history keeps it).

## 3. Propose

Show the user the plan as a table: section, bucket, destination, and one line on why. Lead with the totals: lines before, lines after, files created. Flag every **Delete** whose content is not preserved somewhere else, so the user can veto it.

Wait for the go-ahead. The user may move rows between buckets.

## 4. Apply (interactive only)

On a branch `docs/prune-<target>`:

1. Create the destination files first (feature docs, ADRs, standards additions, runbooks) in the project-docs formats.
2. Rewrite the target as an index within budget: orientation, commands that aren't discoverable, repo map, traps, pointers.
3. File the **Move: issue** rows to the tracker.
4. Verify:
   - every path in the rewritten doc exists;
   - every moved section has a home;
   - the root doc is within budget (`wc -l`);
   - no link points outside the repo.
5. Commit and open a PR whose body carries the classification table. Never merge it.

Report docs outside the repo, and stale copies in worktrees, as findings; don't delete them.

## 5. Headless

Build findings instead of editing. Rules:

- `agent-doc-over-budget`: `locator` is the file. Severity: medium over 300 lines, high over 1,000 lines.
- `stale-fact`: `locator` is `file#heading`. The evidence quotes the claim and the contradicting fact.
- `dead-reference`: links or paths that don't exist. `fix: mechanical`.
- `misplaced-content`: a section that belongs in another bucket, with its destination.
- `duplicate-doc`: the same content in two places.

Then call the Skill tool with "report-findings" to publish.
