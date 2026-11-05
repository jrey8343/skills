---
name: docs-audit
description: "Check agent docs, ADRs, feature docs and user docs against the code and the journeys: missing pages, drifted pages, dead paths and broken links, then file them for Triage."
disable-model-invocation: true
argument-hint: "[headless] [dry-run] [full] [area]"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*), Bash(git show:*), Bash(git rev-parse:*), Bash(git ls-files:*), Bash(git cat-file:*)
---

# Docs Audit

Make sure every capability is documented for each of its readers, and that what the docs say is still true. Two passes, run both unless the `area` argument names one:

- **coverage**: is there a doc for each journey and feature, for each reader?
- **drift**: has the code moved since the doc was last verified, and do the paths and links it names still exist?

Any other `area` (a path, a feature or a journey id) narrows both passes to the docs it names. An `area` makes an interactive run **targeted** (publish with `scope: targeted` and `target: <area>`, as report-findings says); a headless run is always a sweep and ignores it.

What is in scope depends on what the target repo has set up:

| Docs | Checked | Needs |
|---|---|---|
| Agent docs (`AGENTS.md`, `CLAUDE.md`, nested ones, `docs/agents/`) | Always | Nothing |
| ADRs | Always | `docs/agents/domain.md` for the location; without it, `docs/adr/` if it exists |
| Feature docs | Only where project-docs is set up | `docs/agents/docs-targets.md` |
| User docs | Only where project-docs is set up | `docs/agents/docs-targets.md` |
| Journey links | Only where journey files exist | `docs/agents/product.md` for the locations; without it, product-modeling's defaults |

A missing input skips the checks that need it; name each skipped check in the report `summary`. Skip the journey checks only when no journey files exist at the resolved location. Never seed `docs-targets.md` or `product.md` from here: that is `project-docs`' and `product-modeling`'s job, with the user.

Agent-doc bloat, misplaced content and restructuring belong to `prune-docs`. For agent docs this audit checks that what they name still exists and stays inside the repo; `prune-docs` leaves dead paths and outside links to this audit and never files them, so each is filed once, here. If the root agent doc is over 300 lines, say in the summary that `/prune-docs` is due, and move on.

## 1. Mode and configuration

Call the Skill tool with `report-findings` to resolve the mode (headless or interactive) and the scope. Read `docs/agents/audits.md`. If it is missing: interactively, tell the user to run `/schedule-audits` and stop; headless, emit one `audit-not-configured` finding as report-findings describes, and stop.

Then read the locations, each optional:

- `docs/agents/docs-targets.md`: where feature docs, runbooks and user docs live. When it exists, call the Skill tool with `project-docs` for the feature-doc and user-doc formats, the agent-doc staleness rules and the drift rule, and take every location from `docs-targets.md`, never from a default. Feature docs may sit per bounded context rather than in one folder.
- `docs/agents/domain.md`: the ADR location. If `docs-targets.md` names a different ADR location, `domain.md` wins; file the mismatch (below).
- `docs/agents/product.md`: where the product file, avatars and journeys live. Without it, use product-modeling's defaults: `PRODUCT.md`, `docs/product/avatars.md`, `docs/product/journeys/<id>.md`. When journey files exist at that location, call the Skill tool with `product-modeling` for the journey and avatar formats.
- Call the Skill tool with `domain-modeling` for its ADR tests, which `decision-without-adr` applies. If the call isn't made, skip that rule and name it in the summary.

## 2. Inventory

Build these lists from files, not memory:

- **agent docs**: the root `AGENTS.md` / `CLAUDE.md`, nested ones (`git ls-files -- '*AGENTS.md' '*CLAUDE.md'`), and every file under `docs/agents/`;
- **ADRs**: every file at the ADR location, with its number and any `Status` frontmatter;
- **journeys** (where journey files exist): id, `core`, `avatars`, `features`, `user-docs`, `code`, `verified-at`;
- **avatars** (where the avatars file exists): each avatar, and whether it is internal staff with no public docs;
- **feature docs** (project-docs only): every file matching the feature-docs path in `docs-targets.md`, with its `journeys`, `code`, `adrs`, `verified-at`;
- **user docs** (project-docs only): if `docs-targets.md` gives a local checkout of the docs site and it exists, list the pages under its content path with their `journey` and `audience` frontmatter. Otherwise rely on the journeys' `user-docs` links alone, and say so in the summary.

## 3. Coverage pass

Coverage reads frontmatter only, so it always runs over the whole inventory, whatever the scope.

| Rule | Gap | Severity | Needs |
|---|---|---|---|
| `journey-without-feature-doc` | A journey whose `features` is empty or points at missing files | medium | product model, project-docs |
| `journey-without-user-doc` | A user-visible journey with no user doc, or a `user-docs` link that resolves to nothing | medium (high for core journeys) | product model, project-docs |
| `feature-without-journey` | A feature doc that no journey references and that lists no journeys | low | product model, project-docs |
| `user-doc-orphan` | A user doc whose `journey` matches no journey file | low | product model, local docs checkout |
| `decision-without-adr` | A feature doc or agent doc stating a choice that passes `domain-modeling`'s ADR tests, with no ADR | low | the `domain-modeling` call in step 1; project-docs for feature docs |
| `no-user-docs-site` | `docs-targets.md` says there is no public docs site yet (filed once; dedupe keeps it single) | medium | project-docs |

A journey is user-visible unless every avatar it lists is internal staff with no public docs, judged from the avatars file. Without an avatars file, treat every journey as user-visible.

## 4. Drift pass

Follow [DRIFT.md](DRIFT.md) for the commands and for which commits count.

| Rule | Drift | Severity | Applies to |
|---|---|---|---|
| `doc-drift` | Behaviour-changing commits touch the `code` globs after `verified-at` | medium (high when a core journey's user doc is affected) | feature docs, journeys |
| `doc-never-verified` | `code` globs present but no `verified-at` | low | feature docs, journeys |
| `doc-dead-glob` | A `code` glob matches no files | low | feature docs, journeys |
| `doc-dead-path` | A doc names a path, script or route that no longer exists | low (medium in a root agent doc) | agent docs, feature docs, user docs (links only, inside the docs checkout) |
| `doc-link-outside-repo` | An agent doc links a file outside the repo | low | agent docs |
| `agent-config-unfilled` | A `docs/agents/` file still holds a template placeholder: a brace block opening like the seed templates' (`{e.g.`, `{Or `, `{If `, `{map `, `{how `), or a line identical to a placeholder line of the owning skill's template. Other braces (route params, JSON, globs, cron) are filled config | low | agent docs |
| `adr-dead-link` | A feature doc's `adrs`, an agent doc or another ADR links an ADR file that doesn't exist | low | ADRs |
| `adr-superseded-dangling` | An ADR says `superseded by ADR-NNNN` and that ADR doesn't exist | low | ADRs |
| `adr-number-clash` | Two ADRs share a number | low | ADRs |
| `adr-location-mismatch` | `docs-targets.md` and `domain.md` name different ADR locations | low | ADRs, project-docs |

Paths inside an ADR body are not checked: an ADR records the code as it was when the decision was made.

With incremental scope, run `doc-drift` and `doc-never-verified` only for docs whose `code` globs intersect the files changed since the last run. Run every other drift check in full; they are cheap. With more docs than one context can read, split them across sub-agents, never more at once than `subagents_max`.

## 5. Build findings

One finding per problem, matching `FINDINGS-SCHEMA.json` in the report-findings skill:

- `audit` is `docs-audit`; `rule` is the id from the tables above.
- `locator` is the doc path (`path#heading` for a claim inside a long doc), or `journey:<id>` for a coverage gap. Set `journey` wherever one applies.
- `evidence` quotes what was checked: the missing link, the dead path, or the counting commits (SHA and subject).
- `fix` is `mechanical` only for a `doc-dead-glob`, `doc-dead-path` or `adr-dead-link` whose new location is unambiguous from exactly one rename in `git log`, and for `adr-location-mismatch` (`domain.md` wins). Everything else is `judgement`: a drifted doc needs someone to read the commits and rewrite it, and `verified-at` never moves without that.
- User docs that live in another repo are still findings in this repo; their `recommendation` names the docs repo and its change flow from `docs-targets.md`.

## 6. Publish, then fix (interactive only)

Call the Skill tool with `report-findings` to publish.

Headless runs stop there: they never edit, commit or push.

Interactively, after publishing, offer to work the findings with the user watching:

- **Mechanical**: as report-findings' mechanical-fixes step describes.
- **Drifted or missing feature doc**: read the counting commits and the code, write the doc in the project-docs format at the configured location, and only then set `verified-at` to the current short SHA.
- **Missing or drifted user doc**: with the docs checkout in reach, write the page there in the user-doc format, following `docs-targets.md`'s change flow, and leave committing and any pull request to the user. Out of reach, offer to file an issue in the docs repo describing the change.
- **Missing ADR, or a dangling or clashing one**: call the Skill tool with `domain-modeling` and write the change in place.

Never commit, push, open a pull request, or apply a state label to a finding's issue.
