# Product Model

How skills find and use this repo's product model: what the product is for, who it serves, and what they come to do. Skills read this file first; edit it when the repo keeps things elsewhere.

## Locations

- **Product**: `PRODUCT.md` at the repo root. Vision, principles, non-goals, success metrics, constraints.
- **Avatars**: `docs/product/avatars.md`. The avatars, one section each.
- **Journeys**: `docs/product/journeys/<id>.md`. One file per journey; its frontmatter links the journey to e2e tests, feature docs, user docs and code.

Feature docs and user docs live where `docs/agents/docs-targets.md` says.

## Journey tag

E2e tests cite a journey with `[journey:<id>]` in the title of the test or `describe` block that walks it. If the test runner can't carry it, this section names the form to use instead.

## Journey grain

A journey is a goal an avatar would name, that ends in a state they can see, that someone would notice breaking, and that deserves its own test. Where this repo names journeys coarser or finer, this section says so, with an example of each side of the line.

## Before reviewing or building a user-facing change, read these

- The product file, for the principles and non-goals the change must respect.
- The avatars the change serves, and the journeys it touches.

If any of these files don't exist yet, carry on without them; `/discover-domain` builds the first model and product-modeling keeps it current.

## Use the avatars' words

UI copy, user docs and test names describe journeys in the avatar's words ("Their words" in the avatars file), not internal glossary terms, wherever a user will read them.

## Journey ids are stable

Journey ids appear in e2e test titles, feature docs and user docs. Never rename an id; change the title instead.
