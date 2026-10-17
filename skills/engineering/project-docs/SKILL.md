---
name: project-docs
description: "Formats and drift rules for a project's three kinds of docs: internal feature docs (docs/features/), user-facing help pages on the marketing site, and agent-facing docs (CLAUDE.md, AGENTS.md). Use when writing or updating docs for a feature or journey, when a change alters documented behaviour, when slimming or restructuring CLAUDE.md, or when another skill needs the doc formats."
---

# Project Docs

Every user-visible capability is documented three times, for three readers, and each copy has one job:

| Doc | Reader | Job | Lives in |
|---|---|---|---|
| **Feature doc** | An engineer or agent changing the code | How it works and why it is this way | `docs/features/<feature>.md` in the product repo |
| **User doc** | An avatar using the product | How to get their job done | The user-docs target in `docs/agents/docs-targets.md` (usually the marketing site's `/help`) |
| **Agent doc** | Every agent session | Where to look and what not to break | `CLAUDE.md` / `AGENTS.md`, kept small and made of pointers |

Decisions that are hard to reverse go in ADRs (call the Skill tool with "domain-modeling" for the ADR format), and the feature doc links them. Domain terms come from `GLOSSARY.md`; user docs use the avatar's words from `docs/product/avatars.md` instead.

## Formats

- Feature docs: [FEATURE-DOC-FORMAT.md](FEATURE-DOC-FORMAT.md)
- User docs: [USER-DOC-FORMAT.md](USER-DOC-FORMAT.md)
- Agent docs: [AGENT-DOC-RULES.md](AGENT-DOC-RULES.md). When editing `CLAUDE.md` or `AGENTS.md`, also call the Skill tool with "writing-for-agents".

## Drift

A doc **drifts** when the code it describes changes and the doc does not. Feature docs and journeys declare `code:` globs and a `verified-at` SHA. A doc has drifted when:

```bash
git log --oneline <verified-at>..HEAD -- <each code glob>
```

returns commits that change behaviour (not just formatting or renames). Fix drift by reading those commits, updating the doc, and setting `verified-at` to the current short SHA. Bumping `verified-at` without re-reading the commits is the one thing never to do: it launders drift into false confidence.

## When behaviour changes

When a change alters what a feature does:

1. Update or create its feature doc, and bump `verified-at`.
2. If the change is user-visible, update the user doc. It may live in another repo; follow `docs/agents/docs-targets.md` for its path, format and PR flow. In headless runs, file the change as a finding instead of opening a cross-repo PR.
3. If the change came from a hard-to-reverse decision, offer an ADR.
4. Update the journey links (call the Skill tool with "product-modeling").
5. If an agent doc states a fact the change invalidated, fix the fact or replace it with a pointer.

## Where things go (the triage table)

| Content | Belongs in |
|---|---|
| How a feature works, its data flow, its edge cases | Feature doc |
| Why it was built this way, when the choice was a real trade-off | ADR, linked from the feature doc |
| What a term means | `GLOSSARY.md` |
| How a user does their job | User doc |
| A rule every change must respect | `CODING_STANDARDS.md` |
| Where to look, how to run things, the few traps that bite every session | Agent doc |
| A history of what was built when | Git history and closed issues; not a doc |
| Runbooks for humans (deploys, incidents, provisioning) | `docs/runbooks/` |
