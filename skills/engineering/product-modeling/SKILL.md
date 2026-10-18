---
name: product-modeling
description: "Build and sharpen a product's model of itself: PRODUCT.md (vision, principles, non-goals, metrics), avatars (the people it serves) and journeys (what they come to do). Use when discussing product direction, personas, avatars or user journeys, when editing PRODUCT.md or docs/product/, when linking a journey to its tests or docs, or when another skill needs the journey format."
---

# Product Modeling

The product model answers three questions: what is this product for (**PRODUCT.md**), who is it for (**avatars**), and what do they come to do (**journeys**). It is the product-side sibling of `domain-modeling`: the glossary names the concepts, the product model names the people and their goals.

The **journey** is the join key for the whole skill set. Each journey links to the e2e tests that prove it, the feature docs that explain it, the user docs that teach it, and the code that implements it. Coverage audits are set differences over those links.

## File structure

Default layout (the repo may override it in `docs/agents/product.md`; read that first if it exists):

```
/
├── PRODUCT.md                    vision, principles, non-goals, success metrics
├── GLOSSARY.md                   (domain-modeling owns this)
└── docs/product/
    ├── avatars.md                every avatar, one section each
    └── journeys/
        ├── <journey-id>.md       one file per journey, frontmatter carries the links
        └── ...
```

Create files lazily, when there is something real to write. Formats:

- [PRODUCT-FORMAT.md](PRODUCT-FORMAT.md)
- [AVATAR-FORMAT.md](AVATAR-FORMAT.md)
- [JOURNEY-FORMAT.md](JOURNEY-FORMAT.md)

## Where the writes land

A **model change** — a new avatar, a new or reshaped journey, an edit to `PRODUCT.md` — is written to the checkout that will carry it, not to the one you happen to be sitting in. Take the first that applies:

1. **Already in a linked worktree** (`git rev-parse --git-dir` differs from `git rev-parse --git-common-dir`): write the file now. The branch carries it.
2. **In the main checkout, with work to follow**: write nothing to the repo. State the finished entry in the conversation the moment it resolves — the file it lands in, its full text, and the text it replaces — and name its **carrier**: the spec's `## Model changes` section, the ticket, or this conversation. The worktree that applies the carrier makes the file edit, so the journey lands in the same PR as the code that serves it.
3. **In the main checkout, with the decision itself as the deliverable**: call the Skill tool with "worktree", write the files there, and finish it as a docs-only PR.

A stated but unapplied model change is **pending**. It travels verbatim: a carrier holds the entry's full text, because the agent that applies it was not in this conversation.

When the user asks for the write here and now, write it here and now.

Linking is not a model change: it records targets that already exist, from a worktree that already holds them. Write those where you find them.

## During a session

### Challenge against the model

- A feature that serves no avatar's job is a red flag. Say so: "Which avatar is this for? None of the jobs in avatars.md need it."
- A feature that contradicts a principle or a non-goal in `PRODUCT.md` gets called out with the line it contradicts.
- When the user describes a user, check whether an existing avatar fits before proposing a new one. Avatars are few; merge rather than multiply.

### Sharpen journeys

- A journey is a goal an avatar completes, in their words, start to finish ("book a follow-up appointment"), not a screen or an endpoint.
- Give each journey a stable kebab-case id. Ids never change once tests or docs reference them; rename the title instead.
- Mark a journey `core: true` when the product fails its avatar if that journey breaks. Core journeys must have an e2e test.

### Keep the vocabularies apart

Avatars have their own words. `GLOSSARY.md` holds the team's precise terms; `avatars.md` records the words each avatar actually uses and the internal terms they should never see. User docs and UI copy are written in the avatar's words.

### Record each decision as it crystallises

When a decision about the product, an avatar or a journey crystallises, record it immediately, where *Where the writes land* sends it. Don't batch.

## Linking (the part other skills call this for)

When code, tests or docs for a journey are added or moved, update that journey's frontmatter links (`e2e`, `features`, `user-docs`, `code`). Leave `verified-at` alone unless a human or a passing e2e test has just confirmed the journey works end to end at the current commit; then set it to `git rev-parse --short HEAD`.

## Headless runs

In a headless run (an audit in CI), only **append or correct links** whose targets you have verified exist. Never invent, rename or delete avatars or journeys, and never edit `PRODUCT.md`. Report what's missing as a finding instead.
