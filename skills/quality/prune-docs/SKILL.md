---
name: prune-docs
description: Clean up agent-facing docs. Slim CLAUDE.md / AGENTS.md to an index, move history and how-it-works into feature docs and ADRs, delete stale facts and dead references.
disable-model-invocation: true
argument-hint: "[headless] [dry-run] [full] [area]"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*), Bash(git show:*), Bash(git rev-parse:*), Bash(git ls-files:*), Bash(wc:*)
---

# Prune Docs

Agent docs accrete **sediment**: milestone logs, superseded plans, counts that were true once, pointers to files that moved. Every line of a root `CLAUDE.md` is paid for by every session and every CI run. This skill cores down through the sediment: keep what is live, move what belongs elsewhere to its proper home, delete the rest.

Call the Skill tool with `project-docs` for where each kind of content belongs, the agent-doc budget and the staleness checks (its AGENT-DOC-RULES). Call the Skill tool with `writing-for-agents` for how to write what stays; it decides the wording of every agent-doc line this skill keeps or rewrites.

**Interactive** (default): propose a plan, then edit the working tree with the user watching. **Headless**: only build findings and publish them through `report-findings`; never edit, commit or push.

## 1. Mode, settings and scope

Call the Skill tool with `report-findings` to resolve the mode (headless or interactive), read `docs/agents/audits.md` and resolve the scope. When `docs/agents/audits.md` is missing, an interactive run tells the user to run `/schedule-audits` and stops; a headless run emits one `audit-not-configured` finding, as report-findings describes, and stops.

The **target** is the agent docs: the root `CLAUDE.md` / `AGENTS.md`, nested agent docs (`git ls-files '*CLAUDE.md' '*AGENTS.md'`) and `docs/agents/`. Other Markdown (feature docs, ADRs, runbooks, user docs) is in scope only when `[area]` names it explicitly (a path to one doc or a folder of docs). A `CLAUDE.md` that only imports `AGENTS.md` (`@AGENTS.md`) is one doc: count the lines it loads.

An interactive run classifies every section of the root agent doc, or of `[area]` when given, whatever the incremental range: slimming it is the job. Incremental scope (the default) only limits which of the other target docs get re-read: those changed since the last audited SHA, plus those that name a path changed, renamed or deleted in that range (`git diff --name-status <last-sha>..HEAD`). A headless incremental run checks the root agent doc's budget always, plus those docs. `full` covers every target doc. An `area` makes an interactive run **targeted** (publish with `scope: targeted` and `target: <area>`, as report-findings says); a headless run is always a sweep and ignores it.

With `dry-run`, an interactive run stops after the section 5 proposal (no edits, no issues filed), and a headless run passes `--dry-run` to report-findings' publisher.

## 2. Inventory

Read the locations the destinations will need:

- `docs/agents/docs-targets.md`: feature-doc, runbook and user-doc locations.
- `docs/agents/domain.md`: glossary and ADR layout.
- `CODING_STANDARDS.md` at the repo root, if present.

Each is optional. When `docs-targets.md` is missing, an interactive run lets `project-docs` seed it before applying any **Move: feature doc** or **Move: runbook** row; a headless run names the destination kind (feature doc, runbook) instead of a path and says in the `summary` that destination paths were skipped.

For each doc in scope, record its line count (`wc -l`), the last commit touching it (`git log -1 --format=%cs -- <file>`) and its sections. Note docs that declare themselves superseded or historical, and links to files outside the repo (a home-directory plan, another checkout). Split the reading across sub-agents by doc when there are many, with no more in parallel than `subagents_max`.

## 3. Classify every section

Sort each section of the target into exactly one bucket, using the triage table in project-docs:

| Bucket | Action |
|---|---|
| **Keep** | Live orientation, commands that aren't discoverable, repo map (one line per top-level area saying what it is for), traps, pointers. Tighten the wording. |
| **Move: feature doc** | How a capability works now. Goes to the feature-docs location, named with a glossary term, in the project-docs feature-doc format with `code:` globs and `verified-at`. |
| **Move: ADR** | Why a hard-to-reverse choice was made. Goes to the ADR location in `domain.md`. |
| **Move: glossary** | What a term means. Goes to the glossary. |
| **Move: standards** | A rule every change follows. Goes to `CODING_STANDARDS.md`, leaving a one-line pointer. |
| **Move: runbook** | A human procedure. Goes to the runbooks location. |
| **Move: issue** | A plan, todo or "what comes next". Filed to the issue tracker. |
| **Delete** | History, stale facts, restated config, file trees, per-file listings or anything `ls` or the config shows verbatim, duplicates of another doc. |

Check every factual claim against the repo before keeping or moving it: paths, scripts, env vars, counts, versions, "not yet" statements, links. A stale claim is deleted or replaced with a pointer to its source of truth, as AGENT-DOC-RULES says; it is never moved as-is, and a cached count or version is never refreshed to the new value.

A milestone or slice log usually splits several ways: the still-true "how it works" becomes feature docs, the load-bearing "why" becomes ADRs, the rules go to standards, and the narrative is deleted (git history keeps it).

Drift of feature docs against their `verified-at` SHA is `docs-audit`'s job, not this one's. Report it only when a feature doc states a fact the repo contradicts outright.

Dead paths, dead links and links outside the repo are `docs-audit`'s findings too (`doc-dead-path`, `doc-link-outside-repo`); a headless run doesn't file them. An interactive run still fixes them while rewriting (step 6.4).

## 4. Headless: build findings

Build one finding per problem, matching report-findings' schema, with `audit: prune-docs`:

| Rule | Locator | Severity | Fix |
|---|---|---|---|
| `agent-doc-over-budget` | the file | medium over 300 lines, high over 1,000 | judgement |
| `stale-fact` | `file#heading` | medium; evidence quotes the claim and the contradicting fact; never a path or link that doesn't exist (that is `docs-audit`'s `doc-dead-path` / `doc-link-outside-repo`) | judgement, or mechanical when the fix is deleting one line |
| `misplaced-content` | `file#heading` | low; the recommendation names the bucket and destination | judgement |
| `duplicate-doc` | the doc that should give way | low; evidence names both places | judgement |

Then call the Skill tool with `report-findings` to publish. Stop there.

## 5. Interactive: propose

Show the user the plan as a table: section, bucket, destination, and one line on why. Lead with the totals: lines before, lines after, files created. Flag every **Delete** whose content is not preserved somewhere else, so the user can veto it.

Wait for the go-ahead. The user may move rows between buckets, or hold rows back.

## 6. Interactive: apply

Edit the working tree with the user watching; leave committing, pushing and any PR to the user and the repo's usual flow.

1. Create the destinations first, in the formats project-docs gives: feature docs, runbooks and standards additions directly; ADRs and glossary entries in place by calling the Skill tool with `domain-modeling`.
2. Rewrite the target as an index within budget: orientation, commands that aren't discoverable, repo map, traps, pointers. Word it as `writing-for-agents` says.
3. For each **Move: issue** row, show the user the issue's title and body, then file the approved ones on the tracker in `docs/agents/issue-tracker.md` with no state label, so Triage picks them up. If `docs/agents/issue-tracker.md` is missing, tell the user to run `/setup-matt-pocock-skills` and show the approved issue bodies instead of filing them.
4. Verify:
   - every path in the rewritten doc exists;
   - every moved section has a home;
   - the root doc is within budget (`wc -l`);
   - no link points outside the repo.
5. Give the user the classification table to carry in the commit body.

Rows the user held back become findings: build them as in section 4 and call the Skill tool with `report-findings` to publish the ones the user picks. Links outside the repo whose targets you can't bring in are not filed here; tell the user `/docs-audit` files them as `doc-link-outside-repo`.
