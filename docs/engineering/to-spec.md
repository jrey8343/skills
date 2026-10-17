# to-spec

## What it does

`to-spec` turns the conversation you've just had into a **spec** and publishes it to your issue tracker as a single issue. It doesn't interview you: the deciding is already done, so it synthesises what is known from the thread, the codebase, `GLOSSARY.md`, the ADRs and the product model.

Before publishing, it puts the draft through a **product gate**: [product-review](../audits/product-review.md) judges whether the feature serves a real job from `PRODUCT.md` and the avatars or detracts from the product, and [persona-review](../audits/persona-review.md) walks the described journeys as each avatar to predict confusion. Their verdicts land in the spec's `## Product review` section. A "don't build" or "rethink" verdict stops the publish and puts the decision to you, which catches bad ideas before any code exists.

## When to reach for it

You invoke this by typing `/to-spec`; the agent won't reach for it on its own.

| Where you are | What to run |
| --- | --- |
| Nothing decided yet | [grill-with-docs](grill-with-docs.md) first |
| Decided, and the work fits one session | [implement](implement.md): skip the spec |
| Decided, and the work spans several sessions | `/to-spec`, then [to-tickets](to-tickets.md) |
| A [wayfinder](wayfinder.md) map has cleared | `/to-spec #<map issue>` |

## Prerequisites

An issue tracker and triage labels configured by [setup-standards](../setup/setup-standards.md). The product gate works best with a product model (`PRODUCT.md`, avatars, journeys) from [discover-domain](../setup/discover-domain.md); without one, the reviews have less to judge against and say so.

## The spec is a decision record

The spec keeps what you settled while grilling (the solution's shape, the trade-offs, what you refused) after the conversation is cleared. If it states something you never said, that's a defect. User stories name avatars and the journey each serves, so a story serving no journey shows up as either a new journey or scope creep.

## Seams before prose

Before writing, it sketches the seams where the feature will be tested and checks them with you, preferring existing seams and the highest seam possible. [tdd](tdd.md) works only at agreed seams, and [review-changes](review-changes.md) checks the diff against the spec, so the seam conversation matters here.

## Common questions

**Why does the spec get `ready-for-agent`? I don't want an agent building off it.**

The label means "no further triage needed". AFK agents polling for it can't tell a spec from a ticket, though, so exclude the parent spec in your AFK prompt, or remove the label after `/to-tickets`.

**The product review said "rethink". Can I override it?**

Yes. It stops and asks; if you go ahead, your reason is recorded in the `## Product review` section so the decision is visible later.

**Why not go straight from grilling to tickets?**

Often you should. The spec earns its step only on multi-session work, where tickets are disposable and the spec keeps the reasoning.

**Do I keep the spec in sync once tickets start?**

Nothing keeps it in sync; treat it as a snapshot. Lasting knowledge goes in `GLOSSARY.md`, ADRs and feature docs.

**My work is a refactor, not a feature.**

The template leans on user stories, which fit architecture work badly. Use the implementation and testing decisions sections, and record lasting decisions as ADRs.

## It's working if

- It starts writing instead of asking a new round of questions.
- It shows you the seams first, and proposes as few as it can.
- User stories name your avatars and journey ids, not generic "users".
- The `## Product review` section holds real verdicts, and a negative one stopped to ask you.
- You remember making every decision in it.

## Where it fits

A chain step on the multi-session branch: [grill-with-docs](grill-with-docs.md) → `to-spec` → [to-tickets](to-tickets.md) → [implement](implement.md) → [review-changes](review-changes.md). It calls [product-review](../audits/product-review.md) and [persona-review](../audits/persona-review.md) as its gate. For the whole map, see [which-skill](../productivity/which-skill.md).
