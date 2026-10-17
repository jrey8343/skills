---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "worktree" before writing code. It sweeps away merged worktrees and starts this work in its own.

Call the Skill tool with "house-style" before writing code, and follow its rules (the repo's `CODING_STANDARDS.md` overrides them where it differs).

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, call the Skill tool with "review-changes" to review the work.

## Definition of done

The work is done when every line below holds, or you have told the user why one doesn't apply:

- **Tests** pass at the agreed seams, and the full suite is green.
- **Journeys**: if the work adds or changes how an avatar completes a journey, its links are current (call the Skill tool with "product-modeling").
- **Feature doc**: the affected `docs/features/` page describes the new behaviour and its `verified-at` is bumped (call the Skill tool with "project-docs").
- **User doc**: if the change is user-visible, the user doc is updated where `docs/agents/docs-targets.md` says it lives. That is often another repo: make the change on a branch there and open a PR referencing this work. If you can't reach that repo, say so and file it to the issue tracker instead.
- **ADR**: if the work settled a decision that is hard to reverse, surprising without context, and the result of a real trade-off, offer to record it (call the Skill tool with "domain-modeling" for the format).

Commit your work to the worktree's branch, then finish as the worktree skill describes: push, and open a PR that closes the ticket.
