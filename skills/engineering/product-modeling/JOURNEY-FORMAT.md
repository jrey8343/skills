# Journey format

One file per journey: `docs/product/journeys/<journey-id>.md`. The frontmatter is machine-read by the audit skills, so keep it exact.

```markdown
---
id: book-follow-up
title: Book a follow-up appointment
avatars: [returning-customer]
core: true
e2e:
  - e2e/booking.spec.ts
features:
  - docs/features/bookings.md
user-docs:
  - help/customers/book-a-follow-up
code:
  - "src/features/bookings/**"
  - "src/pages/book/**"
verified-at: 3f9a2c1
---

# Book a follow-up appointment

**Avatar**: [Returning customer](../avatars.md#returning-customer). **Goal**: get the next appointment in the diary without phoning the shop.

## Steps

1. {What the avatar does and sees, in their words.}
2. ...

## Done when

{The observable end state that proves the journey succeeded.}

## Failure modes

- {What can go wrong, and what the avatar should see when it does.}
```

## Field rules

| Field | Rule |
|---|---|
| `id` | Kebab-case, stable forever. Matches the filename. Tests and docs reference it. |
| `title` | The goal in the avatar's words. Free to change. |
| `avatars` | One or more avatar anchors from `avatars.md`. Never empty. |
| `core` | `true` if the product fails its avatar when this breaks. Core journeys must have at least one `e2e` entry. |
| `e2e` | Paths to spec files. Each spec's test or describe title contains `[journey:<id>]`. |
| `features` | Paths to `docs/features/*.md` pages describing how it works. |
| `user-docs` | Paths or slugs in the user-docs target recorded in `docs/agents/docs-targets.md`. |
| `code` | Globs covering the code that implements the journey. Drift detection compares these against `verified-at`. |
| `verified-at` | Short SHA of the last commit at which a human or a passing e2e run confirmed the whole journey. Omit until then. |

## What the audits derive from this

- **test-audit**: core journeys with empty `e2e`, or whose spec lacks the `[journey:<id>]` tag.
- **docs-audit**: journeys with empty `features` or `user-docs`, and journeys whose `code` globs changed after `verified-at`.
- **persona-review**: the steps to walk, as which avatar, and where the code lives.
