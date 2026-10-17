---
name: persona-review
description: "Walk a feature, flow or journey as each relevant avatar from docs/product/avatars.md, through code and copy and optionally a live click-through, and log where it confuses them, dead-ends, or isn't useful. Use when the user wants something checked from an end user's point of view, asks whether a feature is confusing or useful for a type of user or avatar, or when to-spec needs a persona gate."
argument-hint: "[journey-id | feature | spec] [avatar] [live] [headless] [dry-run]"
---

# Persona Review

Become the avatar and try to get their job done. Not "would a user understand this", but "would *this* person, on *their* device, in *their* situation, with *their* words, get it done, and would they bother". The output is a **friction log**: every point where the avatar hesitates, misreads, gets stuck or gives up, in their own voice.

For whether the feature should exist at all, call the Skill tool with "product-review". Persona review assumes the feature exists and asks whether it works for the people it is for.

## 1. Resolve the mode and target

Call the Skill tool with "report-findings" to resolve the mode (headless or interactive). Then pin the target:

| Target | Walk |
|---|---|
| A journey id | That journey, as each avatar it lists |
| A feature or route | Every journey whose `code` globs or `features` cover it |
| A spec (pre-build, from `to-spec`) | The spec's user stories, static pass only |
| Nothing, headless | Core journeys whose `code` changed since the last run; if none changed, the core journey least recently reviewed |

Pass an avatar argument to walk as only that avatar.

## 2. Load the avatars and journeys

Read `docs/agents/product.md` for paths, then the target journeys and every avatar they name. For each avatar, hold onto: context and device, tech comfort, jobs to be done, **Their words**, **Never show them**, frustrations, accessibility needs, trust needs.

If there are no avatars or journeys, stop and say so. Interactively, tell the user to run `/discover-domain`. Headless, emit one finding (`rule: persona-model-missing`, `locator: product#avatars`) and stop.

## 3. Static pass (always)

For each journey and avatar, follow [WALKTHROUGH.md](WALKTHROUGH.md): trace the steps through the routes, components and copy behind the journey's `code` globs, as the avatar would meet them. At each step check:

- **Words**: does the copy use their words, and avoid the "Never show them" list?
- **Path**: is the next action obvious? Does any step dead-end, loop, or need knowledge they don't have?
- **Errors**: does every failure state say what happened and what to do next?
- **Access**: labels, contrast, touch targets, focus order, reading level, for their stated needs.
- **Trust**: do they see what they need before committing (cost, consequence, who sees their data)?
- **Drift**: does the code's flow match the journey file's steps?

## 4. Live pass (only when safe)

Run it only when one of these holds:

- `docs/agents/audits.md` lists a `persona-review.live_targets` URL, or
- interactively, the user has the app running locally and says to use it (or passed `live`).

Never against production. Follow [LIVE.md](LIVE.md) for tools, device emulation and safety rules. Walk the same steps; screenshot each friction point and save it outside the repo.

## 5. Verdict per avatar

For each avatar: **would they use it?** Yes, reluctantly, or no, and what they would do instead (phone someone, a spreadsheet, a competitor, nothing). A "no" is the most important finding a persona review produces.

## 6. Deliver

**From `to-spec`:** return the friction log and verdicts for the spec's `## Product review` section. Don't publish.

**Interactive:** present the friction log per avatar and journey (format in [WALKTHROUGH.md](WALKTHROUGH.md)). Then play the avatar: call the Skill tool with "grilling" and question the user about the worst friction points, in the avatar's voice ("I tapped Save and nothing happened. Did it save?"). Offer to publish findings.

**Headless:** build findings and call the Skill tool with "report-findings" to publish.

| Rule | When |
|---|---|
| `persona-not-useful` | The avatar would not use it (severity `high` for a core journey) |
| `persona-dead-end` | A step with no way forward or back |
| `persona-confusing-copy` | Copy they would misread |
| `persona-jargon` | A "Never show them" term, or internal vocabulary, in their path |
| `persona-accessibility` | A barrier for their stated accessibility needs |
| `persona-no-recovery` | An error state with no explanation or next step |
| `persona-journey-drift` | The code's flow no longer matches the journey file |

Set `locator` to `journey:<id>#step-<n>` (or the route), set `journey`, and quote the copy or describe the screen in `evidence`.
