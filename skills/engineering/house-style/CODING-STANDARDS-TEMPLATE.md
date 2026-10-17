# CODING_STANDARDS.md template

Render this into the target repo's root as `CODING_STANDARDS.md`. Replace every `{{…}}` with what is true for this repo; delete a line rather than leave a placeholder. Keep the result under 150 lines. Skills that review code (`review-changes`, the audits) read this file as the repo's standards source.

```markdown
# Coding standards

House style: functional core / imperative shell, vertical slices, TigerStyle. Rules are tagged **[hard]** (violation) or **[judgement]** (heuristic). The reasoning lives in the `house-style` skill; this file is the rulebook for this repo.

## Layout

- **[hard]** New capabilities are slices under `{{slice root, e.g. src/features/<slice>/}}` with `index.ts` as the slice interface; code outside a slice imports only from it.
- **[hard]** Route files under `{{framework route dir}}` are thin shells that call into a slice.
- **[hard]** Logic needed by both `{{runtime A}}` and `{{runtime B}}` lives in one pure module under `{{shared pure module path}}`; no hand-kept mirrors.
- Legacy code under `{{legacy dirs}}` moves into slices when a change touches it; no big-bang moves.

## Functional core

- **[hard]** Core modules (`**/core/**`) do no I/O and read no clock, randomness or environment. Pass `now`, ids and config in.
- **[hard]** Assert invariants with `assert` from `{{assert helper path}}`. Expected failures are returned as discriminated unions.
- **[hard]** Exhaustive `switch` with `satisfies never` on unions.
- **[judgement]** About two assertions per core function; pair them across write and read.

## Limits

- **[hard]** Every loop, retry, page, payload, fan-out and timeout has a named `*Max` bound declared at the top of its module.
- **[hard]** `fetch` uses `AbortSignal.timeout`. Validation schemas bound strings and arrays with `.max()`.
- Platform limits that matter here: {{e.g. Workers CPU ms, D1 rows per query, subrequests per request}}.
- {{Existing budget tests, e.g. query-budget.test.ts}} pin round trips per endpoint; extend them for new endpoints.

## Shape and naming

- **[hard]** Functions are 70 lines or fewer.
- **[hard]** No abbreviations; units and qualifiers last (`timeoutMsMax`). Casing: {{camelCase / snake_case}}.
- **[judgement]** Early returns, no nested ternaries, named booleans for compound conditions.
- **[hard]** Domain names come from `GLOSSARY.md`.

## Errors

- **[hard]** No empty `catch`; no floating promises (`await`, return, or `{{ctx.waitUntil}}`).
- **[hard]** Errors are reported through {{error tracking, e.g. Sentry}}; never swallowed.

## Tests

- Core: unit tests at the core interface. `{{unit test command}}`
- Slice: integration tests at the slice interface using {{local stand-in, e.g. vitest-pool-workers + local D1}}. `{{integration test command}}`
- Journeys: e2e, titled with `[journey:<id>]` from `docs/product/journeys/`. `{{e2e command}}`
- **[hard]** Test through interfaces; mock only true externals at their seam.

## Dependencies and debt

- **[judgement]** Prefer the platform to a new dependency; justify any new dependency in the PR body.
- **[hard]** No `TODO` without an issue link.

## Definition of done

Tests at the agreed seams pass; the feature doc under `docs/features/` is updated; user docs are updated when the change is user-visible; an ADR is recorded when the decision is hard to reverse.
```
