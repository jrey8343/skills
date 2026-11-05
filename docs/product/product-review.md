# product-review

## What it does

Judges whether a feature improves or detracts from the product, as a product designer or manager would, and ends with a verdict: build, build-with-changes, rethink, or don't-build. It weighs the avatar job the feature serves against its **complexity cost** (new concepts, settings, screens, states and copy that every user pays for in attention).

It judges the bet, not the code. Every claim is tied to evidence in the repo's own product model: a quoted principle or non-goal from `PRODUCT.md`, a named avatar and job, counted screens and settings.

## When to reach for it

You type it: `/product-review <target>`. It's an audit, so the agent never runs it by surprise, and CI can run it on a schedule.

| Situation | Target |
|---|---|
| A plan you're about to turn into a spec | Run it in the same conversation, before `/to-spec` |
| A spec or issue before anyone builds it | The issue number |
| A PR or branch before it ships | The PR number or branch |
| A shipped feature you suspect isn't pulling its weight | The feature name or journey id |

For whether a specific kind of user can actually get through it, use [persona-review](persona-review.md). For code quality, use Matt's `code-review`.

## Prerequisites

- `docs/agents/audits.md`, seeded by [schedule-audits](../quality/schedule-audits.md). Without it an interactive run tells you to run `/schedule-audits`, and a headless run files one `audit-not-configured` issue.
- `PRODUCT.md`, avatars and journeys, from [discover-domain](discover-domain.md) and kept by [product-modeling](product-modeling.md). Without them the review still runs, but every conclusion is marked low confidence.

## The verdict block

Each review produces one block: who it serves and how often, what it costs (counted), what it conflicts with (quoted), what it overlaps, the metric that should move, the kill criterion, and the smallest version that would test the bet. For build-with-changes and rethink, it lists the cuts.

On a plan it offers to fold the cuts in and keep the block as a `## Product review` section; on a spec issue it offers to post it as a comment, with your permission. A rethink or don't-build on an issue, PR, feature or journey becomes a finding, filed through [report-findings](../quality/report-findings.md) with the `audit:product-review` label and no state label, so your Triage decides what happens to it. Scheduled (headless) runs always review what shipped since the last run, never a single target, put a one-line-per-feature digest in the run's tracking issue, and file a separate issue only for features they think detract. A single-target run you type is a targeted run: its findings are filed, but it opens no tracking issue, so the last scheduled digest stays open and the next scheduled run never skips features.

## Making it a step before a spec is published

Nothing forks `to-spec` to run it, and since it's user-invoked, an agent can't run it for you: the step is one a person takes. Matt's `to-spec` publishes the spec and labels it `ready-for-agent` in one go, so the reliable route is to run `/product-review` on the plan in the conversation before you run `/to-spec`, folding in any cuts first and holding off on a rethink or don't-build. To review a spec that's already published, swap its `ready-for-agent` label for `needs-triage` until the verdict is posted. To make it a standing step, write the step into the repo's `AGENTS.md` or `CLAUDE.md` as "stop and tell the user to run `/product-review`".

## Common questions

**Why does it keep asking which avatar a feature is for?**
A feature with no avatar job is the most common way products bloat. If no avatar fits, either the feature is speculative or the avatars are incomplete; both are worth knowing.

**Can it overrule a principle?**
No. A conflict with a principle or non-goal is resolved by changing the feature, or deliberately changing the principle (with an ADR). The review surfaces the conflict; you decide.

## It's working if

- Specs get smaller between the draft and the tickets.
- Reviews quote your own `PRODUCT.md` back at you, and occasionally expose a principle you hadn't written down.
- Shipped features occasionally get a "don't-build" in hindsight, and you remove them.

## Where it fits

A standalone check you run on a spec, issue, PR or feature, a step your repo can put before publishing a spec, and a periodic audit run by [schedule-audits](../quality/schedule-audits.md). Its sibling is [persona-review](persona-review.md), which checks the same feature from the user's seat. It reads the model [product-modeling](product-modeling.md) keeps and publishes through [report-findings](../quality/report-findings.md).
