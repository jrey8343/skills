---
name: implement-spec
description: "Implement the result of /to-spec and /to-tickets in code."
disable-model-invocation: true
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

The issue tracker should have been provided to you. If not, tell the user to run `/setup-standards`.

The goal is the entire spec implemented on a single **integration branch**, with every ticket resolved the way the issue tracker closes work.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for maximum concurrency.

## Steps

1. Read the spec and tickets to understand the task graph.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

3. Create the integration branch. If the issue tracker closes work through PRs, or the user asks for one, open a draft PR after the first merge in step 5 (a branch with no commits ahead of main can't open one), marked as closing the spec and tickets.

4. Use **implementer subagents** to implement each ticket, each in its own worktree on its own branch. Each implementer subagent:
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - calls the Skill tool with `house-style`, then with `tdd`, to build the ticket;
   - meets the **definition of done** below for its ticket;
   - merges the integration branch tip into its own branch before reporting done

5. Once an **implementer subagent** completes, merge its work to the integration branch with a **merger subagent**.

6. If this changes the **frontier** of available tickets, kick off more **implementer subagents** to work on the new tickets. This allows for maximum concurrency.

7. Once all tickets are complete, call the Skill tool with `review-changes` on the integration branch. Fix all issues raised by the review in a single **implementer subagent**, and check the definition of done across the whole spec (a user doc or feature doc may span several tickets).

8. If a draft PR exists, mark it ready for review. Otherwise, resolve each ticket the way the issue tracker closes work, and report the integration branch.

9. Clean up all **implementer subagent** worktrees.

## Definition of done

Each ticket, and the spec as a whole, is done when every line holds, or the report says why one doesn't apply:

- **Tests** pass at the agreed seams, and the full suite is green on the integration branch.
- **Journeys**: journey links are current for every journey the work adds or changes (call the Skill tool with `product-modeling`).
- **Feature docs**: affected `docs/features/` pages describe the new behaviour, with `verified-at` bumped (call the Skill tool with `project-docs`).
- **User docs**: user-visible changes are reflected where `docs/agents/docs-targets.md` says user docs live, usually as a PR in another repo referencing the spec. If that repo isn't reachable, publish the gap to the issue tracker.
- **ADRs**: hard-to-reverse decisions made along the way are offered as ADRs (call the Skill tool with `domain-modeling` for the criteria and format).
