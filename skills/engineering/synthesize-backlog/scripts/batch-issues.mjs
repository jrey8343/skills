#!/usr/bin/env node
// Splits a snapshot of open issues into size-balanced batches for the digest stage.
// Zero dependencies; needs Node 22+.
//
// Usage:
//   node batch-issues.mjs <issues.json> <run-dir> [--expect-count N] [--links <links.jsonl>]
//        [--batch-bytes N] [--skip-label NAME]...
//
// <issues.json> is what `gh issue list --json number,title,labels,body,comments` prints: an
// array of { number, title, labels, body, comments }, labels as strings or { name }, comments
// as { author, createdAt, body } with the author a string or { login }. --expect-count is the
// issue tracker's own open-issue count; a snapshot of any other size is refused. --links is the
// output of links.graphql (JSON lines or an array of { number, parent, subIssues }).
// Writes <run-dir>/snapshot.json, <run-dir>/batches/batch-NN.md and <run-dir>/manifest.json,
// all with absolute paths, then prints the manifest's counts.

import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

// About 2.5 bytes a token in issue prose, so 60 KB is about 24K tokens: one Read of a batch
// returns all of it, and a batch holds about 15 issues of 4 KB.
export const batchBytesDefault = 60_000;
export const batchBytesMin = 10_000;
export const batchBytesMax = 400_000;
export const issueBytesMax = 50_000;
export const commentBytesMax = 30_000;
export const issuesMax = 2_000;
export const batchesMax = 200;
export const skipLabelsDefault = ["audit-run"];

export function parseArgs(argv) {
  const options = { input: null, runDir: null, batchBytes: batchBytesDefault, skipLabels: [...skipLabelsDefault], expectCount: null, links: null };
  const value = (index, flag) => {
    const next = argv[index];
    if (next === undefined || next.startsWith("--")) throw new Error(`${flag} needs a value`);
    return next;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--batch-bytes") options.batchBytes = Number(value(++index, arg));
    else if (arg === "--skip-label") options.skipLabels.push(value(++index, arg));
    else if (arg === "--expect-count") options.expectCount = Number(value(++index, arg));
    else if (arg === "--links") options.links = value(++index, arg);
    else if (!arg.startsWith("--") && options.input === null) options.input = arg;
    else if (!arg.startsWith("--") && options.runDir === null) options.runDir = arg;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (options.input === null || options.runDir === null) throw new Error("usage: batch-issues.mjs <issues.json> <run-dir> [--expect-count N]");
  const bytesOk = Number.isInteger(options.batchBytes) && options.batchBytes >= batchBytesMin && options.batchBytes <= batchBytesMax;
  if (!bytesOk) throw new Error(`--batch-bytes must be an integer from ${batchBytesMin} to ${batchBytesMax}`);
  if (options.expectCount !== null && !(Number.isInteger(options.expectCount) && options.expectCount >= 0)) {
    throw new Error("--expect-count must be a whole number");
  }
  return options;
}

function normaliseComment(comment, number) {
  if (typeof comment === "string") return { author: "unknown", createdAt: "", body: comment };
  assert.ok(comment !== null && typeof comment === "object", `#${number}: each comment must be an object or a string`);
  assert.equal(typeof comment.body, "string", `#${number}: a comment has no body; list with --json comments and no --jq`);
  const author = typeof comment.author === "string" ? comment.author : (comment.author?.login ?? "unknown");
  return { author, createdAt: comment.createdAt ?? "", body: comment.body };
}

export function normaliseIssue(raw) {
  assert.ok(Number.isInteger(raw?.number) && raw.number > 0, "issue.number must be a positive integer (GitHub's shape; other trackers are not supported)");
  assert.equal(typeof raw.title, "string", `#${raw.number}: title must be a string`);
  const labels = (raw.labels ?? []).map((label) => (typeof label === "string" ? label : label?.name));
  assert.ok(labels.every((label) => typeof label === "string"), `#${raw.number}: labels must be strings or { name }`);
  assert.ok(Array.isArray(raw.comments ?? []), `#${raw.number}: comments must be an array (gh issue list --json comments), not a count`);
  const comments = (raw.comments ?? []).map((comment) => normaliseComment(comment, raw.number));
  return { number: raw.number, title: raw.title, labels, body: raw.body ?? "", comments, parent: null, sub_issues: [] };
}

// links.graphql's nodes, as JSON lines (gh --paginate --jq '...nodes[]') or one array.
export function parseLinks(text) {
  const trimmed = text.trim();
  if (trimmed === "") return new Map();
  const nodes = trimmed.startsWith("[") ? JSON.parse(trimmed) : trimmed.split("\n").map((line) => JSON.parse(line));
  const links = new Map();
  for (const node of nodes) {
    assert.ok(Number.isInteger(node?.number), "each link node needs an integer number");
    const subIssues = (node.subIssues?.nodes ?? []).map((child) => child.number);
    links.set(node.number, { parent: node.parent?.number ?? null, sub_issues: subIssues });
  }
  return links;
}

// A body line that imitates this file's issue boundary is indented, so no issue can open a fake
// one and pass its text off as another issue's.
const neutraliseBoundaries = (text) => text.replace(/^(=+ #\d+ =+|# #\d+:)/gm, " $1");

function renderHead(issue) {
  const lines = [`\n\n==================== #${issue.number} ====================`, `# #${issue.number}: ${issue.title}`];
  lines.push(`labels: ${issue.labels.join(", ") || "(none)"}`);
  if (issue.parent) lines.push(`parent: #${issue.parent}`);
  if (issue.sub_issues.length > 0) lines.push(`sub-issues: ${issue.sub_issues.map((n) => `#${n}`).join(" ")}`);
  return `${lines.join("\n")}\n`;
}

const renderComments = (comments) =>
  comments.map((comment) => `\n--- comment by ${comment.author} at ${comment.createdAt} ---\n${neutraliseBoundaries(comment.body)}`).join("\n");

export function renderIssueFull(issue) {
  return `${renderHead(issue)}\n${neutraliseBoundaries(issue.body)}\n${renderComments(issue.comments)}\n`;
}

const cut = (text, bytes) => Buffer.from(text).subarray(0, Math.max(0, bytes)).toString("utf8").replace(/�$/, "");

// One issue as a digest agent reads it in a batch. An oversized issue keeps its head, its newest
// comments (where triage notes live) and as much of its body as fits.
export function renderIssue(issue) {
  const full = renderIssueFull(issue);
  if (Buffer.byteLength(full) <= issueBytesMax) return full;
  const kept = [];
  let commentBytes = 0;
  for (const comment of [...issue.comments].reverse()) {
    const bytes = Buffer.byteLength(renderComments([comment]));
    if (commentBytes + bytes > commentBytesMax) break;
    kept.unshift(comment);
    commentBytes += bytes;
  }
  const note = `\n[truncated: read the whole issue with assemble.mjs issue <run> ${issue.number}]\n`;
  const bodyBytes = issueBytesMax - Buffer.byteLength(renderHead(issue)) - commentBytes - Buffer.byteLength(note) - 100;
  const dropped = issue.comments.length - kept.length;
  const droppedNote = dropped > 0 ? `\n[${dropped} older comments left out]\n` : "";
  return `${renderHead(issue)}\n${cut(neutraliseBoundaries(issue.body), bodyBytes)}${note}${droppedNote}${renderComments(kept)}\n`;
}

// Pure: which issues are skipped, and how the rest fall into batches, in number order.
export function planBatches(issues, { batchBytes = batchBytesDefault, skipLabels = skipLabelsDefault } = {}) {
  assert.ok(issues.length <= issuesMax, `at most ${issuesMax} issues per run`);
  const seen = new Set();
  const skipped = [];
  const batches = [];
  let current = { numbers: [], text: "" };
  for (const issue of [...issues].sort((a, b) => a.number - b.number)) {
    assert.ok(!seen.has(issue.number), `#${issue.number} appears twice in the snapshot`);
    seen.add(issue.number);
    if (issue.labels.some((label) => skipLabels.includes(label))) {
      skipped.push(issue.number);
      continue;
    }
    const text = renderIssue(issue);
    if (current.numbers.length > 0 && Buffer.byteLength(current.text) + Buffer.byteLength(text) > batchBytes) {
      batches.push(current);
      current = { numbers: [], text: "" };
    }
    current.numbers.push(issue.number);
    current.text += text;
  }
  if (current.numbers.length > 0) batches.push(current);
  assert.ok(batches.length <= batchesMax, `${batches.length} batches exceeds ${batchesMax}: raise --batch-bytes or narrow the area`);
  return { batches: batches.map((batch, index) => ({ batch: index + 1, ...batch })), skipped };
}

export const batchFileName = (batch) => `batch-${String(batch).padStart(2, "0")}.md`;

function main() {
  const options = parseArgs(process.argv.slice(2));
  const runDir = resolve(options.runDir);
  const raw = JSON.parse(readFileSync(resolve(options.input), "utf8"));
  assert.ok(Array.isArray(raw), "<issues.json> must be a JSON array");
  if (options.expectCount !== null && raw.length !== options.expectCount) {
    throw new Error(`the snapshot has ${raw.length} issues but the issue tracker reports ${options.expectCount}: raise --limit or paginate, and list with the same filter as the count`);
  }
  const links = options.links ? parseLinks(readFileSync(resolve(options.links), "utf8")) : new Map();
  const issues = raw.map((entry) => ({ ...normaliseIssue(entry), ...(links.get(entry.number) ?? {}) }));
  const plan = planBatches(issues, options);

  mkdirSync(join(runDir, "batches"), { recursive: true });
  writeFileSync(join(runDir, "snapshot.json"), `${JSON.stringify(issues, null, 1)}\n`);
  const manifestBatches = plan.batches.map(({ batch, numbers, text }) => {
    const path = join(runDir, "batches", batchFileName(batch));
    writeFileSync(path, text);
    const digestPath = join(runDir, "digests", batchFileName(batch).replace(/\.md$/, ".json"));
    return { batch, path, digest_path: digestPath, numbers, bytes: Buffer.byteLength(text) };
  });
  const workItems = manifestBatches.reduce((sum, batch) => sum + batch.numbers.length, 0);
  const manifest = { total: issues.length, work_items: workItems, skipped: plan.skipped, skip_labels: options.skipLabels, links: links.size > 0, batches: manifestBatches };
  writeFileSync(join(runDir, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(JSON.stringify({ total: manifest.total, work_items: workItems, skipped: plan.skipped.length, batches: manifestBatches.length, links: links.size }));
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(`batch-issues: ${error.message}`);
    process.exit(1);
  }
}
