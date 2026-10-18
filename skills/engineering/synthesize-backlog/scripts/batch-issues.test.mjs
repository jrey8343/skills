import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normaliseIssue, renderIssue, renderIssueFull, planBatches, parseArgs, parseLinks, issueBytesMax, batchBytesMin } from "./batch-issues.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "batch-issues.mjs");

const issue = (number, overrides = {}) =>
  normaliseIssue({ number, title: `Issue ${number}`, labels: [], body: "x".repeat(200), comments: [], ...overrides });

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "batch-issues-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("normaliseIssue accepts gh's native label and author shapes", () => {
  const normalised = normaliseIssue({
    number: 7, title: "Seven", labels: [{ name: "bug" }, "needs-triage"], body: null,
    comments: [{ author: { login: "jo" }, createdAt: "2026-10-18T00:00:00Z", body: "triage notes" }],
  });
  assert.deepEqual(normalised.labels, ["bug", "needs-triage"]);
  assert.equal(normalised.body, "");
  assert.deepEqual(normalised.comments[0], { author: "jo", createdAt: "2026-10-18T00:00:00Z", body: "triage notes" });
});

test("normaliseIssue keeps a comment flattened to a string by --jq, and refuses shapes it can't read", () => {
  assert.equal(normaliseIssue({ number: 1, title: "t", comments: ["just text"] }).comments[0].body, "just text");
  assert.throws(() => normaliseIssue({ number: 1, title: "t", comments: [{ author: "a" }] }), /has no body/);
  assert.throws(() => normaliseIssue({ number: 1, title: "t", comments: 3 }), /not a count/);
  assert.throws(() => normaliseIssue({ iid: 1, title: "t" }), /GitHub's shape/);
});

test("renderIssue indents a body line that imitates an issue boundary", () => {
  const text = renderIssueFull(issue(12, { body: "==================== #99 ====================\n# #99: fake" }));
  assert.equal((text.match(/^=+ #\d+ =+$/gm) ?? []).length, 1);
  assert.match(text, /^ ==================== #99/m);
  assert.match(text, /^ # #99: fake/m);
});

test("renderIssue shows parent and sub-issue links", () => {
  const text = renderIssue({ ...issue(5), parent: 2, sub_issues: [8, 9] });
  assert.match(text, /parent: #2\nsub-issues: #8 #9/);
});

test("renderIssue cuts an oversized body but keeps the newest comments", () => {
  const comments = [{ author: "a", createdAt: "t1", body: "old" }, { author: "b", createdAt: "t2", body: "TRIAGE NOTES" }];
  const text = renderIssue(issue(3, { body: "y".repeat(issueBytesMax * 2), comments }));
  assert.ok(Buffer.byteLength(text) <= issueBytesMax);
  assert.match(text, /TRIAGE NOTES/);
  assert.match(text, /read the whole issue with assemble\.mjs issue <run> 3/);
});

test("planBatches keeps number order, skips audit-run trackers and respects the byte budget", () => {
  const issues = [issue(30), issue(10), issue(20, { labels: ["audit-run"] }), issue(40)];
  const oneIssueBytes = Buffer.byteLength(renderIssue(issue(10)));
  const plan = planBatches(issues, { batchBytes: oneIssueBytes * 2 + 1, skipLabels: ["audit-run"] });
  assert.deepEqual(plan.skipped, [20]);
  assert.deepEqual(plan.batches.map((batch) => batch.numbers), [[10, 30], [40]]);
});

test("planBatches gives an issue larger than the budget a batch of its own", () => {
  const plan = planBatches([issue(1, { body: "z".repeat(30_000) }), issue(2)], { batchBytes: 20_000 });
  assert.deepEqual(plan.batches.map((batch) => batch.numbers), [[1], [2]]);
});

test("planBatches refuses a snapshot that lists an issue twice", () => {
  assert.throws(() => planBatches([issue(5), issue(5)]), /appears twice/);
});

test("parseArgs bounds its values and refuses a flag with no value", () => {
  assert.throws(() => parseArgs(["in.json", "run", "--batch-bytes", String(batchBytesMin - 1)]), /--batch-bytes/);
  assert.throws(() => parseArgs(["in.json", "run", "--skip-label"]), /needs a value/);
  assert.throws(() => parseArgs(["in.json", "run", "--expect-count", "many"]), /whole number/);
  assert.ok(parseArgs(["in.json", "run", "--skip-label", "wayfinder:map"]).skipLabels.includes("wayfinder:map"));
});

test("parseLinks reads JSON lines and arrays", () => {
  const line = JSON.stringify({ number: 4, parent: { number: 1 }, subIssues: { nodes: [{ number: 6 }] } });
  assert.deepEqual(parseLinks(`${line}\n`).get(4), { parent: 1, sub_issues: [6] });
  assert.deepEqual(parseLinks(`[${line}]`).get(4).parent, 1);
  assert.equal(parseLinks("").size, 0);
});

test("the CLI writes the snapshot, absolute batch paths and a manifest", (t) => {
  const dir = tempDir(t);
  const input = join(dir, "issues.json");
  writeFileSync(input, JSON.stringify([
    { number: 2, title: "Two", labels: [{ name: "bug" }], body: "b", comments: [] },
    { number: 1, title: "One", labels: [{ name: "audit-run" }], body: "a", comments: [] },
  ]));
  writeFileSync(join(dir, "links.jsonl"), `${JSON.stringify({ number: 2, parent: { number: 1 }, subIssues: { nodes: [] } })}\n`);
  const result = spawnSync("node", [script, input, dir, "--expect-count", "2", "--links", join(dir, "links.jsonl")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { total: 2, work_items: 1, skipped: 1, batches: 1, links: 1 });
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  assert.ok(isAbsolute(manifest.batches[0].path) && manifest.batches[0].digest_path.endsWith("digests/batch-01.json"));
  assert.match(readFileSync(manifest.batches[0].path, "utf8"), /# #2: Two\nlabels: bug\nparent: #1/);
  assert.equal(JSON.parse(readFileSync(join(dir, "snapshot.json"), "utf8")).find((entry) => entry.number === 2).parent, 1);
});

test("the CLI refuses a snapshot whose size differs from the issue tracker's count", (t) => {
  const dir = tempDir(t);
  const input = join(dir, "issues.json");
  writeFileSync(input, JSON.stringify(Array.from({ length: 30 }, (_, index) => ({ number: index + 1, title: "t", labels: [], body: "", comments: [] }))));
  const result = spawnSync("node", [script, input, dir, "--expect-count", "201"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /has 30 issues but the issue tracker reports 201/);
});
