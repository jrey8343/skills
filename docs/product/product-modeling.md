# product-modeling

## What it does

Keeps a product's model of itself: `PRODUCT.md` (vision, principles, non-goals, success metrics, constraints), avatars (the specific people it serves, in their own words) and journeys (what they come to do, each with a stable id).

The journey is the join key for the whole collection. Each journey file's frontmatter links to its e2e tests, feature docs, user docs and code, and the tests cite it back by id. That turns coverage into set differences, and gives product and persona reviews something concrete to judge against.

## When to reach for it

The agent reaches for it when you discuss product direction, avatars or journeys, edit `PRODUCT.md` or the product docs, or when another skill needs to update journey links or read the formats. You can also ask for it by name. To build the model from scratch in a repo that has none, run [discover-domain](discover-domain.md), which drives this skill. For the team's own terms and ADRs, the sibling is Matt's `domain-modeling`.

## Prerequisites

None. The first time it writes the model, it seeds `docs/agents/product.md` in the target repo, which records where the product file, avatars and journeys live (defaults `PRODUCT.md`, `docs/product/avatars.md`, `docs/product/journeys/<id>.md`), the journey tag tests use, and how coarse a journey is. Edit that file to move them. Journeys link to feature and user docs wherever `docs/agents/docs-targets.md` puts them.

## Journeys and tests

A journey is a goal an avatar would name, ending in a state they can see, that someone would notice breaking and that deserves its own test. Screens, endpoints and error paths are steps and failure modes inside a journey, not journeys of their own. A repo that wants a different grain says so in `docs/agents/product.md`.

An e2e test cites the journey it walks with `[journey:<id>]` in its test or `describe` title, and the journey lists that spec under `e2e`. Ids never change once cited; titles can.

## Two vocabularies

The glossary holds the team's precise terms. The avatars file holds each avatar's own words, and the internal terms they should never see. UI copy and user docs use the avatar's words.

## It's working if

- Reviews cite a principle or non-goal by name.
- A grep for `[journey:` in the tests matches the `e2e` lists in the journey files.
- Every core journey has a test, a feature doc and a help page, or an issue saying it doesn't.
- A journey or avatar agreed in a session is in its file by the end of that session.

## Where it fits

A standalone reference the agent reaches for, and that other skills call to read the formats and update journey links: the product vocabulary layer, sibling to Matt's `domain-modeling`. [discover-domain](discover-domain.md) builds the first model with it; [product-review](product-review.md), [persona-review](persona-review.md), [test-audit](../quality/test-audit.md) and [docs-audit](../quality/docs-audit.md) read its formats; [project-docs](project-docs.md) writes the feature and user docs journeys link to.
