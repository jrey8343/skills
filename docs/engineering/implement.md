# implement

## What it does

`implement` builds work that has already been decided. You point it at a ticket, a spec, or the plan you just agreed in the conversation, and it writes the code in the house style, drives [tdd](tdd.md) at the seams, typechecks as it goes, and runs [review-changes](review-changes.md) at the end. It works in its own worktree, so your main checkout and other sessions are untouched, and it ends by pushing the branch and opening a PR that closes the ticket.

It never reopens the plan, and it doesn't stop at green tests. Its **definition of done** includes the paperwork that usually rots: journey links updated, the feature doc refreshed with its `verified-at` bumped, the user doc changed when the change is user-visible (often a PR in the marketing repo), and an ADR offered when a hard-to-reverse decision was made.

## When to reach for it

You invoke this by typing `/implement`; the agent won't reach for it on its own, and no other skill can call it.

| The work is… | Reach for |
| --- | --- |
| A ticket on the tracker | `/implement #42`, one ticket per session |
| A spec not yet split, spanning sessions | [to-tickets](to-tickets.md) first, then `/implement` per ticket |
| A spec with many tickets you want landed in one run | [implement-spec](implement-spec.md) |
| A small plan that lives only in this conversation | `/implement` right there, and say the plan is in the thread |
| Not decided yet | [grill-with-docs](grill-with-docs.md) |
| Already built, and you want it checked | [review-changes](review-changes.md) |

## Prerequisites

It calls [worktree](worktree.md), which first sweeps away worktrees whose PRs have merged, then starts this work in a fresh worktree on a new branch. If you're already in a linked worktree, or you ask it to work in the current checkout, it works there instead. Ticket references resolve against the tracker [setup-standards](../setup/setup-standards.md) configured. The docs steps read `docs/agents/docs-targets.md` to find where feature and user docs live.

## Definition of done

A run is done when each line holds, or it has told you why one doesn't apply:

| Item | What it means |
| --- | --- |
| Tests | Green at the agreed seams, full suite green. |
| Journeys | Links current for any journey the work touched. |
| Feature doc | `docs/features/<feature>.md` describes the new behaviour; `verified-at` bumped. |
| User doc | Updated where the docs target says, usually a PR in the marketing repo. |
| ADR | Offered when the decision was hard to reverse, surprising, and a real trade-off. |

## Common questions

**It finished, but my ticket is still open.**

Expected. `implement` ends at an open PR whose body says `Fixes #<n>`, so the ticket closes when the PR merges. It doesn't tick acceptance criteria; reconcile those yourself. With the local-markdown tracker there is no PR: it stops at the commit, and you close the ticket.

**Can it stop at the commit instead of opening a PR?**

Say so when you invoke it ("commit, don't push"). Otherwise it pushes and opens the PR, with a body shaped by [pr](pr.md). The PR is also what lets the sweep remove the worktree later: once the PR merges, the next `/implement` or `/worktree` cleans it up.

**review-changes says it can't see my changes.**

It reviews `git diff <fixed-point>...HEAD`, which excludes uncommitted work. Commit first, then review. Reviewing in a fresh session also avoids the author-reviewing-itself bias.

**One ticket burned a huge number of tokens.**

The ticket is probably too big. Right-size tickets in [to-tickets](to-tickets.md) so each fits one fresh context window.

**Why does it touch the marketing repo?**

Because user docs live there, and a user-visible change without a doc update is how help pages go stale. If it can't reach that repo, it files the doc change as an issue instead.

## It's working if

- It opens by restating what it will build, rather than asking what to build.
- A `house-style` and a `tdd` Skill tool call appear in the trace.
- The run ends with a PR URL, with the feature doc and journey links updated in the same diff.
- Your main checkout's `git status` is untouched; the work happened in `.claude/worktrees/<issue>-<slug>`.
- User-visible changes come with a docs PR, or an issue saying why not.

## Where it fits

The build step of the main chain: [grill-with-docs](grill-with-docs.md) → [to-spec](to-spec.md) → [to-tickets](to-tickets.md) → `implement` → [review-changes](review-changes.md). Its neighbours are [worktree](worktree.md) (where the work happens), [tdd](tdd.md) (driven per seam), [project-docs](project-docs.md) and [product-modeling](product-modeling.md) (the done criteria). For the whole map, see [which-skill](../productivity/which-skill.md).
