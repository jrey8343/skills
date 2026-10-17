# implement-spec

## What it does

`implement-spec` takes a spec and its tickets and lands the whole thing in one run. The orchestrating agent hands each ticket to an implementer sub-agent in its own git worktree, merges each finished branch into one **integration branch**, runs [review-changes](review-changes.md) over the result, checks the definition of done across the whole spec, and resolves the tickets.

It reads the tickets as a **task graph**, not a list. Blocking edges decide what can start, so at any moment there is a **frontier** of unblocked tickets, and every ticket on the frontier runs at once. Each implementer works in the house style, builds test-first, and meets the same definition of done as [implement](implement.md): tests, journey links, feature docs, user docs, ADRs.

## When to reach for it

You invoke this by typing `/implement-spec`; the agent won't reach for it on its own.

| Your situation | Reach for |
| --- | --- |
| A spec split into tickets with blocking edges, landed in one run | `/implement-spec` |
| One ticket at a time, in your own session | [implement](implement.md) |
| A spec not split into tickets yet | [to-tickets](to-tickets.md) first |
| A small piece of work with no real graph | [implement](implement.md) |

## Prerequisites

- An issue tracker configured by [setup-standards](../setup/setup-standards.md).
- Tickets with blocking edges, as [to-tickets](to-tickets.md) writes them.
- A harness that runs sub-agents in the background with git worktrees; without that it's just a slower `implement`.

## The integration branch

Each implementer confirms its worktree is based on the integration branch, builds its ticket with [house-style](house-style.md) and [tdd](tdd.md), and merges the integration tip into its own branch before reporting done, so landing it is a fast-forward. A draft PR opens only if the tracker closes work through PRs or you ask for one.

Docs work often spans tickets (one feature doc, one help page, several tickets). The final pass checks the definition of done across the whole spec, not just per ticket.

## Common questions

**How is this different from running `/implement` per ticket?**

With `implement` you dispatch: one session per ticket, tracking what's unblocked yourself. `implement-spec` hands that to one orchestrating session, at the cost of reviewing the integration branch at the end instead of each ticket as it lands.

**The review-and-fix loop ran for hours.**

Review only makes sense once every ticket has landed; mid-run, unbuilt tickets read as failures. If a second broad review starts after the fix pass, tell it to run focused checks on the fixed findings and stop.

**Two parallel implementers collided on the same file.**

Worktrees postpone collisions to merge time. When two frontier tickets touch one shared file, add a blocking edge between them, or fix the shared names in the exploration notes.

**Blocked tickets never start after their blocker merged.**

GitHub's blocked-by count only drops when the blocker closes, usually at the end of the run. Tell the orchestrator to compute the frontier from what has merged into the integration branch.

## It's working if

- Several implementers run at once whenever the graph allows.
- Every ticket's trace shows `tdd` running, with a failing test before the code.
- Merges into the integration branch are fast-forwards.
- The run ends on one branch with every ticket resolved and the feature and user docs updated.

## Where it fits

The build step of the main chain, as the parallel alternative to [implement](implement.md): [to-spec](to-spec.md) → [to-tickets](to-tickets.md) → `implement-spec`. Its neighbours are [to-tickets](to-tickets.md) (the task graph) and [review-changes](review-changes.md) (the closing review). For the whole map, see [which-skill](../productivity/which-skill.md).
