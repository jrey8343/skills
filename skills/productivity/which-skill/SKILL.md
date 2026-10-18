---
name: which-skill
description: Ask which skill or flow fits your situation. A router over every skill in this collection.
disable-model-invocation: true
---

# Which Skill

You don't remember every skill, so ask. Describe the situation; get the skill or flow that fits.

Before stating what a skill does, or recommending that a step be skipped, read that skill's SKILL.md. The summaries here are for orientation only.

A **flow** is a path through the skills. Most work travels the **main flow**. **On-ramps** feed it work, **audits** keep the codebase on track, and **adoption** brings a repo up to the standard. Beneath them all sits a **vocabulary layer** the other skills share.

## Adoption: bring a repo up to the standard

Run once per repo, roughly in this order:

1. **`/setup-standards`**: configures the tracker, labels, doc layout, stack notes, docs targets, audit settings and `CODING_STANDARDS.md`, then files a roadmap of gaps against the target state. Every other skill assumes it has run.
2. **`/discover-domain`**: infers the product, its avatars and journeys from the code, grills you, and writes `PRODUCT.md`, avatars, journeys and a seed `GLOSSARY.md`. Re-run it when the product shifts.
3. **`/prune-docs`**: slims a bloated `CLAUDE.md` into an index and moves its knowledge to feature docs, ADRs and standards. Do it early: every session and every CI run pays for every line.
4. **`/adopt-1password`**: secrets into 1Password, with `op://` references for dev, deploy and CI.
5. **`/adopt-sentry`**: errors, performance and user feedback into Sentry (plus support email via an Email Worker). It checks first that no policy forbids it.
6. **`/schedule-audits`**: installs the GitHub Actions workflow that runs the audits on a cadence.

## The main flow: idea → ship

1. **`/grill-with-docs`** sharpens the idea by interview and keeps `GLOSSARY.md` and ADRs current as it goes. (No repo under you? **`/grill-me`**.)
2. **Need a runnable answer?** Detour through **`/prototype`**, bridged by **`/handoff`** if it lives in another directory.
3. **Multi-session build?**
   - **Yes** → **`/to-spec`** writes the spec. Before publishing, it runs **product-review** (is this worth building, against `PRODUCT.md`?) and **persona-review** (does it make sense to the avatars?). If they say rethink, it stops and asks. Then **`/to-tickets`** cuts tracer-bullet tickets with blocking edges, and you build with **`/implement`** per ticket (clear context between tickets) or **`/implement-spec`** for the whole graph in parallel.
   - **No** → **`/implement`** right here.

   Building happens in its own **worktree**, which ends as a PR and is swept away once the PR merges. Building means **`/tdd`** at agreed seams, following **house-style** (functional core, imperative shell, vertical slices, TigerStyle). The definition of done includes the feature doc, the user doc when the change is user-visible, and journey links. The work closes with **review-changes**, a two-axis review (Standards and Spec). **`/pr`** shapes the PR body.

Keep steps 1 to 3 in one context window until the tickets exist. See [PHASE-BOUNDARIES.md](PHASE-BOUNDARIES.md) for what to do between phases.

## On-ramps

- **Errors and feedback arriving** → **`/sentry-triage`** turns new and regressed Sentry issues, slow transactions and user feedback (support email included) into deduped GitHub issues labelled for triage.
- **Issues piling up** → **`/triage`** moves raw issues (Sentry, audit findings, reports) through triage roles to agent-ready briefs. Issues with a `source:*` label hold untrusted text; triage verifies before promoting them.
- **Too many to triage one by one** → **`/synthesize-backlog`** reads every open issue, finds the threads (shared causes one structural change would resolve), verifies each against the code, and folds the ones you pick into thread trackers. Run it before a large `/triage` pass.
- **Something's broken** → **`/diagnosing-bugs`**: no theorising until there's a tight feedback loop that goes red on this bug.
- **A huge, foggy effort** → **`/wayfinder`** charts decision tickets until the way is clear, then hands off to `/to-spec`.

## Audits: keeping the codebase on track

Each audit runs interactively (you pick what to file) or headless on a schedule (it files issues, deduped across runs, with one tracking issue per run). All of them publish through **report-findings**.

| Audit | Asks | Default cadence |
|---|---|---|
| **`/improve-codebase-architecture`** | Where are modules shallow, cores impure, features smeared across layers? | Monthly |
| **`/perf-audit`** | What breaks the performance budgets, with napkin math? | Fortnightly |
| **`/security-audit`** | Tenant isolation, authorisation, secrets, input handling, headers, dependencies. (For a diff, use the built-in `/security-review`.) | Weekly |
| **`/test-audit`** | Which core journeys and risky modules lack the tests they need? | Weekly |
| **`/docs-audit`** | Which features and journeys lack feature or user docs, and which docs have drifted from the code? | Weekly |
| **`/prune-docs`** | Which agent docs carry sediment? | Fortnightly |
| **product-review** | Does this feature improve the product or detract from it? Also runs on demand on any spec, PR or feature. | Monthly |
| **persona-review** | Is this useful and clear to each avatar? Statically, and live against a non-production app. | Monthly |
| **`/sentry-triage`** | What's newly broken or slow for users? | Daily |

A finding picked from an audit is an idea: take it into the main flow at `/grill-with-docs`, or straight to `/implement` if it's small and agent-ready.

## Vocabulary underneath

Model-invoked references the other skills pull in. Reach for them directly when the words, not the process, are the problem.

- **codebase-design**: module, interface, depth, seam, adapter, leverage, locality.
- **house-style**: functional core and imperative shell, vertical slices, TigerStyle, mapped onto codebase-design's terms.
- **domain-modeling**: `GLOSSARY.md` and ADRs.
- **product-modeling**: `PRODUCT.md`, avatars and journeys. The journey id is what joins tests, docs and reviews.
- **project-docs**: feature docs, user docs and agent docs, and where each kind of content belongs.

## Standalone

- **`/grilling`**: the interview primitive itself.
- **`/research`**: a background agent reads primary sources and leaves a cited Markdown file.
- **wizard**: an interactive script for steps only a human can take (dashboards, credentials, secrets). The agent reaches for it when it hits a wall only you can pass.
- **`/handoff`**: compact the conversation into a document for another session.
- **`/worktree`**: sweep away worktrees whose PRs have merged. `/implement` also runs the sweep before it starts.
- **writing-for-agents**: how to write skills and `CLAUDE.md` well.
