# project-docs

## What it does

Defines the three kinds of docs a feature gets, and where every kind of content belongs:

- **Feature docs** (`docs/features/`) for engineers and agents: how it works, its rules, its limits.
- **User docs** (usually the marketing site's `/help`) for avatars: how to get their job done, in their words.
- **Agent docs** (`CLAUDE.md`) for every session: a small index of pointers and traps.

Docs declare the code they describe, and record the commit at which they were last checked against it. When that code changes and the doc doesn't, the doc has **drifted**, and `git log` proves it.

## When to reach for it

Type `/project-docs`, or the agent reaches for it when writing or updating docs for a feature or journey, when a change alters documented behaviour, or when restructuring `CLAUDE.md`. implement, docs-audit and prune-docs all pull it in.

## It's working if

- Docs change in the same PR as the behaviour they describe.
- `CLAUDE.md` stays small, because content has somewhere better to go.

## Where it fits

The vocabulary layer under [docs-audit](../audits/docs-audit.md), [prune-docs](../audits/prune-docs.md) and [implement](implement.md). See [which-skill](../productivity/which-skill.md).
