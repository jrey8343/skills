---
name: worktree
description: "Git worktrees for parallel work: start each piece of work in its own worktree, finish it as a pushed branch with a PR, and sweep away worktrees whose work has merged. Use when starting implementation, when the user mentions worktrees, or asks to clean up old ones."
---

# Worktree

Each piece of work gets its own **worktree** on its own branch, so parallel sessions never share a checkout. A worktree lives until its work is **merged**, then the **sweep** removes it. Merged is something git or the forge proves; a closed issue proves nothing, because issues close with work unmerged.

## 1. Sweep

Before starting new work, run the sweep (the script is in the `scripts/` folder beside this SKILL.md):

```sh
node ${CLAUDE_SKILL_DIR}/scripts/prune-worktrees.mjs --apply
```

It removes a worktree and its local branch only when the worktree is clean and the branch is merged: the tip is in the default branch, or a merged PR's head equals the tip. Everything else is kept with a reason: the main and current worktrees, locked ones (Claude Code locks a worktree while its session runs), fresh branches with no commits, and anything with uncommitted or untracked changes. Relay what it removed, and any warning, in a line or two.

When the user asks to clean up worktrees, run it without `--apply`, show the report, then run it with `--apply`. Other flags: `--into <branch>` sweeps branches merged into another branch (an integration branch), `--forge none` skips the PR lookup, `--no-fetch` works offline.

## 2. Start

Take the first that applies:

1. **Already in a linked worktree** (`git rev-parse --git-dir` differs from `git rev-parse --git-common-dir`): work here. This is a `claude -w` session, or a sub-agent with worktree isolation.
2. **The user asked to work in the current checkout**: work here, on the current branch.
3. **The harness has a worktree tool**: use it. In Claude Code, call `EnterWorktree` with the name `<issue>-<slug>` (`42-export-csv`); it creates `.claude/worktrees/<name>` on branch `worktree-<name>`, from the default branch.
4. **Otherwise**: `git fetch origin`, then `git worktree add -b <issue>-<slug> ../<repo>-worktrees/<issue>-<slug> origin/<default>`, and do all the work from that path.

Name it after the ticket, so the worktree, the branch and the PR all lead back to it. With no ticket, use a short slug of the work.

## 3. Prepare

A new worktree holds tracked files only.

- Install dependencies with the package manager `docs/agents/stack.md` names.
- Gitignored local files (`.env`, `.dev.vars`) come over through `.worktreeinclude` at the repo root, in gitignore syntax. Claude Code copies the matching files itself; with any other harness, copy them from the main worktree. If the work needs a local file the worktree lacks and the repo has no `.worktreeinclude`, offer to add one.

## 4. Finish

Once the calling skill's work is committed on the worktree's branch:

1. Push it: `git push -u origin HEAD`.
2. Open a PR (an MR on GitLab) as `docs/agents/issue-tracker.md` describes. Call the Skill tool with "pr" for the body, and put a closing keyword for the ticket in it (`Fixes #42`). Report the PR's URL.
3. Leave the worktree in place: review fixes land here, and the sweep removes it once the PR merges.

With the local-markdown tracker, or no remote, stop at the commit and report the branch.
