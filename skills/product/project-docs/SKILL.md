---
name: project-docs
description: "Formats and drift rules for a project's three kinds of docs: feature docs, user docs and agent docs (CLAUDE.md, AGENTS.md), with verified-at SHAs for drift. Use when writing or updating docs for a feature or journey, when a change alters documented behaviour, when slimming or restructuring CLAUDE.md or AGENTS.md, or when another skill needs the doc formats or locations."
---

# Project Docs

Every user-visible capability is documented three times, for three readers, and each copy has one job:

| Doc | Reader | Job | Lives in |
|---|---|---|---|
| **Feature doc** | An engineer or agent changing the code | How it works and why it is this way | The feature-docs location in `docs/agents/docs-targets.md` (default `docs/features/<feature>.md`) |
| **User doc** | An avatar using the product | How to get their job done | The user-docs target in `docs/agents/docs-targets.md` (often a marketing site's `/help`, in another repo) |
| **Agent doc** | Every agent session | Where to look and what not to break | `CLAUDE.md` / `AGENTS.md`, kept small and made of pointers |

Decisions that are hard to reverse go in ADRs, and the feature doc links them. Domain terms come from the glossary; user docs use the avatar's words from the avatars file instead.

## Locations

Read `docs/agents/docs-targets.md` first. It says where feature docs, runbooks and user docs live in this repo, and it is the only place those paths are decided: a repo may keep feature docs per bounded context rather than in one `docs/features/` folder. Glossary and ADR layout come from `docs/agents/domain.md` (`domain-modeling` writes there). The ADRs line in `docs-targets.md` mirrors it; if the two differ, `domain.md` wins and you report the mismatch. `PRODUCT.md`, avatars and journeys come from `docs/agents/product.md`.

When `docs-targets.md` is missing and you are writing docs with the user, seed it from [docs-targets.md](docs-targets.md): fill in what the repo already shows (existing feature-doc, ADR and runbook folders), ask about the rest, and write it. A headless caller never seeds it: it treats feature and user docs as not set up, skips what depends on them and says so.

## Formats

- Feature docs: [FEATURE-DOC-FORMAT.md](FEATURE-DOC-FORMAT.md)
- User docs: [USER-DOC-FORMAT.md](USER-DOC-FORMAT.md)
- Agent docs: [AGENT-DOC-RULES.md](AGENT-DOC-RULES.md) says what belongs in them and when a line is stale. For how to write them, call the Skill tool with `writing-for-agents`.
- ADRs and glossary entries: call the Skill tool with `domain-modeling`, and write the change in place.

## Drift

A doc **drifts** when the code it describes changes and the doc does not. Feature docs and journeys declare `code:` globs and a `verified-at` SHA. A doc has drifted when:

```bash
git log --oneline <verified-at>..HEAD -- <each code glob>
```

returns commits that change behaviour (not just formatting or renames). Fix drift by reading those commits, updating the doc, and setting `verified-at` to the current short SHA. Bumping `verified-at` without re-reading the commits is the one thing never to do: it launders drift into false confidence.

## When behaviour changes

When a change alters what a feature does, in the same piece of work (a headless caller edits nothing: each step that would change a doc becomes a finding for the calling audit to publish through `report-findings`, and `verified-at` is never bumped):

1. Update or create its feature doc at the configured location, and bump `verified-at`.
2. If the change is user-visible, update the user doc. It may live in another repo; `docs-targets.md` gives its path, format and change flow. Interactive with the docs checkout in reach: edit the user doc there with the user watching. Interactive with the checkout out of reach: offer to file an issue in the docs repo describing the change, following its change flow. Headless: return a finding instead (no direct issue, no pull request).
3. If the change came from a hard-to-reverse decision, offer an ADR.
4. Update the journey links: call the Skill tool with `product-modeling`.
5. If an agent doc states a fact the change invalidated, fix the fact or replace it with a pointer.

## Where things go (the triage table)

| Content | Belongs in |
|---|---|
| How a feature works, its data flow, its edge cases | Feature doc |
| Why it was built this way, when the choice was a real trade-off | ADR, linked from the feature doc |
| What a term means | Glossary |
| How a user does their job | User doc |
| A rule every change must respect | `CODING_STANDARDS.md` |
| Where to look, how to run things, the few traps that bite every session | Agent doc |
| A history of what was built when | Git history and closed issues; not a doc |
| Runbooks for humans (deploys, incidents, provisioning) | The runbooks location in `docs-targets.md` |
