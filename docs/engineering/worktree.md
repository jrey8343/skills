# worktree

## What it does

`worktree` keeps each piece of work in its own git worktree on its own branch, so several sessions can build in parallel without sharing a checkout. It also removes worktrees once their work has landed. It starts the worktree, prepares it (dependencies, local env files), finishes it as a pushed branch with an open PR, and **sweeps** away the worktrees whose PRs have merged.

The sweep removes only what it can prove has merged. A closing issue isn't proof, because issues close with their work unmerged. The proof has to come from git or the forge, and the worktree has to be clean, so nothing that isn't already in the default branch is ever deleted.

## When to reach for it

The agent reaches for it on its own: [implement](implement.md) calls it before writing code, and [implement-spec](implement-spec.md) calls it for the integration branch and for its closing cleanup. Type `/worktree` when you want a sweep on its own ("clean up my worktrees").

| Your situation | Reach for |
| --- | --- |
| Build a ticket without touching your main checkout | [implement](implement.md), which starts the worktree for you |
| Old worktrees piling up after PRs merged | `/worktree` |
| Run several tickets in parallel inside one session | [implement-spec](implement-spec.md) |
| A throwaway session in a worktree you'll discard on exit | Claude Code's own `claude -w` is enough |

Claude Code's built-in worktree cleanup only runs when the session that made the worktree exits, or on an age-based timer. `worktree` adds cleanup driven by the merge itself, which works for worktrees you kept open for review.

## Prerequisites

- Node 22+ and git.
- For squash or rebase merges, an authenticated `gh` (GitHub) or `glab` (GitLab). Without one, the sweep still catches merge commits and fast-forwards, and warns that squash merges can't be detected.
- An issue tracker configured by [setup-standards](../setup/setup-standards.md), so the finish step knows how to open the PR.
- Optional: a `.worktreeinclude` at the repo root listing gitignored files (`.env`, `.dev.vars`) to copy into each new worktree. Claude Code reads it natively.

In Claude Code, worktrees live in `.claude/worktrees/<issue>-<slug>`, on branch `worktree-<issue>-<slug>`. In other harnesses they go in `../<repo>-worktrees/`.

## What counts as merged

A worktree is removable when its branch's work is in the target branch (by default, origin's default branch). The sweep accepts two proofs:

| Proof | Catches |
| --- | --- |
| The branch tip is an ancestor of the target | Merge commits and fast-forwards, including local merges with no forge |
| A merged PR or MR for the branch has a head equal to the local tip | Squash and rebase merges |

The head has to match exactly. A commit added after the PR merged makes the branch differ from what landed, so that worktree is kept.

`--into <branch>` changes the target. [implement-spec](implement-spec.md) uses it to sweep implementer worktrees once they've merged into its integration branch.

## What it never deletes

- The main worktree, and the one the sweep runs from.
- Locked worktrees. Claude Code locks a worktree while its session is running, so a parallel session keeps its directory.
- Detached worktrees, such as one made for a bisect.
- Fresh branches that have no commits yet, for example a session that has just started.
- Anything with uncommitted or untracked changes, even if it is merged.
- Remote branches. Let your forge delete head branches on merge if you want that too.

A branch whose upstream has been deleted is reported, but not removed: a deleted remote branch doesn't prove a merge. Worktrees that aren't merged are listed with the age of their last commit, so abandoned work is easy to spot.

## Common questions

**Why not clean up when the issue closes?**

An issue closes for many reasons: not planned, a duplicate, closed by hand. Some of those leave unmerged commits in the worktree. When the work did land, the PR merge closes the issue through `Fixes #42` anyway, so waiting for the merge loses nothing.

**Claude Code asked whether to keep or remove the worktree when I exited.**

Keep it if the PR is still open, so review fixes can land in it. The next sweep removes it after the merge.

**A worktree shows as `locked: claude session … (pid …)` but no session is running.**

The session ended without releasing its lock. Once you've checked that nothing is using the worktree, run `git worktree unlock <path>`, and the next sweep handles it.

**I abandoned a branch. Will the sweep ever remove it?**

No, because unmerged work is never removed automatically. The report lists it as not merged, with its age. Remove it yourself with `git worktree remove <path>` and `git branch -D <branch>`.

## It's working if

- `/implement` starts by reporting the sweep, then works in `.claude/worktrees/<issue>-<slug>`, and your main checkout's `git status` stays untouched.
- Each run ends with a PR URL, not a bare commit.
- After a PR merges, the next sweep reports `removed … PR #<n> merged` (or `merged into origin/main`), and `git worktree list` gets shorter.
- Kept worktrees always come with a reason you recognise.

## Where it fits

A helper for the build step: [implement](implement.md) and [implement-spec](implement-spec.md) call it at the start and end of their work, and [pr](pr.md) shapes the body of the PR it opens. Run `/worktree` on its own whenever worktrees pile up. For the whole map, see [which-skill](../productivity/which-skill.md).
