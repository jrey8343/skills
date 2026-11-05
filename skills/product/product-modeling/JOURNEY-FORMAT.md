# Journey format

One file per journey, in the journeys directory named in `docs/agents/product.md` (default `docs/product/journeys/<journey-id>.md`). The frontmatter is machine-read by the audit skills, so keep it exact. Paths in it are relative to the repo root.

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

The avatar link is relative from the journey file to the avatars file; adjust it when the repo keeps them elsewhere.

## Field rules

| Field | Rule |
|---|---|
| `id` | Kebab-case, stable forever. Matches the filename. Tests and docs reference it. |
| `title` | The goal in the avatar's words. Free to change. |
| `avatars` | One or more avatar ids from the avatars file. Never empty. |
| `core` | `true` if the product fails its avatar when this breaks. Core journeys must have at least one `e2e` entry. |
| `e2e` | Paths to spec files. Each spec's test or describe title contains the journey tag (below). |
| `features` | Paths to feature docs describing how it works, in the feature-docs location recorded in `docs/agents/docs-targets.md` (default `docs/features/<feature>.md`; some repos keep them per bounded context). |
| `user-docs` | Paths or slugs in the user-docs target recorded in `docs/agents/docs-targets.md`. |
| `code` | Globs covering the code that implements the journey. Drift detection compares these against `verified-at`. |
| `verified-at` | Short SHA of the last commit at which a human or a passing e2e run confirmed the whole journey. Omit until then. |

## Citing a journey in tests

The tag is `[journey:<id>]`, placed in the title of the `describe` block or test that walks the journey:

```ts
test.describe("[journey:book-follow-up] returning customer books again", () => { /* ... */ });
```

- One tag per journey the block walks end to end. A block that walks two journeys carries both tags.
- Put it in the title, not a comment, so it shows in test reports and a grep for `[journey:` finds every citation.
- Tag only tests that walk the journey to its **Done when**. A unit test of one step is not a citation.
- The tag and the `e2e` list must agree: every listed spec carries the tag, and every spec carrying the tag is listed. Audits flag either side missing.
- When the test runner cannot carry free text in titles, the repo records its own tag form under **Journey tag** in `docs/agents/product.md`; use that form everywhere instead.

## What makes a journey worth naming

Name a journey when all of these hold:

- **An avatar would say it as a goal.** "Book a follow-up appointment", not "the booking form" or `POST /bookings`.
- **It ends somewhere observable.** You can write its **Done when** as a state the avatar can see.
- **Someone would notice it breaking.** An avatar would phone, complain or leave. If nobody would notice, it is a step inside a bigger journey.
- **It deserves its own test.** If it would only ever be checked as part of another journey, fold it into that journey's steps or failure modes.

Don't name a journey for each screen, endpoint, setting or error path; those are steps and failure modes. Variants that share the goal and the end state (paying by card or by invoice) are one journey with a failure mode or step branch each, unless they serve different avatars.

Most products need five to twenty journeys, a handful of them core. The repo can set its own grain, coarser or finer, under **Journey grain** in `docs/agents/product.md`; that rule wins over this default.

## What the audits derive from this

- **test-audit**: core journeys with empty `e2e`, listed specs that lack the journey tag, and specs carrying a journey tag that no journey lists under `e2e` (or citing an unknown id).
- **docs-audit**: journeys with empty `features` or `user-docs`, and journeys whose `code` globs changed after `verified-at`.
- **persona-review**: the steps to walk, as which avatar, and where the code lives.
