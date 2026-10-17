import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync, rmSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs, parseWorktreeList, isFresh, decide, formatReport, worktreesMax } from "./prune-worktrees.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "prune-worktrees.mjs");
const fakeForge = join(here, "fake-forge.mjs");
chmodSync(fakeForge, 0o755);

// Isolate git from the developer's config (signing, hooks, default branch name).
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function sandbox({ merged = [], authenticated = true } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "prune-worktrees-")));
  const repo = join(dir, "repo");
  const origin = join(dir, "origin.git");
  const git = (args, cwd = repo) => execFileSync("git", args, { cwd, env: gitEnv, encoding: "utf8" }).trim();
  const commit = (cwd, name) => {
    writeFileSync(join(cwd, `${name}.txt`), name);
    git(["add", "-A"], cwd);
    git(["commit", "--quiet", "-m", name], cwd);
    return git(["rev-parse", "HEAD"], cwd);
  };
  git(["init", "--quiet", "--bare", "-b", "main", origin], dir);
  git(["init", "--quiet", "-b", "main", repo], dir);
  commit(repo, "initial");
  git(["remote", "add", "origin", origin]);
  git(["push", "--quiet", "-u", "origin", "main"]);

  const statePath = join(dir, "forge.json");
  writeFileSync(statePath, JSON.stringify({ authenticated, merged, calls: [] }));
  const addWorktree = (name, base = "origin/main") => {
    const path = join(dir, "worktrees", name);
    git(["worktree", "add", "--quiet", "-b", name, path, base]);
    return path;
  };
  const mergeIntoMain = (branch, { squash = false } = {}) => {
    if (squash) {
      git(["merge", "--quiet", "--squash", branch]);
      git(["commit", "--quiet", "-m", `squash ${branch}`]);
    } else {
      git(["merge", "--quiet", "--no-ff", "-m", `merge ${branch}`, branch]);
    }
    git(["push", "--quiet", "origin", "main"]);
  };
  const branchExists = (name) => {
    try {
      git(["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]);
      return true;
    } catch {
      return false;
    }
  };
  const sweep = (args = [], cwd = repo) => execFileSync("node", [script, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...gitEnv, PRUNE_WORKTREES_GH: fakeForge, PRUNE_WORKTREES_GLAB: fakeForge, FAKE_FORGE_STATE: statePath },
  });
  const forgeCalls = () => JSON.parse(readFileSync(statePath, "utf8")).calls;
  const setMerged = (entries) => writeFileSync(statePath, JSON.stringify({ authenticated, merged: entries, calls: [] }));
  return { dir, repo, git, commit, addWorktree, mergeIntoMain, branchExists, sweep, forgeCalls, setMerged };
}

// ---- functional core ----

test("parseArgs defaults to a fetched dry run with forge auto-detection", () => {
  assert.deepEqual(parseArgs([]), { apply: false, into: null, fetch: true, forge: "auto" });
  assert.deepEqual(
    parseArgs(["--apply", "--into", "integration", "--no-fetch", "--forge", "gitlab"]),
    { apply: true, into: "integration", fetch: false, forge: "gitlab" },
  );
});

test("parseArgs rejects unknown flags, missing values and unknown forges", () => {
  assert.throws(() => parseArgs(["--force"]), /unknown argument/);
  assert.throws(() => parseArgs(["--into"]), /--into needs a value/);
  assert.throws(() => parseArgs(["--into", "--apply"]), /--into needs a value/);
  assert.throws(() => parseArgs(["--forge", "bitbucket"]), /--forge must be one of/);
});

test("parseWorktreeList reads branches, locks, detached and prunable entries", () => {
  const porcelain = [
    "worktree /repo", "HEAD a1", "branch refs/heads/main", "",
    "worktree /repo/.claude/worktrees/42-export", "HEAD b2", "branch refs/heads/worktree-42-export", "locked busy", "",
    "worktree /wt/bisect", "HEAD c3", "detached", "",
    "worktree /wt/gone", "HEAD d4", "branch refs/heads/gone", "locked", "prunable gitdir file points to non-existent location", "",
  ].join("\n");
  const [main, locked, detached, gone] = parseWorktreeList(porcelain);
  assert.equal(main.branch, "main");
  assert.equal(locked.branch, "worktree-42-export");
  assert.equal(locked.locked, true);
  assert.equal(locked.lockReason, "busy");
  assert.equal(detached.detached, true);
  assert.equal(detached.branch, null);
  assert.equal(gone.locked, true);
  assert.equal(gone.lockReason, "");
  assert.equal(gone.prunable, true);
});

test("parseWorktreeList refuses more worktrees than worktreesMax", () => {
  const blocks = Array.from({ length: worktreesMax + 1 }, (_, index) => `worktree /wt/${index}\nHEAD a\nbranch refs/heads/b${index}`);
  assert.throws(() => parseWorktreeList(blocks.join("\n\n")), /exceeds worktreesMax/);
});

test("isFresh is true only when the branch never moved from its creation point", () => {
  assert.equal(isFresh("a1\n", "a1"), true);
  assert.equal(isFresh("b2\na1\n", "b2"), false);
  assert.equal(isFresh("", "a1"), false);
  assert.equal(isFresh(null, "a1"), false);
});

const worktree = (overrides = {}) => ({
  path: "/wt/42-export", head: "b2", branch: "42-export", bare: false, detached: false,
  locked: false, lockReason: "", prunable: false, ...overrides,
});
const facts = (overrides = {}) => ({
  isMain: false, isCurrent: false, dirty: false, fresh: false, mergedByAncestry: false,
  pullRequests: null, upstreamGone: false, age: "2 days ago", into: "origin/main", ...overrides,
});
const merged = (sha) => [{ number: 57, headSha: sha, url: "https://example.test/pull/57" }];

test("decide removes only clean worktrees with proven merges", () => {
  const cases = [
    [worktree(), facts({ mergedByAncestry: true }), "remove", "merged into origin/main"],
    [worktree(), facts({ pullRequests: merged("b2") }), "remove", "PR #57 merged"],
    [worktree(), facts({ pullRequests: merged("ff") }), "keep", "PR #57 merged, but the branch has moved since"],
    [worktree(), facts({ mergedByAncestry: true, dirty: true }), "keep", "merged into origin/main, but has uncommitted or untracked changes"],
    [worktree(), facts({ isMain: true, mergedByAncestry: true }), "keep", "main worktree"],
    [worktree(), facts({ isCurrent: true, mergedByAncestry: true }), "keep", "current worktree"],
    [worktree({ locked: true, lockReason: "busy" }), facts({ mergedByAncestry: true }), "keep", "locked: busy"],
    [worktree({ detached: true, branch: null }), facts({ mergedByAncestry: true }), "keep", "detached HEAD"],
    [worktree(), facts({ fresh: true, mergedByAncestry: true }), "keep", "no commits yet"],
    [worktree(), facts({ upstreamGone: true }), "keep", "upstream branch deleted, but merge not proven (last commit 2 days ago)"],
    [worktree(), facts({ dirty: true }), "keep", "not merged, has uncommitted changes (last commit 2 days ago)"],
    [worktree(), facts(), "keep", "not merged (last commit 2 days ago)"],
    [worktree({ prunable: true }), facts(), "prune", "directory is gone"],
  ];
  for (const [tree, known, action, reason] of cases) {
    const decision = decide(tree, known);
    assert.equal(decision.action, action, reason);
    assert.equal(decision.reason, reason);
  }
});

test("formatReport omits the main worktree and words the plan by mode", () => {
  const decisions = [
    { worktree: worktree({ path: "/repo", branch: "main" }), action: "keep", reason: "main worktree" },
    { worktree: worktree({ path: "/repo/.claude/worktrees/42" }), action: "remove", reason: "PR #57 merged" },
    { worktree: worktree({ path: "/wt/43", branch: "43-import" }), action: "keep", reason: "not merged (last commit 1 hour ago)" },
  ];
  const planned = formatReport(decisions, { apply: false, root: "/repo", warnings: ["gh is not authenticated"] });
  assert.doesNotMatch(planned, /main worktree/);
  assert.match(planned, /^warning: gh is not authenticated$/m);
  assert.match(planned, /^would remove +\.claude\/worktrees\/42 \(42-export\): PR #57 merged$/m);
  assert.match(planned, /^keep +\.\.\/wt\/43 \(43-import\): not merged/m);
  assert.match(planned, /Dry run: would remove 1, keep 1\. Re-run with --apply/);
  const applied = formatReport(decisions, { apply: true, root: "/repo" });
  assert.match(applied, /^removed +\.claude\/worktrees\/42/m);
  assert.match(applied, /Removed 1, kept 1\.$/);
  assert.equal(formatReport(decisions.slice(0, 1), { apply: true, root: "/repo" }), "No linked worktrees.");
});

// ---- against real repositories ----

test("removes a worktree merged by a merge commit, and deletes its branch", () => {
  const box = sandbox();
  const path = box.addWorktree("42-export");
  box.commit(path, "export");
  box.mergeIntoMain("42-export");
  const report = box.sweep(["--apply"]);
  assert.match(report, /^removed +\.\.\/worktrees\/42-export \(42-export\): merged into origin\/main$/m);
  assert.equal(existsSync(path), false);
  assert.equal(box.branchExists("42-export"), false);
});

test("a dry run reports the plan and changes nothing", () => {
  const box = sandbox();
  const path = box.addWorktree("42-export");
  box.commit(path, "export");
  box.mergeIntoMain("42-export");
  const report = box.sweep();
  assert.match(report, /^would remove +\.\.\/worktrees\/42-export/m);
  assert.equal(existsSync(path), true);
  assert.equal(box.branchExists("42-export"), true);
});

test("keeps merged worktrees that are dirty, locked or current, and fresh or unmerged ones", () => {
  const box = sandbox();
  const dirty = box.addWorktree("dirty");
  box.commit(dirty, "dirty");
  box.mergeIntoMain("dirty");
  writeFileSync(join(dirty, "notes.txt"), "untracked work");
  const locked = box.addWorktree("locked");
  box.commit(locked, "locked");
  box.mergeIntoMain("locked");
  box.git(["worktree", "lock", "--reason", "agent running", locked]);
  const current = box.addWorktree("current");
  box.commit(current, "current");
  box.mergeIntoMain("current");
  box.addWorktree("fresh");
  const unmerged = box.addWorktree("unmerged");
  box.commit(unmerged, "unmerged");

  const report = box.sweep(["--apply"], current);
  assert.match(report, /^kept +\.\.\/worktrees\/dirty \(dirty\): merged into origin\/main, but has uncommitted or untracked changes$/m);
  assert.match(report, /^kept +\.\.\/worktrees\/locked \(locked\): locked: agent running$/m);
  assert.match(report, /^kept +\.\.\/worktrees\/current \(current\): current worktree$/m);
  assert.match(report, /^kept +\.\.\/worktrees\/fresh \(fresh\): no commits yet$/m);
  assert.match(report, /^kept +\.\.\/worktrees\/unmerged \(unmerged\): not merged \(last commit .+ ago\)$/m);
  assert.match(report, /^Removed 0, kept 5\.$/m);
  for (const name of ["dirty", "locked", "current", "fresh", "unmerged"]) assert.equal(box.branchExists(name), true, name);
});

test("detects a squash merge when the merged PR's head equals the branch tip", () => {
  const box = sandbox();
  const path = box.addWorktree("42-export");
  const tip = box.commit(path, "export");
  box.mergeIntoMain("42-export", { squash: true });
  box.setMerged([{ branch: "42-export", number: 57, sha: tip, url: "https://example.test/pull/57" }]);
  const report = box.sweep(["--apply", "--forge", "github"]);
  assert.match(report, /^removed +\.\.\/worktrees\/42-export \(42-export\): PR #57 merged$/m);
  assert.equal(box.branchExists("42-export"), false);
  assert.ok(box.forgeCalls().some((call) => call[0] === "pr" && call.includes("42-export")));
});

test("keeps a squash-merged branch that gained commits after the merge", () => {
  const box = sandbox();
  const path = box.addWorktree("42-export");
  const tip = box.commit(path, "export");
  box.mergeIntoMain("42-export", { squash: true });
  box.setMerged([{ branch: "42-export", number: 57, sha: tip, url: "https://example.test/pull/57" }]);
  box.commit(path, "follow-up");
  const report = box.sweep(["--apply", "--forge", "github"]);
  assert.match(report, /^kept +\.\.\/worktrees\/42-export \(42-export\): PR #57 merged, but the branch has moved since$/m);
  assert.equal(existsSync(path), true);
});

test("reads GitLab merge requests the same way", () => {
  const box = sandbox();
  const path = box.addWorktree("42-export");
  const tip = box.commit(path, "export");
  box.mergeIntoMain("42-export", { squash: true });
  box.setMerged([{ branch: "42-export", number: 9, sha: tip, url: "https://example.test/merge_requests/9" }]);
  const report = box.sweep(["--apply", "--forge", "gitlab"]);
  assert.match(report, /^removed +\.\.\/worktrees\/42-export \(42-export\): PR #9 merged$/m);
});

test("an unauthenticated forge warns and proves nothing", () => {
  const box = sandbox({ authenticated: false });
  const path = box.addWorktree("42-export");
  box.commit(path, "export");
  box.mergeIntoMain("42-export", { squash: true });
  const report = box.sweep(["--apply", "--forge", "github"]);
  assert.match(report, /^warning: .+ is not authenticated/m);
  assert.match(report, /^kept +\.\.\/worktrees\/42-export \(42-export\): not merged/m);
});

test("--into sweeps implementer branches merged into an integration branch", () => {
  const box = sandbox();
  box.git(["branch", "integration", "origin/main"]);
  const path = box.addWorktree("ticket-1", "integration");
  const tip = box.commit(path, "ticket-1");
  box.git(["branch", "-f", "integration", tip]);
  const unmerged = box.addWorktree("ticket-2", "integration");
  box.commit(unmerged, "ticket-2");
  const report = box.sweep(["--apply", "--into", "integration"]);
  assert.match(report, /^removed +\.\.\/worktrees\/ticket-1 \(ticket-1\): merged into integration$/m);
  assert.match(report, /^kept +\.\.\/worktrees\/ticket-2 \(ticket-2\): not merged/m);
});

test("prunes a worktree whose directory was deleted by hand", () => {
  const box = sandbox();
  const path = box.addWorktree("42-export");
  rmSync(path, { recursive: true, force: true });
  const report = box.sweep(["--apply"]);
  assert.match(report, /^pruned +\.\.\/worktrees\/42-export \(42-export\): directory is gone$/m);
  assert.doesNotMatch(box.git(["worktree", "list"]), /42-export/);
});
