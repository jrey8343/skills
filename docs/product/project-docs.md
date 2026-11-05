# project-docs

## What it does

Defines the three kinds of docs a feature gets, and where every kind of content belongs. Docs declare the code they describe and the commit at which they were last checked against it, so when that code changes and the doc doesn't, `git log` proves the doc has **drifted**.

## When to reach for it

The agent reaches for it when writing or updating docs for a feature or journey, when a change alters documented behaviour, or when restructuring `CLAUDE.md` or `AGENTS.md`; you can also type `/project-docs`. It decides *what* goes where. For *how to word* an agent doc, it hands over to Matt's `writing-for-agents`; to check existing docs for drift across the repo, run [docs-audit](../quality/docs-audit.md) instead.

## Prerequisites

- `docs/agents/docs-targets.md` in the target repo says where feature docs, ADRs, runbooks and user docs live. When it's missing, the skill seeds it from its template the first time you write docs together, filling in what the repo already shows and asking about the rest. Until it exists, audits skip the feature- and user-doc checks and say so.
- The product model (`docs/agents/product.md`, from [product-modeling](product-modeling.md)) supplies the journey and avatar ids that docs link to. Optional: without it, docs simply carry no journey links.

## The three docs

- **Feature docs**, for engineers and agents: how it works, its rules, its limits. Default `docs/features/<feature>.md`, but the location is the repo's call, so one folder per bounded context works just as well.
- **User docs**, for avatars: how to get their job done, in their words. Often on a marketing site in another repo; when that repo is out of reach, the change is filed there as an issue instead of a pull request.
- **Agent docs** (`CLAUDE.md`, `AGENTS.md`), for every session: a small index of pointers and traps, about 200 lines (over 300 is a defect).

ADRs and glossary entries are Matt's `domain-modeling` format, written in place.

## It's working if

- Docs change in the same piece of work as the behaviour they describe, and their `verified-at` moves with them.
- `CLAUDE.md` stays small, because content has somewhere better to go.
- Feature docs land where `docs/agents/docs-targets.md` says, not in a default folder the repo doesn't use.

## Where it fits

The shared vocabulary layer under [docs-audit](../quality/docs-audit.md) and [prune-docs](../quality/prune-docs.md), beside [product-modeling](product-modeling.md), which owns the journeys these docs link to. Matt's `domain-modeling` owns ADRs and the glossary; his `writing-for-agents` owns how agent docs are worded.
