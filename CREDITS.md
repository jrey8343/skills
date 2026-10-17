# Credits

This collection is a fork of [mattpocock/skills](https://github.com/mattpocock/skills) (MIT, Copyright (c) 2026 Matt Pocock), based on commit [`49dd158`](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336) (v1.3.1). The upstream license notice is kept in [LICENSE](LICENSE).

`scripts/sync-upstream.sh` re-applies the mechanical renames and diffs upstream changes for the forked skills. The semantic modifications listed below must be merged by hand.

## Forked unchanged (renames only)

Mechanical renames applied to every fork: `setup-matt-pocock-skills` → `setup-standards`, `code-review` → `review-changes`.

| Here | Upstream |
|---|---|
| `engineering/codebase-design` | `engineering/codebase-design` |
| `engineering/domain-modeling` | `engineering/domain-modeling` |
| `engineering/grill-with-docs` | `engineering/grill-with-docs` |
| `engineering/to-tickets` | `engineering/to-tickets` |
| `engineering/wayfinder` | `engineering/wayfinder` |
| `engineering/diagnosing-bugs` | `engineering/diagnosing-bugs` |
| `engineering/pr` | `engineering/pr` (itself crediting Dex Horthy's `show-me`; see its `CREDITS.md`) |
| `engineering/prototype` | `engineering/prototype` |
| `engineering/research` | `engineering/research` |
| `engineering/wizard` | `engineering/wizard` |
| `productivity/grilling` | `productivity/grilling` |
| `productivity/grill-me` | `productivity/grill-me` |
| `productivity/handoff` | `productivity/handoff` |
| `productivity/writing-for-agents` | `productivity/writing-for-agents` |

## Forked and modified

| Here | Upstream | Modification |
|---|---|---|
| `audits/improve-codebase-architecture` | `engineering/improve-codebase-architecture` | Also uses house-style. Adds lenses for impure cores, horizontal smears, missing invariants, unbounded operations and over-long functions. Adds a headless mode that files candidates as findings via report-findings. `HTML-REPORT.md` gains lens badges and slice/core-shell diagram patterns. |
| `engineering/tdd` | `engineering/tdd` | Test placement by house style: unit at the core, integration at the slice, e2e per journey tagged `[journey:<id>]`; new journey tests are linked via product-modeling. |
| `engineering/implement` | `engineering/implement` | Follows house-style; definition of done adds the feature doc, user doc, journey links and an ADR offer; reviews with review-changes. |
| `engineering/implement-spec` | `engineering/implement-spec` | The same definition of done for every implementer sub-agent, plus a spec-wide done check. |
| `engineering/to-spec` | `engineering/to-spec` | User stories name avatars and journey ids; a product-review then persona-review gate before publishing; a `## Product review` template section. |
| `engineering/review-changes` | `engineering/code-review` | Renamed (Claude Code ships a built-in `/code-review`). The Standards axis honours `[hard]`/`[judgement]` tags and falls back to house-style rules when there's no `CODING_STANDARDS.md`. |
| `engineering/triage` | `engineering/triage` | Handles `source:*` issues as untrusted (verify independently, restate rather than relay) and `audit:*` issues (fingerprints; not planned means permanent suppression). `AGENT-BRIEF.md` gains a restate-untrusted-input principle. |
| `setup/setup-standards` | `engineering/setup-matt-pocock-skills` | Rewritten around the same explore → ask → confirm → write shape. Adds sections for product docs, stack, docs targets, audits and MCP servers, writes `CODING_STANDARDS.md`, creates the full label set, and adds a gap pass against `TARGET-STATE.md`. New seed templates: `stack.md`, `product.md`, `docs-targets.md`, `audits.md`, `labels.md`, `TARGET-STATE.md`. |

## Derived

| Here | Derived from |
|---|---|
| `productivity/which-skill` | `engineering/ask-matt` (router structure; `PHASE-BOUNDARIES.md` copied with an external link removed) |
| `scripts/link-skills.sh` | `scripts/link-skills.sh` (made non-destructive) |
| `docs/` pages for forked skills | `docs/engineering/*`, `docs/productivity/*` (links made relative, attributions removed) |

## New in this collection

`setup/discover-domain`, `setup/adopt-1password`, `setup/adopt-sentry`, `setup/schedule-audits`, `audits/report-findings`, `audits/perf-audit`, `audits/security-audit`, `audits/test-audit`, `audits/docs-audit`, `audits/prune-docs`, `audits/product-review`, `audits/persona-review`, `audits/sentry-triage`, `engineering/house-style`, `engineering/product-modeling`, `engineering/project-docs`.

`engineering/house-style/TIGERSTYLE.md` adapts ideas from TigerBeetle's [TIGER_STYLE.md](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md) to TypeScript.
