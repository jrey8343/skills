---
name: setup-standards
description: "Configure this repo for the standards skills: issue tracker, labels, domain and product doc layout, stack, docs targets, audit settings and coding standards, then list what the repo still lacks. Run once before the other skills, and again to refresh the gap list."
disable-model-invocation: true
---

# Setup Standards

Scaffold the per-repo configuration the other skills assume, then measure the repo against the target state:

- **Issue tracker** and **labels**: where findings, specs and tickets go.
- **Domain and product docs**: where `GLOSSARY.md`, ADRs, `PRODUCT.md`, avatars and journeys live.
- **Stack**: what the repo runs on, so audits don't rediscover it every run.
- **Docs targets**: where feature docs and public user docs live.
- **Audits**: which audits run, how often, with what limits.
- **Coding standards**: the house style, rendered for this repo.

This is a prompt-driven skill, not a script. Explore, present what you found, confirm with the user, then write. It never touches application code.

## 1. Explore

Spawn a sub-agent to gather facts, so the main context stays clear for the conversation. Ask it to report, with paths:

- **Tracker**: `git remote -v`; whether `gh auth status` works; existing labels (`gh label list --limit 200`).
- **Agent docs**: `CLAUDE.md` / `AGENTS.md` at the root (line count, whether an `## Agent skills` block exists), nested ones, and `docs/agents/`.
- **Domain and product**: `GLOSSARY.md`, `GLOSSARY-MAP.md`, `docs/adr/`, `PRODUCT.md`, `docs/product/`, and anything persona-like or glossary-like under other names.
- **Stack**: `package.json` files and workspaces, `wrangler.*`, framework configs (`astro.config.*`, `vite.config.*`, `next.config.*`, `svelte.config.*`), `capacitor.config.*`, test configs (`vitest.config.*`, `playwright.config.*`), database tooling (`drizzle.config.*`, migrations), auth library, `.github/workflows/*`.
- **Errors and secrets**: `@sentry/*` dependencies and init code; `.env*`, `.dev.vars*` (names of files, never their contents), `op://` references, `wrangler secret` mentions in docs.
- **Policy documents** that could constrain later adoption: privacy policies, subprocessor registers, threat models, data-residency notes, and comments that state a policy (for example "no third-party error vendor").
- **Docs**: `docs/` contents, and any sibling repo that looks like the marketing or docs site (check the parent directory and README links).
- **Size and hot spots**: source size, and the most-changed paths in the last 200 commits.
- Whether `report-findings` is among your available skills. The audits depend on it, and step 5 uses it.

Tell it to report facts only, not recommendations.

## 2. Present findings and ask

Summarise what exists and what's missing in a short table. Then take the sections below in order: one section, one answer, then the next. Lead each with the recommended answer so the user can accept it in a word, and skip any section that exploration already settled.

**A. Issue tracker.** Default to GitHub when the remote is GitHub. Otherwise offer GitHub (`gh`), GitLab (`glab`), local markdown (files under `.scratch/`), or other (the user describes the workflow in a paragraph, recorded as prose). The audit skills publish findings only to GitHub; with any other tracker they show findings in the session instead. Say so if the user picks another tracker.

**B. Triage labels.** Ask once: "Keep the default triage labels?" (recommended: yes). Collect overrides only if the user says no.

**C. Domain docs.** Default to a single context (root `GLOSSARY.md` plus `docs/adr/`). Offer multi-context only when exploration found several genuinely separate bounded contexts.

**D. Product docs.** Default to `PRODUCT.md` at the root plus `docs/product/avatars.md` and `docs/product/journeys/`. Accept another location if the repo already has one.

**E. Docs targets.** Feature docs default to `docs/features/`. For public user docs, propose the marketing or docs site you found (repo, local path, content directory, format, URL base). If none exists, record "None yet".

**F. Audits.** Show the defaults from [audits.md](audits.md) (which audits, cadence, model, severity threshold, per-run caps). Recommend all of them. Ask for any non-production URLs persona review may drive (`live_targets`); default to none.

**G. MCP servers.** Offer to add `.mcp.json` entries the audits use, both authenticating by OAuth on first use so no token is stored in the repo:
- `cloudflare`: `{"type": "http", "url": "https://mcp.cloudflare.com/mcp"}`, when the stack is on Cloudflare.
- `sentry`: `{"type": "http", "url": "https://mcp.sentry.dev/mcp"}`, only when Sentry is already in use.

## 3. Confirm

Show the user drafts of:

- the `## Agent skills` block (step 4);
- each `docs/agents/*.md` file;
- `CODING_STANDARDS.md` (call the Skill tool with "house-style" and render its template, filling repo specifics from exploration);
- the `.mcp.json` changes;
- the labels to create.

Let them edit before anything is written. Keep `stack.md` factual: fill only what exploration confirmed, and leave a line out rather than guess.

## 4. Write

Before the first file write, call the Skill tool with "worktree": these files become the repo's law, and they land as a reviewable branch rather than as a dozen edits in the checkout the user works from. Write every file there. Label creation is a tracker-side change, not a file write, so it happens the same way either way.

**Pick the agent doc to edit.** If `CLAUDE.md` exists, edit it. Otherwise, if `AGENTS.md` exists, edit that. If neither exists, ask which to create. Never create one when the other already exists.

If an `## Agent skills` block exists, update it in place. Don't touch the surrounding sections: slimming the rest of the file is `/prune-docs`'s job.

```markdown
## Agent skills

- **Issue tracker**: {one line}. See `docs/agents/issue-tracker.md`.
- **Triage labels**: {one line}. See `docs/agents/triage-labels.md`.
- **Domain docs**: {single-context or multi-context}. See `docs/agents/domain.md`.
- **Product docs**: `PRODUCT.md`, avatars and journeys. See `docs/agents/product.md`.
- **Stack**: see `docs/agents/stack.md`. **Docs targets**: see `docs/agents/docs-targets.md`. **Audits**: see `docs/agents/audits.md`.
- **Coding standards**: `CODING_STANDARDS.md`.
```

**Write the docs files** from the seed templates beside this skill:

| Writes | From |
|---|---|
| `docs/agents/issue-tracker.md` | [issue-tracker-github.md](issue-tracker-github.md), [issue-tracker-gitlab.md](issue-tracker-gitlab.md) or [issue-tracker-local.md](issue-tracker-local.md) (or freeform for "other") |
| `docs/agents/triage-labels.md` | [triage-labels.md](triage-labels.md) |
| `docs/agents/domain.md` | [domain.md](domain.md) |
| `docs/agents/product.md` | [product.md](product.md) |
| `docs/agents/stack.md` | [stack.md](stack.md), filled from exploration |
| `docs/agents/docs-targets.md` | [docs-targets.md](docs-targets.md) |
| `docs/agents/audits.md` | [audits.md](audits.md) |
| `CODING_STANDARDS.md` | the house-style template |
| `.mcp.json` | merged in, preserving existing servers |

**Create labels** from [labels.md](labels.md) that the tracker lacks: the triage labels, `audit:<name>` for each enabled audit, and the rest of the table.

Finish the worktree as the worktree skill describes: commit the files, push the branch, and open a docs-only PR. The user reviews the standards as a diff before they bind anything.

## 5. Gap pass

Check the repo against [TARGET-STATE.md](TARGET-STATE.md), row by row, using the facts from step 1. Each unmet row becomes a finding, built as that file describes.

Call the Skill tool with "report-findings" to show them (interactive mode) and publish the ones the user picks, as `audit: setup-standards`. Re-running this skill later re-checks the same rows, and the fingerprints stop duplicates.

If `report-findings` isn't available, show the gap table and stop there.

## 6. Done

Tell the user what was written, the tracking issue for the gaps, and the next commands in order. Typically:

1. `/discover-domain`, if there is no product model yet.
2. `/prune-docs`, if the agent doc is over budget.
3. Then whatever the gap list ranks highest.

Mention that `docs/agents/*.md` can be edited by hand; re-running this skill is only needed to switch trackers or refresh the gap list.
