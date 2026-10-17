---
name: house-style
description: "House coding style for TypeScript: functional core and imperative shell, vertical slices, and TigerStyle (assertions, explicit limits, short functions, napkin math). Use when writing, reviewing or restructuring code, when writing or updating CODING_STANDARDS.md, or when another skill needs the house rules."
---

# House Style

Where the seams go, and how the code behind them is written. Call the Skill tool with "codebase-design" first: its terms (**module**, **interface**, **implementation**, **depth**, **seam**, **adapter**, **leverage**, **locality**) are the only architecture nouns this skill uses. House style adds no competing vocabulary; it takes a stance.

A repo's own `CODING_STANDARDS.md` overrides anything here. Where the repo is silent, these rules apply.

## The stance, in codebase-design terms

| House idea | What it means in codebase-design terms |
|---|---|
| **Functional core** | A deep module whose interface is data in, decision out. No adapters behind it. Tested through its interface, exhaustively. |
| **Imperative shell** | The thin adapters at the seam: HTTP handlers, D1/KV/R2 repos, third-party clients. Gathers inputs, calls the core, performs the effects it returned. Integration-tested. |
| **Vertical slice** | A tier-spanning module for one domain capability, named with a `GLOSSARY.md` term. Its `index.ts` is the interface. The payoff is locality. |
| **Assertions and invariants** | Part of the interface (codebase-design already counts invariants and error modes). Stated in code, not only in prose. |
| **Explicit limits and napkin math** | The interface's performance characteristics, made explicit as named bounds. |
| **Functions of 70 lines or less** | A rule for the implementation only. Small helpers are internal seams, never separately tested units. |

## Rules

Every rule carries a tag. **[hard]**: breaking it is a violation; cite the rule. **[judgement]**: a heuristic; name it as "possible …", never as a violation. Reviewers suppress anything tooling already enforces.

### Functional core, imperative shell

See [FCIS.md](FCIS.md) for a worked before/after.

- **[hard]** Decision logic lives in pure functions: no I/O, no clock, no randomness, no environment reads. Pass `now`, generated ids and config in as data.
- **[hard]** The shell gathers inputs, calls the core, then executes the effects the core decided. The shell does not branch on domain rules.
- **[judgement]** A shell function with more than two domain conditionals means the core is leaking into the shell.
- **[judgement]** The core returns a decision (a discriminated union) rather than throwing for expected outcomes. Throwing is for bugs.

### Vertical slices

See [SLICES.md](SLICES.md) for the layout and how to adopt it in a layered codebase.

- **[hard]** New capabilities land as a slice: core, shell, UI and tests for one capability, together, behind one interface.
- **[hard]** Code outside a slice imports only from that slice's interface.
- **[judgement]** Code moves into a shared kernel only once a second slice needs it.
- **[judgement]** One feature spread across `routes/`, `lib/` and `components/` (a **horizontal smear**) is a slice waiting to be born.
- **[hard]** No hand-kept mirrors: when two runtimes need the same logic, they import one pure module.

### TigerStyle, adapted to TypeScript

See [TIGERSTYLE.md](TIGERSTYLE.md) for the reasoning, examples and the napkin-math worksheet.

Safety:

- **[hard]** Assert preconditions, postconditions and invariants in the core with a tiny `assert(condition, message)` helper. An assertion failure is a bug and crashes the operation; expected failures are return values.
- **[judgement]** Average at least two assertions per core function. **Pair** them: check a property where data is written and again where it is read.
- **[hard]** Assert the negative space: exhaustive `switch` with `satisfies never` on every union.
- **[hard]** Every loop, retry, queue, batch, page size, payload, fan-out and timeout has a named upper bound. `fetch` gets `AbortSignal.timeout(…)`; validation schemas get `.max(…)`.
- **[hard]** Every error is handled. No empty `catch`, no floating promises.
- **[judgement]** No recursion on request paths. If it is unavoidable, bound its depth.

Shape:

- **[hard]** Functions are 70 lines or fewer.
- **[judgement]** Simple control flow: early returns, no nested ternaries, compound conditions split into named booleans, conditions stated positively.
- **[hard]** Names have no abbreviations, and put units and qualifiers last, most significant word first: `latencyMsMax`, `retryCountMax`, `pageSizeMax`. Follow the repo's casing.
- **[judgement]** Limits are named constants declared at the top of the module that owns them.

Performance:

- **[judgement]** Do napkin math before designing or optimising: network, then disk, then memory, then CPU. Estimate counts, bytes and round trips against the platform limits listed in `docs/agents/stack.md`.
- **[judgement]** Batch I/O. Bound round trips per request, and pin the bound with a test where the repo has budget tests.

Dependencies and debt:

- **[judgement]** Prefer the platform, or a few lines of code, to a new dependency. A new dependency gets a one-line justification in the PR body.
- **[hard]** No `TODO` without a linked issue. Do it right the first time, or file it.

## Applying it

- **Writing code.** Follow the hard rules. If one is impractical here, say so in the PR body and why.
- **Reviewing code.** Report hard-rule breaks as violations, quoting the rule. Report judgement calls as "possible horizontal smear", "possible leaking core" and so on.
- **Legacy code.** Never propose a big-bang rewrite. New work lands as slices; existing code moves into a slice, or gets its core extracted, when a change already touches it.
- **Writing `CODING_STANDARDS.md`.** Render [CODING-STANDARDS-TEMPLATE.md](CODING-STANDARDS-TEMPLATE.md), filling the repo specifics (slice root, assert helper path, test commands, platform limits) from `docs/agents/stack.md` and what you can see in the code. Keep it under 150 lines. It states the rules; this skill holds the why.
