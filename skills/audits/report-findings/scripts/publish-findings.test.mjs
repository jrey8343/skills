import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  fingerprintOf,
  neutraliseMentions,
  fenced,
  truncateTitle,
  issueBody,
  validateReport,
  planOperations,
  lastAuditedSha,
  titleCharsMax,
  bodyBytesMax,
} from "./publish-findings.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "publish-findings.mjs");
const fakeGh = join(here, "fake-gh.mjs");
chmodSync(fakeGh, 0o755);

const sha = "3f9a2c1d0b7e";
const finding = (overrides = {}) => ({
  audit: "perf-audit",
  rule: "unbounded-loop",
  title: "Unbounded loop over workspace members",
  severity: "high",
  confidence: "high",
  locator: "worker/src/lib/digest.ts#sendDigest",
  evidence: "for (const member of members) { ... }",
  recommendation: "Bound the loop with memberCountMax and page through.",
  fix: "judgement",
  source: "internal",
  ...overrides,
});
const report = (findings, overrides = {}) => ({ audit: "perf-audit", sha, scope: "incremental", findings, ...overrides });
const options = { newIssuesMax: 5, severityMin: "low", triageLabel: "needs-triage" };

function sandbox(issues = [], labels = []) {
  const dir = mkdtempSync(join(tmpdir(), "publish-findings-"));
  const statePath = join(dir, "state.json");
  writeFileSync(statePath, JSON.stringify({ issues, labels, calls: [] }));
  const run = (reportValue, extraArgs = []) => {
    const reportPath = join(dir, "findings.json");
    writeFileSync(reportPath, JSON.stringify(reportValue));
    const stdout = execFileSync("node", [script, reportPath, ...extraArgs], {
      encoding: "utf8",
      env: { ...process.env, PUBLISH_FINDINGS_GH: fakeGh, FAKE_GH_STATE: statePath },
    });
    return { summary: JSON.parse(stdout), state: JSON.parse(readFileSync(statePath, "utf8")) };
  };
  return { run };
}

const existingIssue = (number, fp, state, stateReason, labels = ["audit:perf-audit", "severity:high"]) => ({
  number,
  title: `existing ${number}`,
  body: `body\n<sub>fp: ${fp}</sub>`,
  labels,
  state,
  stateReason,
});

test("fingerprint ignores locator case and whitespace, and is stable", () => {
  const a = fingerprintOf(finding({ locator: "Worker/src/lib/digest.ts#sendDigest" }));
  const b = fingerprintOf(finding({ locator: "  worker/src/lib/digest.ts#senddigest " }));
  assert.equal(a, b);
  assert.match(a, /^perf-audit-[0-9a-f]{12}$/);
});

test("explicit fingerprints (Sentry short ids) pass through", () => {
  assert.equal(fingerprintOf(finding({ fingerprint: "sentry:platform/PLATFORM-1A2" })), "sentry:platform/PLATFORM-1A2");
});

test("mentions are neutralised so untrusted text cannot ping or trigger bots", () => {
  const out = neutraliseMentions("cc @claude and @octocat, email me@x.com");
  assert.ok(!/@claude/.test(out.replace(/​/g, "X")) || out.includes("@​claude"));
  assert.ok(out.includes("@​claude"));
  assert.ok(out.includes("@​octocat"));
});

test("fences cannot be closed early by backticks in evidence", () => {
  const block = fenced("```\nbreakout\n```");
  const fence = block.split("text")[0];
  assert.ok(fence.length >= 4);
  assert.ok(block.endsWith(fence));
});

test("titles and bodies are capped", () => {
  assert.ok(truncateTitle("x".repeat(500)).length <= titleCharsMax);
  const body = issueBody(finding({ evidence: "y".repeat(50_000) }), "fp-1", sha);
  assert.ok(Buffer.byteLength(body) <= bodyBytesMax);
  assert.ok(body.includes("<sub>fp: fp-1</sub>"));
});

test("validation rejects line-number locators and unlabelled external findings", () => {
  const problems = validateReport(report([
    finding({ locator: "src/a.ts:42" }),
    finding({ source: "external" }),
  ]));
  assert.ok(problems.some((p) => p.includes("line number")));
  assert.ok(problems.some((p) => p.includes("source:* label")));
});

test("plan: new, unchanged, regression, suppressed, relabel", () => {
  const fNew = finding({ rule: "new-rule" });
  const fOpen = finding({ rule: "open-rule" });
  const fDone = finding({ rule: "done-rule" });
  const fWontfix = finding({ rule: "wontfix-rule" });
  const fWorse = finding({ rule: "worse-rule", severity: "critical" });
  const existing = [
    existingIssue(10, fingerprintOf(fOpen), "OPEN", null),
    existingIssue(11, fingerprintOf(fDone), "CLOSED", "COMPLETED"),
    existingIssue(12, fingerprintOf(fWontfix), "CLOSED", "NOT_PLANNED"),
    existingIssue(13, fingerprintOf(fWorse), "OPEN", null),
  ];
  const plan = planOperations(report([fNew, fOpen, fDone, fWontfix, fWorse]), existing, options);
  assert.deepEqual(plan.create.map((e) => e.finding.rule), ["new-rule"]);
  assert.deepEqual(plan.unchanged.map((e) => e.number), [10]);
  assert.deepEqual(plan.reopen.map((e) => e.number), [11]);
  assert.deepEqual(plan.suppressed.map((e) => e.number), [12]);
  assert.deepEqual(plan.relabel.map((e) => e.number), [13]);
});

test("plan: caps new issues, highest severity first, overflow kept", () => {
  const findings = ["low", "critical", "medium", "high"].map((severity, index) => finding({ rule: `r${index}`, severity }));
  const plan = planOperations(report(findings), [], { ...options, newIssuesMax: 2 });
  assert.deepEqual(plan.create.map((e) => e.finding.severity), ["critical", "high"]);
  assert.deepEqual(plan.overflow.map((e) => e.finding.severity), ["medium", "low"]);
});

test("plan: severity threshold and duplicate findings in one run", () => {
  const plan = planOperations(report([finding({ severity: "low", rule: "a" }), finding(), finding()]), [], {
    ...options,
    severityMin: "medium",
  });
  assert.equal(plan.belowThreshold, 1);
  assert.equal(plan.create.length, 1);
});

test("last audited sha comes from the newest run marker", () => {
  const runs = [
    { number: 4, state: "CLOSED", body: "<sub>audit-run: perf-audit sha: aaaaaaa</sub>" },
    { number: 9, state: "OPEN", body: "<sub>audit-run: perf-audit sha: bbbbbbb</sub>" },
    { number: 12, state: "OPEN", body: "<sub>audit-run: docs-audit sha: ccccccc</sub>" },
  ];
  assert.equal(lastAuditedSha(runs, "perf-audit"), "bbbbbbb");
  assert.equal(lastAuditedSha([], "perf-audit"), "");
});

test("end to end: creates issues and tracking issue, closes previous run, reopens regression", () => {
  const fDone = finding({ rule: "done-rule" });
  const { run } = sandbox(
    [
      existingIssue(1, fingerprintOf(fDone), "CLOSED", "COMPLETED"),
      { number: 2, title: "old run", body: "<sub>audit-run: perf-audit sha: 1111111</sub>", labels: ["audit:perf-audit", "audit-run"], state: "OPEN", stateReason: null },
    ],
    ["audit:perf-audit"],
  );
  const { summary, state } = run(report([finding(), fDone]));
  assert.equal(summary.created, 1);
  assert.equal(summary.reopened, 1);

  const created = state.issues.find((issue) => issue.number === 3);
  assert.ok(created.labels.includes("needs-triage"));
  assert.ok(created.labels.includes("severity:high"));
  assert.match(created.body, /<sub>fp: perf-audit-[0-9a-f]{12}<\/sub>/);

  const regression = state.issues.find((issue) => issue.number === 1);
  assert.equal(regression.state, "OPEN");
  assert.ok(regression.labels.includes("regression"));

  const tracking = state.issues.find((issue) => issue.labels.includes("audit-run") && issue.state === "OPEN");
  assert.equal(tracking.number, 4);
  assert.match(tracking.body, /- \[ \] #3 /);
  assert.match(tracking.body, /- \[ \] #1 .*regression/);
  assert.equal(state.issues.find((issue) => issue.number === 2).state, "CLOSED");
  assert.ok(state.labels.includes("severity:high"));
});

test("end to end: second identical run creates no duplicates", () => {
  const { run } = sandbox();
  run(report([finding()]));
  const { summary, state } = run(report([finding()]));
  assert.equal(summary.created, 0);
  assert.equal(summary.unchanged, 1);
  assert.equal(state.issues.filter((issue) => !issue.labels.includes("audit-run")).length, 1);
});

test("dry run writes nothing", () => {
  const { run } = sandbox();
  const { summary, state } = run(report([finding()]), ["--dry-run"]);
  assert.equal(summary.dryRun, true);
  assert.equal(state.issues.length, 0);
  assert.equal(state.labels.length, 0);
  const writes = state.calls.filter(([noun, verb]) => ["create", "edit", "close", "reopen", "comment"].includes(verb) || (noun === "label" && verb === "create"));
  assert.equal(writes.length, 0);
  assert.ok(summary.operations.some((op) => op.op === "create"));
});

test("refuses to dedupe against a truncated issue list", () => {
  const many = Array.from({ length: 1000 }, (_, index) => existingIssue(index + 1, `fp-${index}`, "OPEN", null));
  const { run } = sandbox(many, ["audit:perf-audit"]);
  assert.throws(() => run(report([finding()])), /list limit/);
});
