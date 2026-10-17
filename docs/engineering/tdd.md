# tdd

## What it does

`tdd` builds a feature or fixes a bug test-first: one failing test, then just enough code to pass it, then the next behaviour. It carries the standards that make that loop produce tests worth keeping: what a good test is, where tests go, what mocks are for, and the anti-patterns that make a suite worthless.

It writes no test at a seam you have not agreed to first. Before any test exists, it names the boundaries it intends to test at and stops for your confirmation. The house style gives it three standard seams to propose: the **functional core** interface (unit tests), the **slice** interface (integration tests against the platform's local stand-in), and the **journey** (an e2e test tagged `[journey:<id>]`). `tdd` is a reference, not a driver: you or [implement](implement.md) run the session that applies it.

## When to reach for it

Type `/tdd`, or the agent reaches for it automatically when a task fits: building or fixing something test-first, or "red-green-refactor".

| Your situation | Where to go |
| --- | --- |
| A behaviour with defined inputs and outputs | `tdd` |
| The behaviour isn't pinned down yet | [to-spec](to-spec.md), which also agrees the seams up front |
| The question is the shape of the interface, not the tests | [codebase-design](codebase-design.md) |
| A spec or tickets, and you want the build run for you | [implement](implement.md), which drives `tdd` per ticket |
| Config, wiring, glue, straight delegation | Nothing here fits well: there's no independent source of truth to test against |

## Prerequisites

[codebase-design](codebase-design.md) and [house-style](house-style.md) installed (it uses their vocabulary). Journey tagging needs a product model (`docs/product/journeys/`), which [discover-domain](../setup/discover-domain.md) creates; without one, e2e tests are just e2e tests.

## The loop, and which seam gets which test

**Red-green.** Write the failing test, then only enough code to pass it. There is no refactor phase in the loop; refactoring belongs to [review-changes](review-changes.md).

**Vertical slice.** One test at one seam, then the minimal implementation, then repeat. The first cycle is a **tracer bullet** proving one path end to end. Writing all the tests first verifies imagined behaviour.

**Placement.** The house style decides where tests go:

| Seam | Test |
| --- | --- |
| Functional core | Unit, table-driven, exhaustive. No stand-ins: the core has no adapters. |
| Slice interface | Integration with the platform's local stand-in (for Workers, local D1/KV via vitest-pool-workers). Mock only true externals. |
| Journey | e2e through the running app, titled `[journey:<id>]`, which links the test to the journey for coverage audits. |

The shell gets no unit tests. If it seems to need one, the core is leaking into it.

## Common questions

**It asked me to pick a seam and I had no idea which.**

Ask it for the trade-offs first: what each seam catches and misses, and how slow it is. The placement table above is the default answer most of the time.

**It wrote the implementation before the test.**

It happens; no instruction gets perfect compliance. The loop is still worth running. If strict red-first matters for a slice, watch the run.

**Should it write the e2e test first?**

Usually not. Browser tests are slow enough that the red-green loop stops paying. Build the behaviour at the core and slice seams, then add the journey test.

**Why tag e2e tests with journey ids?**

So [test-audit](../audits/test-audit.md) can check coverage by set difference: every core journey must have a spec carrying its tag.

## It's working if

- It names the seams and waits before any test file exists.
- One test goes red, gets just enough code, then the next test appears.
- Core tests need no mocks; integration tests use the local stand-in; e2e titles carry `[journey:<id>]`.
- Renaming an internal function breaks nothing in the suite.

## Where it fits

`tdd` runs inside the build step: [to-spec](to-spec.md) agrees the seams, [implement](implement.md) drives `tdd` per ticket, and [review-changes](review-changes.md) checks the result. It also stands alone whenever there's a concrete behaviour to build. For the whole map, see [which-skill](../productivity/which-skill.md).
