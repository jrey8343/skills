# Agent doc rules

`CLAUDE.md` (or `AGENTS.md`) is loaded into every agent session and every CI audit run, in full, before any work starts. Every line costs tokens and attention on every run. Treat it as an index, not an encyclopaedia.

This file decides **what** goes in an agent doc and when a line is stale. How to word it (context pointers, the two loads, caches, pruning) is the `writing-for-agents` skill's job; call the Skill tool with `writing-for-agents` before editing one.

## Budget

- **About 200 lines** for the root file. Over 300 is a defect.
- Nested `CLAUDE.md` / `AGENTS.md` files in subdirectories (loaded only when an agent works there) may carry area-specific traps, each also kept short.

## What belongs

1. **One-paragraph orientation**: what the product is, and pointers to `PRODUCT.md`, the glossary and the avatars file.
2. **How to run things**: only the commands an agent cannot discover from the repo's scripts, or the non-obvious ones (environment setup, the one flag that is easy to miss).
3. **Repo map**: one line per top-level area saying what it is for, and where features live. Not a file tree.
4. **Traps**: invariants an agent will break without being told, each one line plus a pointer to where it is enforced or explained.
5. **Pointers**: `CODING_STANDARDS.md`, the feature-docs and runbook locations from `docs/agents/docs-targets.md`, the ADR location from `docs/agents/domain.md`, the `docs/agents/` config files, and the `## Agent skills` block written by Matt's `setup-matt-pocock-skills`.

## What does not belong

| Found in an agent doc | Move it to |
|---|---|
| History of what was built in which milestone | Nowhere; git and closed issues hold it. Keep any still-true "how it works" as a feature doc. |
| How a feature works | A feature doc |
| Why a hard-to-reverse choice was made | An ADR |
| Rules every change must follow | `CODING_STANDARDS.md` (and leave a one-line pointer) |
| Glossary-style definitions | The glossary |
| Deployment, provisioning or incident procedures | A runbook |
| Plans, roadmaps, "what comes next" | Issues (a roadmap or tracking issue, or a map from Matt's `wayfinder`) |
| Anything restating the repo's scripts or config files, and file trees, per-file listings or anything else `ls` or the config shows verbatim | Delete it; the environment is the source of truth |

## Staleness checks

A statement in an agent doc is **stale** when any of these is true:

- It names a path, script, env var, table or route that no longer exists (check with `ls`, `grep`, or the repo's script manifest).
- It states a count or version ("migrated through 0033", "no mobile app yet") that the repo contradicts.
- It describes a state as future ("will", "not yet", "planned") that git history shows has happened.
- It links a file that doesn't exist, including files outside the repo such as a home-directory plan. Agent docs never link outside the repo.
- Two docs state the same fact differently.

Fix stale facts by deleting them or replacing them with a pointer to the source of truth. Don't update a cached number to the new number; it will go stale again.
