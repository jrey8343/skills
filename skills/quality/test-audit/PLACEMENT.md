# Placement

Where each kind of test belongs is the repo's own decision, kept in `CODING_STANDARDS.md` at its root. This audit reads it; it never writes it.

## What to read

Look in `CODING_STANDARDS.md` for a test placement section: usually a table or list under a heading such as "Tests", "Testing" or "Test placement". Take from it:

- **the seams** the repo tests at, and which kind of test each gets (unit, integration, e2e);
- **the location** of each kind (beside the code, a `tests/` tree, an `e2e/` folder);
- **the stand-in** each kind uses for storage and externals;
- **how to find the seams in code**: how a functional core is marked (a folder, a suffix, a header comment) and where slice interfaces sit (a features root, an `index` per slice, a route file).

The repo's words win over the defaults below. If the file exists but names no seams or locations, treat placement as missing.

## The common shape

When placement is missing, an interactive run can offer this shape for the user to adapt and add to `CODING_STANDARDS.md`. A headless run only notes the gap in its `summary`.

```markdown
## Test placement

| Seam | Test | Location | Stand-in |
|---|---|---|---|
| **Functional core interface** (data in, decision out) | Unit, table-driven: every branch, every boundary, the invariants. | {e.g. beside the module, `*.test.ts`} | None: the core has no adapters. |
| **Slice interface** (the route, handler or entry module of a vertical slice) | Integration: real input in, observable output and stored state out. | {e.g. `<slice>/<slice>.int.test.ts`} | The platform's local stand-in for storage. Mock only true externals, at their seam. |
| **Journey** (an avatar's goal, from the product model) | e2e through the running app, with the journey tag in the test or `describe` title. | {e.g. `e2e/`} | The app with seeded data. |

- Functional cores live in {where, or how they are marked}.
- Slice interfaces are {e.g. `src/features/<slice>/index.ts`}.
- Don't unit-test the shell: it has no logic of its own. If it seems to need a unit test, the core is leaking into it.
```
