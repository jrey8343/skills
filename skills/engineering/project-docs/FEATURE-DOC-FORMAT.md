# Feature doc format

One file per feature: `docs/features/<feature>.md`. A feature is a capability named with a `GLOSSARY.md` term. It usually maps to one slice, and serves one or more journeys.

```markdown
---
feature: bookings
journeys: [book-follow-up, cancel-booking]
code:
  - "src/features/bookings/**"
  - "worker/migrations/*booking*.sql"
adrs: [docs/adr/0004-refunds-are-all-or-nothing.md]
verified-at: 3f9a2c1
---

# Bookings

{Two or three sentences: what the capability does and for whom, in GLOSSARY terms.}

## How it works

{The data flow from entry point to storage and back. Name modules, not files, unless a path is the clearest pointer. A Mermaid sequence or flowchart when there are more than three hops.}

## Rules and invariants

- {Each business rule the code enforces, and where it is asserted.}

## Edge cases and failure modes

- {What happens when ..., and what the user sees.}

## Limits

- {Named bounds and their values: page sizes, timeouts, retries, quotas.}

## Decisions

- {Short decisions not worth an ADR, with the reason.} ADRs: {links}.

## Operating it

- {Feature flags, config, cron, alerts, how to tell it is healthy.}
```

## Rules

- **Explain, don't transcribe.** The code says what it does; the feature doc says how the pieces fit and why. If a section restates a function body, delete it.
- **Pointers over paths.** Name modules and interfaces. Use file paths only as entry points, and only where they are stable.
- **No changelog.** "Slice 3 added X, slice 4 fixed Y" belongs in git and issues. A feature doc describes the feature as it is now.
- **One feature per file.** When a doc covers two GLOSSARY terms that change for different reasons, split it.
- `code` globs must match real files. A glob matching nothing is drift too.
- `verified-at` only moves when someone has re-read the code changes since the previous value.
