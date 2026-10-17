# Vertical Slices

A slice is one domain capability, end to end, in one place: its core, its shell, its UI and its tests. It is a tier-spanning **module**, and its interface is the only thing the rest of the codebase may touch. Slices trade layer-by-layer consistency for **locality**: a change to "how bookings are cancelled" happens in one folder.

## Layout

```
src/features/<slice>/
  index.ts            the slice interface: the only import path for code outside the slice
  core/               functional core: pure, asserted, bounded
  shell/              adapters: handlers, repos (D1/KV/R2), third-party clients
  ui/                 components owned by the slice (when UI is co-located)
  <slice>.test.ts     integration tests at the slice interface
  core/*.test.ts      unit tests at the core interface
```

Adjust the root to the repo (`src/features`, `worker/src/features`, `app/features`) and record it in `CODING_STANDARDS.md`. Keep the internal shape.

## Naming and granularity

- **Name a slice with a `GLOSSARY.md` term.** If no term fits, that is a domain-modelling question; resolve it before creating the folder.
- **Slice by capability, not by entity.** "enrolment" and "cancellation" are capabilities; "customers" and "bookings" as CRUD buckets turn back into layers.
- A slice that keeps needing another slice's internals is either the wrong cut or one slice.

## Framework constraints

Some frameworks own where files live:

- **File-based routing** (Astro `src/pages`, Next `app/`, SvelteKit `routes/`): keep the route file where the framework needs it, as a thin shell that imports from the slice interface. The route file contains no domain logic.
- **Split runtimes** (a Worker API and a client bundle): a slice may have a half on each side. Logic both halves need lives in one pure module that both import. Never keep hand-synchronised copies.
- **Schema files** (a single Drizzle `schema.ts`, a migrations folder): leave them central when the tool requires it. The slice owns its queries, not necessarily its table definitions.

## Adopting slices in a layered codebase

No big-bang moves. In order of preference:

1. **New capability:** build it as a slice from the first commit.
2. **Touching a smeared feature:** if the change already rewrites most of it, move it into a slice in the same PR.
3. **Otherwise:** extract the pure core into the future slice's `core/` and leave the shell where it is. File a finding for the rest.

Each move must keep tests green at the slice interface. Delete tests that only tested the old layers' internals once the slice-level tests cover the behaviour (codebase-design's "replace, don't layer").

## Shared kernel

`src/shared/` holds what two or more slices genuinely share: the `assert` helper, money and time value types, the logger. It grows slowly. Anything domain-specific in there is a missing slice.
