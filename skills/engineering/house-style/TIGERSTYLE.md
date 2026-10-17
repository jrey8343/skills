# TigerStyle, adapted to TypeScript

TigerBeetle's [TIGER_STYLE](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md) puts safety first, performance second, developer experience third. It is written for Zig and a database; this is the subset that carries over to a TypeScript web stack, with static allocation left behind.

## Safety

### Assertions

Assertions detect programmer errors. An assertion that fires means the code is wrong, so the right response is to stop the operation and report it, never to recover silently.

```ts
// shared/assert.ts
export class AssertionError extends Error {
  override name = "AssertionError";
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AssertionError(message);
}
```

- Use `assert` for invariants. Use return values (discriminated unions) for expected failures such as "not found" or "already cancelled". Use schema validation at the edge for untrusted input.
- **Pair assertions.** Check a property on the way in and again on the way out, or where data is written and where it is read back. Bugs live in the gap between two places that each assumed the other checked.
- **Assert the negative space.** What must *not* happen is as important as what must. `satisfies never` in every `switch` default makes a new union member a compile error rather than a silent fall-through.
- **Assert relationships, not just values.** `assert(refundCents <= pricePaidCents, …)` says more than two separate range checks.
- Assertions stay on in production. An `AssertionError` reaching error tracking is a bug report with the invariant in the title.

### Limits

Everything has a limit. Unbounded things fail at the worst time, under load, with nothing in the logs to say why.

| Thing | Bound it with |
|---|---|
| Loops over external data | A named `*Max` and an assertion or early exit. |
| Retries | `retryCountMax` plus backoff with a cap. |
| `fetch` | `AbortSignal.timeout(timeoutMsMax)`. |
| Pagination | `pageSizeMax`; reject larger requests. |
| Request bodies and fields | Schema `.max()` on strings and arrays; a body-size check. |
| Fan-out (`Promise.all`) | A batch size, or a concurrency limit. |
| Queues and buffers | A length cap with an explicit overflow policy. |
| Recursion | Avoid on request paths; otherwise a depth bound. |

Name each limit once, at the top of the module that owns it. A test that pins the important ones (for example, D1 round trips per request) turns a performance characteristic into part of the interface.

### Errors

- Handle every error explicitly. An empty `catch` is a hidden bug.
- No floating promises. `await` it, return it, or hand it to `ctx.waitUntil` on Workers.
- An error at a seam is translated once, at the seam, into the caller's vocabulary.

## Shape

- **70 lines per function, at most.** It forces you to find the seams. Split along the shape of the problem, not arbitrarily: a function that does "parse, decide, persist" is three functions.
- **Simple control flow.** Early returns over nested `if`. No nested ternaries. Split compound conditions into named booleans (`const isWithinNotice = …`). State conditions positively.
- **Centralise control flow.** The parent function decides; leaf functions compute. Avoid helpers that both branch and perform effects.
- **Smallest scope.** Declare variables where they are used. Fewer variables in scope means fewer to misuse.

## Naming

- No abbreviations: `request` not `req` (framework conventions excepted), `index` not `idx`.
- **Units and qualifiers last**, most significant word first, so related names line up: `latencyMsMax`, `latencyMsMin`, `latencyMsP95`. Use the repo's casing convention; the order matters more than the case.
- Name things for what they are in the domain (`GLOSSARY.md`), not for how they are implemented.
- Callbacks and helpers are named for what they do, prefixed by what they belong to: `enrolmentValidate…`, not `validate2`.

## Performance: napkin math first

Before designing or optimising, sketch the numbers. Order of cost: network, then disk, then memory, then CPU.

```
Operation:            <what>
Per request:          <N> round trips × <latency ms> = <ms>
Rows read:            <count> × <bytes> = <bytes>
Fan-out:              <N> × <cost>
Platform limits:      <relevant limit from docs/agents/stack.md>, e.g. Workers CPU ms, D1 rows read, subrequest count
Headroom:             <limit ÷ estimate>
Verdict:              fine / batch it / cache it / redesign
```

If the estimate is within 10× of a platform limit, design for the limit now.

- Batch round trips (`db.batch`, multi-row inserts).
- Prefer one query that returns exactly what is needed over N queries that return too much.
- Measure before and after any optimisation. A change without a number is a guess.

## Dependencies

Each dependency is code you did not write, cannot fully review, and must keep updated. Prefer the platform (Web APIs, `node:` built-ins, the Workers runtime) and a few lines of your own. When a dependency is worth it (crypto, a protocol, a mature parser), say why in one line in the PR.

## Zero technical debt

Do it right the first time. Shortcuts are allowed only as filed issues: no `TODO` without a link, no "temporary" code without an issue that removes it.
