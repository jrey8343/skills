# Agent doc rules

`CLAUDE.md` (or `AGENTS.md`) is loaded into every agent session and every CI audit run, in full, before any work starts. Every line costs tokens and attention on every run. Treat it as an index, not an encyclopaedia.

## Budget

- **About 200 lines** for the root file. Over 300 is a defect.
- Nested `CLAUDE.md` files in subdirectories (loaded only when an agent works there) may carry area-specific traps, each also kept short.

## What belongs

1. **One-paragraph orientation**: what the product is, and pointers to `PRODUCT.md`, `GLOSSARY.md` and `docs/product/avatars.md`.
2. **How to run things**: only the commands an agent cannot discover from `package.json` scripts, or the non-obvious ones (environment setup, the one flag everyone forgets).
3. **Repo map**: top-level directories, one line each, and where slices live.
4. **Traps**: invariants an agent will break without being told, each one line plus a pointer to where it is enforced or explained.
5. **Pointers**: `CODING_STANDARDS.md`, `docs/features/`, `docs/adr/`, `docs/runbooks/`, and the `## Agent skills` block written by `/setup-standards`.

## What does not belong

| Found in an agent doc | Move it to |
|---|---|
| History of what was built in which milestone or slice | Nowhere; git and closed issues hold it. Keep any still-true "how it works" as a feature doc. |
| How a feature works | `docs/features/<feature>.md` |
| Why a hard-to-reverse choice was made | `docs/adr/NNNN-*.md` |
| Rules every change must follow | `CODING_STANDARDS.md` (and leave a one-line pointer) |
| Glossary-style definitions | `GLOSSARY.md` |
| Deployment, provisioning or incident procedures | `docs/runbooks/` |
| Plans, roadmaps, "what comes next" | Issues (a tracking issue or wayfinder map) |
| Anything restating `package.json`, config files or the folder layout | Delete it; the environment is the source of truth |

## Staleness checks

A statement in an agent doc is **stale** when any of these is true:

- It names a path, script, env var, table or route that no longer exists (check with `ls`, `grep`, `jq '.scripts' package.json`).
- It states a count or version ("migrated through 0033", "no android/ yet") that the repo contradicts.
- It describes a state as future ("will", "not yet", "planned") that git history shows has happened.
- It links a file that doesn't exist, including files outside the repo such as `~/.claude/plans/*.md`. Agent docs never link outside the repo.
- Two docs state the same fact differently.

Fix stale facts by deleting them or replacing them with a pointer to the source of truth. Don't update a cached number to the new number; it will go stale again.
