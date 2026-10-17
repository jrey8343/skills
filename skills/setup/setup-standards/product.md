# Product Docs

How skills should find and use this repo's product model: what the product is for, who it serves, and what they come to do.

## Locations

- **`PRODUCT.md`** at the repo root: vision, principles, non-goals, success metrics, constraints.
- **`docs/product/avatars.md`**: the avatars, one section each.
- **`docs/product/journeys/<id>.md`**: one file per journey; its frontmatter links the journey to e2e tests, feature docs, user docs and code.

{Edit the paths above if this repo keeps them elsewhere. Skills read this file first.}

## Before reviewing or building a user-facing change, read these

- `PRODUCT.md`, for the principles and non-goals the change must respect.
- The avatars the change serves, and the journeys it touches.

If any of these files don't exist, proceed silently. `/discover-domain` creates them; `product-modeling` keeps them current.

## Use the avatars' words

UI copy, user docs and test names describe journeys in the avatar's words ("Their words" in `avatars.md`), not internal `GLOSSARY.md` terms, wherever a user will read them.

## Journey ids are stable

Journey ids appear in e2e test titles (`[journey:<id>]`), feature docs and user docs. Never rename an id; change the title instead.
