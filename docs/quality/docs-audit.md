# docs-audit

## What it does

Checks a repo's docs against its code and its journeys: which journeys and features have no doc for one of their readers, which docs have drifted since their `verified-at` commit, and which paths, links and ADR references point at nothing. It checks whatever the repo has set up and skips the rest, saying what it skipped: agent docs and ADRs always, feature and user docs only where [project-docs](../product/project-docs.md) is set up, journey links only where the product model exists.

## When to reach for it

You type `/docs-audit`, or CI runs `/docs-audit headless` on the schedule [schedule-audits](schedule-audits.md) sets; the agent never starts it by surprise. Pass `coverage` or `drift` to run one pass, or a path or journey id to narrow it. It finds docs that are missing or wrong. To slim an oversized `CLAUDE.md` or move content to its proper home, run [prune-docs](prune-docs.md); to write or update a doc as part of a change, the agent uses [project-docs](../product/project-docs.md).

## Prerequisites

- `docs/agents/audits.md`, seeded by [schedule-audits](schedule-audits.md). Without it, an interactive run tells you to run `/schedule-audits`, and a headless run files one `audit-not-configured` issue and stops.
- Optional: `docs/agents/docs-targets.md` from [project-docs](../product/project-docs.md) turns on the feature- and user-doc checks; journey files from [product-modeling](../product/product-modeling.md) turn on the journey checks (found through `docs/agents/product.md`, or at product-modeling's default locations without it); `docs/agents/domain.md`, from Matt's `setup-matt-pocock-skills`, says where ADRs live.
- For user docs in another repo, a local checkout of that repo (its path in `docs-targets.md`) lets it list the pages themselves; without one it trusts the journeys' links.

It writes nothing to the repo in headless runs. Findings are GitHub issues filed through [report-findings](report-findings.md).

## Coverage and drift

**Coverage** asks whether each journey has a feature doc and, if users see it, a user doc; whether each feature doc serves a journey; and whether a hard-to-reverse choice stated in a doc has an ADR. It reads frontmatter only, so it runs over everything every time.

**Drift** asks whether the code under a doc's `code` globs changed behaviour after the doc's `verified-at` commit. Formatting, renames, test-only changes and dependency bumps don't count; new routes, changed limits or changed UI copy do. It also catches globs that match nothing, paths and scripts that no longer exist, agent docs linking outside the repo, and ADR links that dangle. Incremental runs re-read only the docs whose code changed.

## Fixes

Headless runs only file issues, with an `audit:docs-audit` label and no state label, so the repo's Triage decides. A dead path, glob or ADR link with exactly one rename to explain it, and an ADR-location mismatch between `docs-targets.md` and `domain.md`, are labelled `fix: mechanical`. Interactive runs can then fix with you watching: correct the path, rewrite a drifted feature doc after reading the commits, write a missing user doc in the docs checkout, or record an ADR through Matt's `domain-modeling`. Committing and any pull request stay with you.

## Common questions

**Why won't it just bump `verified-at`?** Because a bumped SHA without a re-read turns drift into false confidence. It moves only after someone has read the commits and updated the doc.

**Does it check paths inside ADRs?** No. An ADR records the code as it was when the decision was made; it checks only that links to ADRs, and supersession pointers between them, resolve.

## It's working if

- Each journey's issues name the missing reader (feature doc or user doc), and core journeys rank higher.
- A drift issue lists the commits that changed behaviour since `verified-at`, newest first.
- In a repo without `docs-targets.md`, the run summary says the feature- and user-doc checks were skipped, and no issue claims those docs are missing.
- Running it twice files nothing new, and nothing it files carries a state label or arrives as a pull request.

## Where it fits

A periodic audit, usually weekly, run by [schedule-audits](schedule-audits.md) and published through [report-findings](report-findings.md). It reads the formats from [project-docs](../product/project-docs.md) and the journeys from [product-modeling](../product/product-modeling.md); [prune-docs](prune-docs.md) is its sibling for agent-doc bloat. Matt's `triage` takes the issues from there.
