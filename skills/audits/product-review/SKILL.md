---
name: product-review
description: "Product designer and manager lens: judge whether a feature improves or detracts from the product, against PRODUCT.md, the avatars and their journeys. Use when the user asks whether a feature is worth building or keeping, wants a product or PM perspective on a spec, issue, PR, branch or shipped feature, or when to-spec needs a product gate."
argument-hint: "[spec | issue | PR | branch | journey] [headless] [dry-run]"
---

# Product Review

Decide whether a feature earns its place. Every feature has a **complexity cost**: new concepts, settings, screens, states and copy that every avatar pays for in attention, whether they use the feature or not. A feature is worth it only when the job it serves outweighs that cost. Name the job, count the cost, give a verdict.

Product review judges the *bet*, not the code. For code quality use `review-changes`. For how it feels to a specific user, call the Skill tool with "persona-review".

## 1. Resolve the mode and target

Call the Skill tool with "report-findings" to resolve the mode (headless or interactive). Then pin the target:

| Target | Stage | Read |
|---|---|---|
| A spec or issue | Pre-build | The text: problem, user stories, scope |
| A PR or branch | Pre-ship | The diff, plus the linked issue or spec |
| A shipped feature or journey | Post-ship | The feature doc, the journey file, the code behind its `code` globs, and Sentry or feedback signals if available |
| Called from `to-spec` | Pre-build gate | The draft spec in the conversation |

If no target was given in an interactive run, ask for one. In a headless run the target is "features merged since the last run" (step 5).

## 2. Load the product model

Read `docs/agents/product.md` for the paths, then `PRODUCT.md` (principles, non-goals, metrics, constraints), the avatars and the journeys the target touches. Read `GLOSSARY.md` for domain terms.

If `PRODUCT.md` is missing, say so: without principles and non-goals the review falls back to generic judgement, so mark every conclusion `confidence: low`. Interactively, suggest `/discover-domain` first.

## 3. Judge

Work through [RUBRIC.md](RUBRIC.md). Every question gets an answer grounded in evidence (a quoted principle, a named avatar job, a counted screen or setting). Cover:

- **Job**: which avatar job it serves. None is a red flag.
- **Cost**: the new concepts, settings, screens, states and copy it adds.
- **Fit**: consistency with existing patterns; discoverability for the avatar who needs it.
- **Conflict**: any principle, non-goal or constraint it breaks. Quote the line.
- **Overlap**: features it duplicates or cannibalises.
- **Proof**: what to measure, the kill criteria, and the smallest version that tests the bet.

## 4. Verdict

One of four, with the two or three reasons that decided it:

| Verdict | Meaning |
|---|---|
| **build** | Serves a real job, cost proportionate, no conflicts |
| **build-with-changes** | Worth it, but cut or reshape named parts first |
| **rethink** | The job is real but this shape is wrong, too costly, or conflicts |
| **don't-build** | No avatar job, or it breaks a principle or non-goal outright |

Use the verdict block format in [RUBRIC.md](RUBRIC.md).

## 5. Deliver

**From `to-spec`:** return the verdict block for the spec's `## Product review` section. Don't publish anything.

**Interactive:** present the verdict block. Then call the Skill tool with "grilling" on the weakest point of the case: the claim the verdict rests on that has the least evidence. If the review exposed a missing principle, non-goal or metric, offer to record it (call the Skill tool with "product-modeling").

**Headless (scheduled):** scope to what shipped since the last run:

```bash
git log --merges --oneline <last-sha>..HEAD
git log --oneline <last-sha>..HEAD -- <each journey's code globs>
```

Review each shipped feature or changed journey at the post-ship stage. Then build findings (FINDINGS-SCHEMA via "report-findings"):

- **The digest goes in the report `summary`**, not in a finding: one line per feature reviewed, with its verdict. It becomes the body of the run's tracking issue, so each month's digest is fresh and old ones close with their runs.
- **One finding per rethink or don't-build verdict**, `rule: product-detracts`, `severity: medium`, `locator: feature:<name>` or `journey:<id>`, `fix: judgement`. The evidence is the verdict block.

Then call the Skill tool with "report-findings" to publish.
