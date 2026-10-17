# product-review

## What it does

Judges whether a feature improves or detracts from the product, as a product designer or manager would. It weighs the avatar job the feature serves against its **complexity cost** (new concepts, settings, screens, states and copy that every user pays for in attention), and ends with a verdict: build, build-with-changes, rethink, or don't-build.

It judges the bet, not the code. Every claim is tied to evidence in the repo's own product model: a quoted principle or non-goal from `PRODUCT.md`, a named avatar and job, counted screens and settings.

## When to reach for it

Type `/product-review <target>`, or the agent reaches for it on its own when you ask whether something is worth building or keeping. `to-spec` also runs it automatically as a gate before tickets are cut.

| Situation | Target |
|---|---|
| An idea, spec or issue before anyone builds it | The spec or issue |
| A PR or branch before it ships | The PR or branch |
| A shipped feature you suspect isn't pulling its weight | The feature or journey id |

For whether a specific kind of user can actually get through it, use [persona-review](persona-review.md). For code quality, use [review-changes](../engineering/review-changes.md).

## Prerequisites

`PRODUCT.md`, avatars and journeys (from [discover-domain](../setup/discover-domain.md)). Without them the review still runs, but every conclusion is marked low confidence.

## The verdict block

Each review produces one block: who it serves and how often, what it costs (counted), what it conflicts with (quoted), what it overlaps, the metric that should move, the kill criterion, and the smallest version that would test the bet. For build-with-changes and rethink, it lists the cuts.

In scheduled runs it reviews what shipped since the last run, files one low-severity digest issue, and opens a separate issue only for features it thinks detract.

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

A gate in the plan-to-ship chain (grill-with-docs, then to-spec with product-review and persona-review, then to-tickets), and a monthly scheduled audit. Its sibling is [persona-review](persona-review.md), which checks the same feature from the user's seat. See [which-skill](../productivity/which-skill.md) for the full map.
