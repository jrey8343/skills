# PRODUCT.md format

`PRODUCT.md` lives at the repo root. It is short (under 100 lines) and changes rarely. Product review judges features against it, so every line has to be something a feature could be measured against.

```markdown
# {Product name}

{One or two sentences: what it is and who it is for.}

## Vision

{Two to four sentences: the change in the world this product exists to make.}

## Avatars

{One line each, linking into docs/product/avatars.md.}
- [{Avatar name}](docs/product/avatars.md#{anchor}): {who they are in one clause}

## Principles

Numbered, each a decision rule that resolves real trade-offs. A principle nobody would argue against is not a principle.
1. **{Principle}.** {What it means in practice, and what it rules out.}

## Non-goals

Things this product deliberately does not do, so features drifting toward them get caught.
- {Non-goal}: {why}

## Success metrics

How we know it's working. Each metric names the avatar and journey it measures.
- {Metric}: {definition}. ({avatar}, journey `{journey-id}`)

## Constraints

Facts that bound every decision: regulatory regimes, data residency, platform, business model. Link the ADR or policy doc that holds the detail.
- {Constraint} ({link})
```

## Rules

- **Opinionated, not aspirational.** "People stay in control: the system drafts, a person approves" is a principle. "Great UX" is not.
- **Non-goals are as valuable as goals.** They are what product review cites most often.
- **Constraints are facts, not preferences.** "Customer data stays in the EU" belongs here, linked to its policy. "We like Svelte" does not.
- No feature lists, no roadmap, no implementation detail. Those go in specs, issues and `docs/features/`.
