# docs-audit

## What it does

Checks that every capability is documented for each of its readers, and that what the docs say is still true. It runs two passes:

- **Coverage**: does each journey and feature have an internal feature doc and, if users see it, a user doc on the marketing site?
- **Drift**: has the code under a doc's `code:` globs changed behaviour since the doc's `verified-at` commit?

Drift is read from git, not guessed. It lists the commits since verification and keeps only the ones that change behaviour; formatting and renames don't count.

## When to reach for it

You invoke this by typing `/docs-audit` (optionally `coverage` or `drift`), and the agent won't reach for it on its own. It also runs weekly when scheduled.

- **Reach for it** after shipping features, before telling users about a release, or when someone says "the docs are wrong".
- **For** an oversized or stale `CLAUDE.md`, use [prune-docs](prune-docs.md) instead.

## Prerequisites

- [setup-standards](../setup/setup-standards.md), for `docs/agents/docs-targets.md`, which says where user docs live (often another repo).
- Journeys from [discover-domain](../setup/discover-domain.md).

## Three readers, three docs

| Doc | Reader | Where |
|---|---|---|
| Feature doc | An engineer or agent changing the code | `docs/features/` in the product repo |
| User doc | An avatar using the product | The marketing site's help section |
| ADR | Anyone wondering why | `docs/adr/` |

Gaps in user docs are always filed as issues in the product repo. Interactively, it offers to write the missing page in the docs repo on a branch and open the PR there.

## Common questions

**Why won't it just bump `verified-at` when the doc looks fine?**
Bumping `verified-at` without re-reading the commits turns drift into false confidence. Only someone who has read what changed can move it.

## It's working if

- `doc-drift` issues name the exact commits that made the doc stale.
- New features arrive with a feature doc and a help page.
- Help pages stop describing buttons that no longer exist.

## Where it fits

A weekly scheduled audit. Neighbours: [project-docs](../engineering/project-docs.md) holds the doc formats it checks against; [prune-docs](prune-docs.md) handles agent-facing docs. See [which-skill](../productivity/which-skill.md) for the full map.
