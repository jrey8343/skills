---
name: product-modeling
description: "Build and sharpen a product's model of itself: PRODUCT.md (vision, principles, non-goals, metrics), avatars (the people it serves) and journeys (what they come to do). Use when discussing product direction, personas, avatars or user journeys, when editing PRODUCT.md, avatars or journey files, when linking a journey to its tests or docs, or when another skill needs the product, avatar or journey format."
---

# Product Modeling

The product model answers three questions: what is this product for (**PRODUCT.md**), who is it for (**avatars**), and what do they come to do (**journeys**). It is the product-side sibling of `domain-modeling`: the glossary names the concepts, the product model names the people and their goals.

The **journey** is the join key for the whole skill set. Each journey links to the e2e tests that prove it, the feature docs that explain it, the user docs that teach it, and the code that implements it. Coverage audits are set differences over those links.

## Where the model lives

Read `docs/agents/product.md` in the repo first. It names where the product file, the avatars file and the journeys directory live, the journey tag tests use, and the repo's journey grain. When it is missing and you are about to write the model, seed it from [product.md](product.md) and adjust the paths to what the repo already has. When only reading, use the defaults:

```
/
├── PRODUCT.md                    vision, principles, non-goals, success metrics
└── docs/product/
    ├── avatars.md                every avatar, one section each
    └── journeys/
        ├── <journey-id>.md       one file per journey, frontmatter carries the links
        └── ...
```

Feature docs and user docs are not part of the model; journeys link to wherever `docs/agents/docs-targets.md` puts them (feature docs default to `docs/features/<feature>.md`). The glossary is `domain-modeling`'s, at the place `docs/agents/domain.md` names.

Create files lazily, when there is something real to write. Formats:

- [PRODUCT-FORMAT.md](PRODUCT-FORMAT.md)
- [AVATAR-FORMAT.md](AVATAR-FORMAT.md)
- [JOURNEY-FORMAT.md](JOURNEY-FORMAT.md), including how tests cite a journey and what makes one worth naming

## During a session

### Challenge against the model

- A feature that serves no avatar's job is a red flag. Say so: "Which avatar is this for? None of the jobs in the avatars file need it."
- A feature that contradicts a principle or a non-goal in `PRODUCT.md` gets called out with the line it contradicts.
- When the user describes a user, check whether an existing avatar fits before proposing a new one. Avatars are few; merge rather than multiply.

### Sharpen journeys

- A journey is a goal an avatar completes, in their words, start to finish ("book a follow-up appointment"), not a screen or an endpoint. Test a candidate against **What makes a journey worth naming** in [JOURNEY-FORMAT.md](JOURNEY-FORMAT.md), or the repo's **Journey grain** when `docs/agents/product.md` sets one.
- Give each journey a stable kebab-case id. Ids never change once tests or docs reference them; rename the title instead.
- Mark a journey `core: true` when the product fails its avatar if that journey breaks. Core journeys must have an e2e test whose title carries the journey tag (`[journey:<id>]` unless the repo sets another form).

### Keep the vocabularies apart

Avatars have their own words. The glossary holds the team's precise terms; the avatars file records the words each avatar actually uses and the internal terms they should never see. User docs and UI copy are written in the avatar's words. When a session sharpens a team term rather than an avatar's word, call the Skill tool with `domain-modeling` and let it write the glossary.

### Write each decision as it crystallises

When a decision about the product, an avatar or a journey crystallises (a new avatar, a new or reshaped journey, an edit to `PRODUCT.md`), write it to its file straight away, in the checkout you are in. Don't batch, and don't hold it back for a later change to carry. Tell the user which file changed and show the entry.

## Linking (the part other skills call this for)

When code, tests or docs for a journey are added or moved, update that journey's frontmatter links (`e2e`, `features`, `user-docs`, `code`). Add the journey tag to a spec's title when you list it under `e2e`. Leave `verified-at` alone unless a human or a passing e2e test has just confirmed the journey works end to end at the current commit; then set it to `git rev-parse --short HEAD`.

## Headless runs

In a headless run (an audit in CI), never write files. Never invent, rename or delete avatars or journeys, and never touch `PRODUCT.md` or seed `docs/agents/product.md`. A missing or wrong link, a core journey without a test, or a missing model is evidence for the calling audit to report as a finding.
