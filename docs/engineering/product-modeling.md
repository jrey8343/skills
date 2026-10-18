# product-modeling

## What it does

Keeps a product's model of itself: `PRODUCT.md` (vision, principles, non-goals, success metrics, constraints), avatars (the specific people it serves, in their own words) and journeys (what they come to do, each with a stable id).

The journey is the join key for the whole collection. Each journey file's frontmatter links to its e2e tests, feature docs, user docs and code. That turns coverage into set differences, and gives product and persona reviews something concrete to judge against.

## When to reach for it

Type `/product-modeling`, or the agent reaches for it when you discuss product direction, avatars or journeys, edit `PRODUCT.md` or `docs/product/`, or when another skill needs to update journey links. To build the model from scratch, run [discover-domain](../setup/discover-domain.md), which drives this skill.

## Where the writes land

Like [domain-modeling](domain-modeling.md), a new avatar or journey settled in a design session is not written into the checkout you are designing in. In a worktree it writes the file immediately; from your main checkout it states the entry and hands it to a **carrier** — the spec's `## Model changes` section, the ticket, or the conversation — and the worktree that applies the carrier makes the edit. A product decision that is the whole deliverable gets its own docs-only PR.

Link updates are the exception: they record targets that already exist, in the worktree that holds them, so they are written where they are found. The same goes for headless audit runs, which only ever append verified links.

## Two vocabularies

`GLOSSARY.md` holds the team's precise terms. `avatars.md` holds each avatar's own words, and the internal terms they should never see. UI copy and user docs use the avatar's words.

## It's working if

- Reviews cite a principle or non-goal by name.
- A journey agreed while planning arrives in the same PR as the code that serves it, not as an untracked file in your root checkout.
- Every core journey has a test, a feature doc and a help page, or an issue saying it doesn't.

## Where it fits

The vocabulary layer, sibling to [domain-modeling](domain-modeling.md). Used by [product-review](../audits/product-review.md), [persona-review](../audits/persona-review.md), [test-audit](../audits/test-audit.md) and [docs-audit](../audits/docs-audit.md). See [which-skill](../productivity/which-skill.md).
