#!/usr/bin/env node
// Sweeps git worktrees whose work has merged, so parallel worktrees don't pile up.
// A worktree is removed only when it is clean and its work is provably merged:
// the branch tip is an ancestor of the target branch (merge commit or
// fast-forward), or a merged PR/MR's head equals the tip (squash or rebase).
// Kept, always: the main and current worktrees, locked or detached ones, fresh
// branches with no commits yet, and anything with uncommitted or untracked
// changes. Remote branches are never touched.
// Zero dependencies; needs Node 22+ and git. Uses `gh` or `glab` when present.
//
// Usage:
//   node prune-worktrees.mjs [--apply] [--into REF] [--no-fetch]
//        [--forge auto|github|gitlab|none]
//   Without --apply it prints the plan and changes nothing. --into defaults to
//   origin's default branch, then origin/main, origin/master, main, master.

import { realpathSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

export const worktreesMax = 100;
export const pullRequestsPerBranchMax = 20;
export const commandTimeoutMs = 30_000;
export const fetchTimeoutMs = 120_000;

const forges = ["auto", "github", "gitlab", "none"];

function valueAfter(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
  return value;
}

export function parseArgs(argv) {
  const options = { apply: false, into: null, fetch: true, forge: "auto" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--no-fetch") options.fetch = false;
    else if (arg === "--into") options.into = valueAfter(argv, ++index, arg);
    else if (arg === "--forge") options.forge = valueAfter(argv, ++index, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!forges.includes(options.forge)) throw new Error(`--forge must be one of ${forges.join(", ")}`);
  return options;
}

// Parses `git worktree list --porcelain`. The first entry is the main worktree.
export function parseWorktreeList(porcelain) {
  const worktrees = [];
  for (const block of porcelain.split(/\n\s*\n/)) {
    const lines = block.split("\n").filter((line) => line.length > 0);
    if (lines.length === 0) continue;
    const worktree = {
      path: null, head: null, branch: null, bare: false, detached: false,
      locked: false, lockReason: "", prunable: false,
    };
    for (const line of lines) {
      const space = line.indexOf(" ");
      const key = space === -1 ? line : line.slice(0, space);
      const value = space === -1 ? "" : line.slice(space + 1);
      if (key === "worktree") worktree.path = value;
      else if (key === "HEAD") worktree.head = value;
      else if (key === "branch") worktree.branch = value.replace(/^refs\/heads\//, "");
      else if (key === "bare") worktree.bare = true;
      else if (key === "detached") worktree.detached = true;
      else if (key === "prunable") worktree.prunable = true;
      else if (key === "locked") {
        worktree.locked = true;
        worktree.lockReason = value;
      }
    }
    assert.ok(worktree.path, "every porcelain block names its worktree");
    worktrees.push(worktree);
  }
  assert.ok(worktrees.length <= worktreesMax, `${worktrees.length} worktrees exceeds worktreesMax (${worktreesMax})`);
  return worktrees;
}

// A branch is fresh when its reflog shows it never moved from where it was made.
export function isFresh(reflog, head) {
  const entries = (reflog ?? "").split("\n").filter((line) => line.length > 0);
  return entries.length > 0 && entries.every((sha) => sha === head);
}

function mergeEvidence(worktree, facts) {
  if (facts.mergedByAncestry) return { proven: true, reason: `merged into ${facts.into}` };
  const merged = facts.pullRequests ?? [];
  const matching = merged.find((pullRequest) => pullRequest.headSha === worktree.head);
  if (matching) return { proven: true, reason: `PR #${matching.number} merged` };
  if (merged.length > 0) {
    return { proven: false, reason: `PR #${merged[0].number} merged, but the branch has moved since` };
  }
  return { proven: false, reason: null };
}

// Decides one worktree's fate from facts the shell gathered. Pure.
export function decide(worktree, facts) {
  const keep = (reason) => ({ worktree, action: "keep", reason });
  if (worktree.bare || facts.isMain) return keep("main worktree");
  if (worktree.prunable) return { worktree, action: "prune", reason: "directory is gone" };
  if (facts.isCurrent) return keep("current worktree");
  if (worktree.locked) return keep(worktree.lockReason ? `locked: ${worktree.lockReason}` : "locked");
  if (worktree.detached || !worktree.branch) return keep("detached HEAD");
  if (facts.fresh) return keep("no commits yet");

  const merged = mergeEvidence(worktree, facts);
  if (merged.proven && facts.dirty) return keep(`${merged.reason}, but has uncommitted or untracked changes`);
  if (merged.proven) return { worktree, action: "remove", reason: merged.reason };
  if (merged.reason) return keep(merged.reason);
  const age = `last commit ${facts.age}`;
  if (facts.dirty) return keep(`not merged, has uncommitted changes (${age})`);
  if (facts.upstreamGone) return keep(`upstream branch deleted, but merge not proven (${age})`);
  return keep(`not merged (${age})`);
}

const words = {
  applied: { remove: "removed", prune: "pruned", keep: "kept" },
  planned: { remove: "would remove", prune: "would prune", keep: "keep" },
};

export function formatReport(decisions, { apply, root, warnings = [] }) {
  const labels = apply ? words.applied : words.planned;
  const linked = decisions.filter((decision) => decision.worktree.path !== root);
  const lines = warnings.map((warning) => `warning: ${warning}`);
  for (const decision of linked) {
    const where = relative(root, decision.worktree.path) || ".";
    const branch = decision.worktree.branch ? ` (${decision.worktree.branch})` : "";
    lines.push(`${labels[decision.action].padEnd(12)} ${where}${branch}: ${decision.reason}`);
  }
  const count = (action) => linked.filter((decision) => decision.action === action).length;
  const removable = count("remove") + count("prune");
  if (linked.length === 0) lines.push("No linked worktrees.");
  else if (apply) lines.push(`Removed ${removable}, kept ${count("keep")}.`);
  else if (removable === 0) lines.push(`Nothing to remove; keeping ${count("keep")}.`);
  else lines.push(`Dry run: would remove ${removable}, keep ${count("keep")}. Re-run with --apply to remove.`);
  return lines.join("\n");
}

function run(binary, args, cwd, timeoutMs = commandTimeoutMs) {
  const result = spawnSync(binary, args, { cwd, encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) throw new Error(`${binary} ${args[0]}: ${result.error.message}`);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr.trim() };
}

function createGit(cwd) {
  const call = (args, timeoutMs) => run("git", args, cwd, timeoutMs);
  return {
    read(args, timeoutMs) {
      const result = call(args, timeoutMs);
      if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
      return result.stdout.trim();
    },
    tryRead(args) {
      const result = call(args);
      return result.status === 0 ? result.stdout.trim() : null;
    },
    test(args) {
      const result = call(args);
      if (result.status !== 0 && result.status !== 1) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
      return result.status === 0;
    },
  };
}

function resolveInto(git, requested, hasOrigin) {
  const isCommit = (ref) => git.test(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  if (requested !== null) {
    if (!isCommit(requested)) throw new Error(`--into ${requested} is not a branch or commit`);
    return requested;
  }
  const candidates = [];
  if (hasOrigin) {
    const originHead = git.tryRead(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
    if (originHead) candidates.push(originHead);
    candidates.push("origin/main", "origin/master");
  }
  candidates.push("main", "master");
  const found = candidates.find(isCommit);
  if (!found) throw new Error("cannot find the default branch; pass --into <ref>");
  return found;
}

const forgeCommands = {
  github: {
    binary: () => process.env.PRUNE_WORKTREES_GH ?? "gh",
    list: (branch) => [
      "pr", "list", "--head", branch, "--state", "merged",
      "--limit", String(pullRequestsPerBranchMax), "--json", "number,headRefOid,url",
    ],
    normalise: (item) => ({ number: item.number, headSha: item.headRefOid, url: item.url }),
  },
  gitlab: {
    binary: () => process.env.PRUNE_WORKTREES_GLAB ?? "glab",
    list: (branch) => [
      "mr", "list", "--merged", "--source-branch", branch,
      "--per-page", String(pullRequestsPerBranchMax), "-F", "json",
    ],
    normalise: (item) => ({ number: item.iid, headSha: item.sha, url: item.web_url }),
  },
};

function detectForge(git, requested) {
  if (requested !== "auto") return requested;
  const url = git.tryRead(["remote", "get-url", "origin"]) ?? "";
  if (/github\.com[:/]/.test(url)) return "github";
  if (/gitlab/.test(url)) return "gitlab";
  return "none";
}

// Returns branch => merged PRs (or null when the lookup failed), or null when
// there is no usable forge CLI. Failures become warnings, never removals.
function createForge(kind, cwd, warnings) {
  if (kind === "none") return null;
  const commands = forgeCommands[kind];
  const binary = commands.binary();
  const unavailable = `${binary} is unavailable, so squash and rebase merges can't be detected`;
  try {
    if (run(binary, ["auth", "status"], cwd).status !== 0) {
      warnings.push(`${binary} is not authenticated, so squash and rebase merges can't be detected`);
      return null;
    }
  } catch {
    warnings.push(unavailable);
    return null;
  }
  return (branch) => {
    const result = run(binary, commands.list(branch), cwd);
    if (result.status !== 0) {
      warnings.push(`${binary} could not list merged PRs for ${branch}: ${result.stderr}`);
      return null;
    }
    const items = JSON.parse(result.stdout);
    assert.ok(Array.isArray(items), `${binary} returns a JSON array`);
    assert.ok(items.length <= pullRequestsPerBranchMax, "PR list within its limit");
    return items.map(commands.normalise);
  };
}

function gatherFacts(context, worktree, isMain) {
  const facts = {
    isMain, isCurrent: false, dirty: false, fresh: false, mergedByAncestry: false,
    pullRequests: null, upstreamGone: false, age: "", into: context.into,
  };
  if (isMain || worktree.bare || worktree.prunable) return facts;
  facts.isCurrent = realpathSync(worktree.path) === context.currentRoot;
  if (facts.isCurrent || worktree.locked || worktree.detached || !worktree.branch) return facts;

  const { git } = context;
  const ref = `refs/heads/${worktree.branch}`;
  facts.dirty = git.read(["-C", worktree.path, "status", "--porcelain"]).length > 0;
  facts.fresh = isFresh(git.tryRead(["reflog", "show", "--format=%H", ref, "--"]), worktree.head);
  facts.mergedByAncestry = git.test(["merge-base", "--is-ancestor", worktree.head, context.into]);
  facts.upstreamGone = git.read(["for-each-ref", "--format=%(upstream:track)", ref]) === "[gone]";
  facts.age = git.read(["log", "-1", "--format=%cr", worktree.head]);
  const needsForge = !facts.mergedByAncestry && !facts.fresh && context.forge !== null;
  if (needsForge) facts.pullRequests = context.forge(worktree.branch);
  return facts;
}

function applyDecisions(git, decisions) {
  const outcomes = decisions.map((decision) => {
    if (decision.action !== "remove") return decision;
    try {
      git.read(["worktree", "remove", decision.worktree.path]);
    } catch (error) {
      return { ...decision, action: "keep", reason: `remove failed: ${error.message}` };
    }
    try {
      git.read(["branch", "-D", decision.worktree.branch]);
    } catch (error) {
      return { ...decision, reason: `${decision.reason}; branch kept: ${error.message}` };
    }
    return decision;
  });
  git.read(["worktree", "prune"]);
  return outcomes;
}

export function main(argv, cwd = process.cwd()) {
  const options = parseArgs(argv);
  const git = createGit(cwd);
  const warnings = [];
  const hasOrigin = git.tryRead(["remote", "get-url", "origin"]) !== null;
  if (options.fetch && hasOrigin) {
    try {
      git.read(["fetch", "--prune", "--quiet", "origin"], fetchTimeoutMs);
    } catch (error) {
      warnings.push(`fetch failed, so remote state may be stale: ${error.message}`);
    }
  }
  const into = resolveInto(git, options.into, hasOrigin);
  const forge = createForge(detectForge(git, options.forge), cwd, warnings);
  const worktrees = parseWorktreeList(git.read(["worktree", "list", "--porcelain"]));
  const context = { git, into, forge, currentRoot: realpathSync(git.read(["rev-parse", "--show-toplevel"])) };
  const decisions = worktrees.map((worktree, index) => decide(worktree, gatherFacts(context, worktree, index === 0)));
  const outcomes = options.apply ? applyDecisions(git, decisions) : decisions;
  console.log(formatReport(outcomes, { apply: options.apply, root: worktrees[0].path, warnings }));
  return 0;
}

const invokedDirectly = process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`prune-worktrees: ${error.message}`);
    process.exitCode = 1;
  }
}
