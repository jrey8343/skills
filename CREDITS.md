# Credits

This collection is a fork of [mattpocock/skills](https://github.com/mattpocock/skills) (MIT, Copyright (c) 2026 Matt Pocock), based on commit [`49dd158`](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336) (v1.3.1). The upstream license notice is kept in [LICENSE](LICENSE).

`scripts/sync-upstream.sh` re-applies the mechanical renames and diffs upstream changes for the forked skills. The semantic modifications listed below must be merged by hand.

## Forked unchanged (renames only)

Mechanical renames applied to every fork: `setup-matt-pocock-skills` → `setup-standards`, `code-review` → `review-changes`.

| Here | Upstream |
|---|---|
| `engineering/codebase-design` | `engineering/codebase-design` |
| `engineering/diagnosing-bugs` | `engineering/diagnosing-bugs` |
| `engineering/pr` | `engineering/pr` (itself crediting Dex Horthy's `show-me`; see its `CREDITS.md`) |
| `engineering/prototype` | `engineering/prototype` |
| `engineering/wizard` | `engineering/wizard` |
| `productivity/grilling` | `productivity/grilling` |
| `productivity/grill-me` | `productivity/grill-me` |
| `productivity/writing-for-agents` | `productivity/writing-for-agents` |

## Forked and modified

| Here | Upstream | Modification |
|---|---|---|
| `audits/improve-codebase-architecture` | `engineering/improve-codebase-architecture` | Also uses house-style. Adds lenses for impure cores, horizontal smears, missing invariants, unbounded operations and over-long functions. Adds a headless mode that files candidates as findings via report-findings. `HTML-REPORT.md` gains lens badges and slice/core-shell diagram patterns. A term settled while grilling a candidate is recorded where domain-modeling sends it, not written inline. |
| `engineering/tdd` | `engineering/tdd` | Test placement by house style: unit at the core, integration at the slice, e2e per journey tagged `[journey:<id>]`; new journey tests are linked via product-modeling. |
| `engineering/implement` | `engineering/implement` | Follows house-style; definition of done adds the carrier's model changes, the feature doc, user doc, journey links and an ADR offer; reviews with review-changes. Works in its own worktree (via worktree) and ends by pushing and opening a PR, instead of committing to the current branch. |
| `engineering/implement-spec` | `engineering/implement-spec` | The same definition of done for every implementer sub-agent, plus a spec-wide done check. The spec's model changes are applied once on the integration branch before the implementers fan out. The integration branch gets its own worktree, and the closing cleanup is worktree's merge-aware sweep, run with `--into` the integration branch. |
| `engineering/to-spec` | `engineering/to-spec` | User stories name avatars and journey ids; a product-review then persona-review gate before publishing; `## Product review` and `## Model changes` template sections, the latter carrying the design session's glossary terms and ADRs verbatim. |
| `engineering/review-changes` | `engineering/code-review` | Renamed (Claude Code ships a built-in `/code-review`). The Standards axis honours `[hard]`/`[judgement]` tags and falls back to house-style rules when there's no `CODING_STANDARDS.md`. The Spec axis also reports model changes the diff never applied. |
| `engineering/triage` | `engineering/triage` | Handles `source:*` issues as untrusted (verify independently, restate rather than relay) and `audit:*` issues (fingerprints; not planned means permanent suppression). Trackers (issues that only hold sub-issues) carry a category and no state, and sweeps skip them. `AGENT-BRIEF.md` gains a restate-untrusted-input principle. A grill's settled terms and ADRs are carried by the ticket rather than written inline. |
| `setup/setup-standards` | `engineering/setup-matt-pocock-skills` | Rewritten around the same explore → ask → confirm → write shape. Adds sections for product docs, stack, docs targets, audits and MCP servers, writes `CODING_STANDARDS.md`, creates the full label set (including a `tracker` label, mapped in `triage-labels.md`), and adds a gap pass against `TARGET-STATE.md`. New seed templates: `stack.md`, `product.md`, `docs-targets.md`, `audits.md`, `labels.md`, `TARGET-STATE.md`. Writes every file in its own worktree and finishes as a docs-only PR. |
| `engineering/domain-modeling` | `engineering/domain-modeling` | A model change is written to the checkout that will carry it: inline in a linked worktree, otherwise stated in the conversation and handed to a carrier (spec, ticket, conversation) for the implementing worktree to apply, or written in its own worktree as a docs-only PR when the decision is the deliverable. |
| `engineering/grill-with-docs` | `engineering/grill-with-docs` | Closes the grill by listing every pending model change and naming its carrier. |
| `engineering/to-tickets` | `engineering/to-tickets` | A step that distributes the spec's model changes onto the tickets whose slices use them, and a `Model changes` section in both ticket templates. |
| `engineering/research` | `engineering/research` | Findings are written to the session scratchpad and the path reported, then offered as a docs-only PR, instead of being written straight into the repo. |
| `productivity/handoff` | `productivity/handoff` | Pending model changes are the one exception to the no-duplication rule: they are copied into the handoff verbatim, since no path reaches them. |
| `engineering/wayfinder` | `engineering/wayfinder` | A grilling ticket's settled terms and ADRs are recorded in the ticket's answer, which carries them to the implementing worktree. |

## Derived

| Here | Derived from |
|---|---|
| `productivity/which-skill` | `engineering/ask-matt` (router structure; `PHASE-BOUNDARIES.md` copied with an external link removed) |
| `scripts/link-skills.sh` | `scripts/link-skills.sh` (made non-destructive) |
| `docs/` pages for forked skills | `docs/engineering/*`, `docs/productivity/*` (links made relative, attributions removed) |

## New in this collection

`setup/discover-domain`, `setup/adopt-1password`, `setup/adopt-sentry`, `setup/schedule-audits`, `audits/report-findings`, `audits/perf-audit`, `audits/security-audit`, `audits/test-audit`, `audits/docs-audit`, `audits/prune-docs`, `audits/product-review`, `audits/persona-review`, `audits/sentry-triage`, `engineering/house-style`, `engineering/product-modeling`, `engineering/project-docs`, `engineering/worktree`, `engineering/synthesize-backlog`.

`engineering/house-style/TIGERSTYLE.md` adapts ideas from TigerBeetle's [TIGER_STYLE.md](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md) to TypeScript.
