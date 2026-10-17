# house-style

## What it does

The house coding style: functional core and imperative shell, vertical slices, and TigerStyle adapted to TypeScript (assertions and invariants, explicit limits on everything, functions of 70 lines or fewer with units-last names, minimal dependencies and napkin math).

It brings no new vocabulary. Every idea is expressed in codebase-design's terms: the functional core is a deep module with nothing behind its seam, the shell is the thin adapters at the seam, a vertical slice is a tier-spanning module whose payoff is locality. Every rule is tagged **hard** (a violation) or **judgement** (a heuristic), so reviews report them honestly.

## When to reach for it

Type `/house-style`, or the agent reaches for it automatically when writing, reviewing or restructuring code. tdd, implement, review-changes and improve-codebase-architecture all pull it in. A repo's `CODING_STANDARDS.md` (rendered from this skill by [setup-standards](../setup/setup-standards.md)) overrides it.

## The shape of good code here

- **The core decides; the shell does.** Pure functions take data (including `now`) and return a decision. Handlers gather inputs, call the core once, and perform the effects.
- **One capability, one folder.** Core, shell, UI and tests together behind an `index.ts` interface, named with a glossary term.
- **Everything has a limit.** Loops, retries, pages, payloads, fan-out and timeouts get named `*Max` bounds.
- **Assertions are part of the interface.** Invariants are checked in code, paired across write and read, and the negative space is asserted with `satisfies never`.
- **Legacy code moves when it's touched.** No big-bang rewrites.

## It's working if

- Business rules are tested without a database or a mock in sight.
- A feature change touches one folder.
- Limits show up as named constants, not magic numbers or nothing at all.

## Where it fits

The vocabulary layer under the build and review skills, beside [codebase-design](codebase-design.md). See [which-skill](../productivity/which-skill.md).
