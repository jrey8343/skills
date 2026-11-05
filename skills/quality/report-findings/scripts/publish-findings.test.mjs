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
  labelsFor,
  guardedGh,
  notConfiguredReport,
  parseArgs,
  stateLabelsDefault,
  mechanicalLabel,
  titleCharsMax,
  bodyBytesMax,
  reportPath,
  existingIssuesMax,
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
  locator: "src/lib/digest.ts#sendDigest",
  evidence: "for (const member of members) { ... }",
  recommendation: "Bound the loop with memberCountMax and page through.",
  fix: "judgement",
  source: "internal",
  ...overrides,
});
const report = (findings, overrides = {}) => ({ audit: "perf-audit", sha, scope: "incremental", summary: "Checked loops.", findings, ...overrides });
const options = { newIssuesMax: 5, severityMin: "low", stateLabels: [...stateLabelsDefault] };

function sandbox(issues = [], labels = []) {
  const dir = mkdtempSync(join(tmpdir(), "publish-findings-"));
  const statePath = join(dir, "state.json");
  writeFileSync(statePath, JSON.stringify({ issues, labels, calls: [] }));
  const exec = (args) => execFileSync("node", [script, ...args], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PUBLISH_FINDINGS_GH: fakeGh, FAKE_GH_STATE: statePath },
  });
  const run = (reportValue, extraArgs = []) => {
    const reportPath = join(dir, "findings.json");
    writeFileSync(reportPath, JSON.stringify(reportValue));
    const stdout = exec([reportPath, ...extraArgs]);
    return { summary: JSON.parse(stdout), state: JSON.parse(readFileSync(statePath, "utf8")) };
  };
  const lastSha = (audit) => exec(["last-sha", audit]).trim();
  return { run, lastSha };
}

const existingIssue = (number, fp, state, stateReason, labels = ["audit:perf-audit", "severity:high"]) => ({
  number,
  title: `existing ${number}`,
  body: `body\n<sub>fp: ${fp}</sub>`,
  labels,
  state,
  stateReason,
});

/** Every label a gh call would apply: --label and --add-label values, and label create names. */
function appliedLabels(calls) {
  return calls.flatMap((args) => {
    const applied = args.filter((_, index) => ["--label", "--add-label"].includes(args[index - 1]));
    if (args[0] === "label" && args[1] === "create") applied.push(args[2]);
    return applied;
  });
}

test("fingerprint ignores locator case and whitespace, and is stable", () => {
  const a = fingerprintOf(finding({ locator: "Src/lib/digest.ts#sendDigest" }));
  const b = fingerprintOf(finding({ locator: "  src/lib/digest.ts#senddigest " }));
  assert.equal(a, b);
  assert.match(a, /^perf-audit-[0-9a-f]{12}$/);
});

test("explicit fingerprints (natural external ids) pass through", () => {
  assert.equal(fingerprintOf(finding({ fingerprint: "errors:web/EVT-1A2" })), "errors:web/EVT-1A2");
});

test("mentions are neutralised so untrusted text cannot ping or trigger bots", () => {
  const out = neutraliseMentions("cc @claude and @octocat, email me@x.com");
  assert.ok(out.includes("@​claude"));
  assert.ok(out.includes("@​octocat"));
  assert.ok(!/@claude/.test(out));
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

test("validation requires a bounded summary, as the schema does", () => {
  const { summary: _omitted, ...withoutSummary } = report([finding()]);
  assert.ok(validateReport(withoutSummary).some((p) => p.includes("summary is required")));
  assert.ok(validateReport(report([finding()], { summary: "x".repeat(2001) })).some((p) => p.includes("summary")));
  assert.deepEqual(validateReport(report([finding()])), []);
});

test("labels: audit fingerprint label, fix: mechanical for internal mechanical findings, no state label", () => {
  const mechanical = labelsFor(finding({ fix: "mechanical" }), options);
  assert.deepEqual(mechanical, ["audit:perf-audit", "severity:high", mechanicalLabel]);
  assert.equal(mechanicalLabel, "fix: mechanical");
  assert.ok(!labelsFor(finding(), options).includes(mechanicalLabel));
  const external = labelsFor(finding({ fix: "mechanical", source: "external", labels: ["source:feedback"] }), options);
  assert.ok(!external.includes(mechanicalLabel), "external findings are never marked mechanical");
  for (const labels of [mechanical, external]) {
    assert.ok(!labels.some((label) => stateLabelsDefault.includes(label)));
  }
});

test("there is no triage-label option: state labels cannot be requested", () => {
  assert.throws(() => parseArgs(["f.json", "--triage-label", "ready-for-agent"]), /unknown argument/);
  assert.ok(parseArgs(["f.json", "--state-label", "bug:triage"]).stateLabels.includes("bug:triage"));
});

test("the gh guard refuses PRs and state labels", () => {
  const calls = [];
  const gh = guardedGh((args) => calls.push(args), stateLabelsDefault);
  for (const verb of ["create", "merge", "list"]) {
    assert.throws(() => gh(["pr", verb, "--title", "fix"]), /never runs gh pr/);
  }
  assert.throws(() => gh(["api", "repos/o/r/pulls"]), /never runs gh api/);
  assert.throws(() => gh(["issue", "create", "--label", "ready-for-agent"]), /state label/);
  assert.throws(() => gh(["issue", "edit", "1", "--add-label", "needs-triage"]), /state label/);
  assert.throws(() => gh(["label", "create", "ready-for-human"]), /state label/);
  assert.throws(() => gh(["issue", "edit", "1", "--add-label", "regression,Ready-For-Agent"]), /state label/);
  assert.throws(() => gh(["issue", "create", "--label=ready-for-agent"]), /state label/);
  assert.throws(() => gh(["issue", "edit", "1", "--add-label=regression,needs-info"]), /state label/);
  assert.throws(() => gh(["label", "create", "Needs-Triage"]), /state label/);
  assert.throws(() => gh(["issue", "create", "-l", "ready-for-agent"]), /state label/);
  assert.throws(() => gh(["issue", "edit", "1", "-l=regression,needs-triage"]), /state label/);
  gh(["issue", "edit", "1", "--remove-label", "ready-for-agent"]);
  assert.equal(calls.length, 1, "removing a state label is allowed; nothing refused reached gh");
});

test("not-configured: one audit-not-configured finding that validates and publishes", () => {
  const value = notConfiguredReport("security-audit", sha);
  assert.deepEqual(validateReport(value), []);
  assert.equal(value.findings.length, 1);
  assert.equal(value.findings[0].rule, "audit-not-configured");
  assert.equal(value.findings[0].locator, "docs/agents/audits.md");
  assert.equal(value.scope, "none", "the audit did not run");
  assert.equal(value.findings[0].fix, "judgement", "the fix is the user-invoked /schedule-audits");
  assert.match(value.findings[0].title, /^\[security-audit\] not run/);
  assert.match(value.findings[0].recommendation, /\/schedule-audits/);
  const stdout = execFileSync("node", [script, "not-configured", "security-audit", sha], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(stdout), value);
  const out = join(mkdtempSync(join(tmpdir(), "not-configured-")), "findings-security-audit.json");
  assert.equal(execFileSync("node", [script, "not-configured", "security-audit", sha, "--out", out], { encoding: "utf8" }), "");
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), value);
  const atHead = JSON.parse(execFileSync("node", [script, "not-configured", "security-audit"], { encoding: "utf8", cwd: here }));
  assert.match(atHead.sha, /^[0-9a-f]{40}$/, "the sha defaults to git HEAD");
  assert.throws(() => notConfiguredReport("Bad Name", sha), /usage/);
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
    { number: 4, state: "CLOSED", body: "<sub>audit-run: perf-audit sha: aaaaaaa</sub>", labels: ["audit-run"] },
    { number: 9, state: "OPEN", body: "<sub>audit-run: perf-audit sha: bbbbbbb</sub>", labels: ["audit-run"] },
    { number: 12, state: "OPEN", body: "<sub>audit-run: docs-audit sha: ccccccc</sub>", labels: ["audit-run"] },
    { number: 15, state: "OPEN", body: "<sub>audit-run: perf-audit sha: ddddddd</sub>", labels: [] },
  ];
  assert.equal(lastAuditedSha(runs, "perf-audit"), "bbbbbbb", "a marker without the audit-run label is not a run");
  assert.equal(lastAuditedSha([], "perf-audit"), "");
});

test("end to end: a not-configured run never counts as audited, so the next run is full", () => {
  const { run, lastSha } = sandbox();
  const { summary, state } = run(notConfiguredReport("test-audit", "abcdef1234567"));
  assert.equal(summary.created, 1);
  assert.ok(!state.issues.some((issue) => issue.labels.includes("fix: mechanical")));
  assert.equal(lastSha("test-audit"), "");
  const again = run(notConfiguredReport("test-audit", "bcdef12345678"));
  assert.equal(again.summary.created, 0, "the not-configured finding dedupes");
  assert.equal(lastSha("test-audit"), "");
});

test("end to end: the first configured run closes the audit-not-configured issue and records its sha", () => {
  const { run, lastSha } = sandbox();
  run(notConfiguredReport("perf-audit", "abcdef1234567"));
  const { summary, state } = run(report([finding()], { scope: "full" }));
  assert.equal(summary.resolved, 1);
  const notConfigured = state.issues.find((issue) => issue.title.includes("not run"));
  assert.equal(notConfigured.state, "CLOSED");
  assert.equal(notConfigured.stateReason, "COMPLETED");
  assert.equal(lastSha("perf-audit"), sha);
});

test("end to end: creates issues and tracking issue, closes previous run, reopens regression", () => {
  const fDone = finding({ rule: "done-rule" });
  const { run } = sandbox(
    [
      existingIssue(1, fingerprintOf(fDone), "CLOSED", "COMPLETED", ["audit:perf-audit", "severity:high", "ready-for-agent"]),
      { number: 2, title: "old run", body: "<sub>audit-run: perf-audit sha: 1111111</sub>", labels: ["audit:perf-audit", "audit-run"], state: "OPEN", stateReason: null },
    ],
    ["audit:perf-audit"],
  );
  const { summary, state } = run(report([finding(), fDone]));
  assert.equal(summary.created, 1);
  assert.equal(summary.reopened, 1);

  const created = state.issues.find((issue) => issue.number === 3);
  assert.deepEqual(created.labels, ["audit:perf-audit", "severity:high"]);
  assert.match(created.body, /<sub>fp: perf-audit-[0-9a-f]{12}<\/sub>/);

  const regression = state.issues.find((issue) => issue.number === 1);
  assert.equal(regression.state, "OPEN");
  assert.ok(regression.labels.includes("regression"));
  assert.ok(!regression.labels.includes("ready-for-agent"), "a regression goes back through Triage");

  const tracking = state.issues.find((issue) => issue.labels.includes("audit-run") && issue.state === "OPEN");
  assert.equal(tracking.number, 4);
  assert.match(tracking.body, /- \[ \] #3 /);
  assert.match(tracking.body, /- \[ \] #1 .*regression/);
  assert.equal(state.issues.find((issue) => issue.number === 2).state, "CLOSED");
  assert.ok(state.labels.includes("severity:high"));
});

test("end to end: no call opens a PR or applies a state label, across every operation", () => {
  const fDone = finding({ rule: "done-rule" });
  const fWorse = finding({ rule: "worse-rule", severity: "critical" });
  const fWontfix = finding({ rule: "wontfix-rule" });
  const { run } = sandbox([
    existingIssue(1, fingerprintOf(fDone), "CLOSED", "COMPLETED", ["audit:perf-audit", "severity:high", "ready-for-human"]),
    existingIssue(2, fingerprintOf(fWorse), "OPEN", null),
    existingIssue(3, fingerprintOf(fWontfix), "CLOSED", "NOT_PLANNED"),
    { number: 4, title: "old run", body: "<sub>audit-run: perf-audit sha: 1111111</sub>", labels: ["audit:perf-audit", "audit-run"], state: "OPEN", stateReason: null },
  ]);
  const mechanical = finding({ rule: "mechanical-rule", fix: "mechanical" });
  const external = finding({ rule: "external-rule", source: "external", labels: ["source:email"] });
  const { summary, state } = run(report([finding(), mechanical, external, fDone, fWorse, fWontfix]));
  assert.equal(summary.created, 3);
  assert.equal(summary.reopened, 1);
  assert.equal(summary.relabelled, 1);
  assert.equal(summary.suppressed, 1);

  assert.ok(state.calls.length > 0);
  assert.ok(state.calls.every(([noun]) => noun === "issue" || noun === "label"), "only gh issue and gh label are called");
  const applied = appliedLabels(state.calls);
  assert.ok(!applied.some((label) => stateLabelsDefault.includes(label)), `no state label applied: ${applied.join(", ")}`);
  for (const issue of state.issues.filter((each) => each.state === "OPEN")) {
    assert.ok(!issue.labels.some((label) => stateLabelsDefault.includes(label)), `#${issue.number} has no state label`);
  }
  const mechanicalIssue = state.issues.find((issue) => issue.body.includes(fingerprintOf(mechanical)));
  assert.ok(mechanicalIssue.labels.includes("fix: mechanical"));
  assert.equal(state.issues.find((issue) => issue.number === 3).state, "CLOSED", "closed as not planned stays closed");
});

test("end to end: closed as not planned suppresses the finding on every later run", () => {
  const { run } = sandbox();
  const first = run(report([finding()]));
  assert.equal(first.summary.created, 1);
  // Triage closes the filed issue as not planned; later runs start from that state.
  const filed = first.state.issues.find((issue) => !issue.labels.includes("audit-run"));
  const closed = { ...filed, state: "CLOSED", stateReason: "NOT_PLANNED" };
  const again = sandbox([closed]);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { summary, state } = again.run(report([finding()]));
    assert.equal(summary.created, 0);
    assert.equal(summary.suppressed, 1);
    assert.equal(state.issues.find((issue) => issue.number === closed.number).state, "CLOSED");
  }
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
  const many = Array.from({ length: existingIssuesMax }, (_, index) => existingIssue(index + 1, `fp-${index}`, "OPEN", null));
  const { run } = sandbox(many, ["audit:perf-audit"]);
  assert.throws(() => run(report([finding()])), /list limit/);
});

test("the publisher source has no PR path", () => {
  const source = readFileSync(script, "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/["']pr["']\s*,/.test(source), "no gh pr argv in the publisher");
  assert.ok(!/pulls/.test(source), "no pulls API in the publisher");
});

const targeted = (findings, overrides = {}) =>
  report(findings, { sha: "9e8d7c6b5a4f", scope: "targeted", target: "pr:#42", summary: "Targeted run on pr:#42.", ...overrides });
const sweepRun = (number, runSha, runState = "OPEN") => ({
  number,
  title: `run ${number}`,
  body: `<sub>audit-run: perf-audit sha: ${runSha}</sub>`,
  labels: ["audit:perf-audit", "audit-run"],
  state: runState,
  stateReason: null,
});

test("validation: a targeted report names its target, and only a targeted report has one", () => {
  assert.deepEqual(validateReport(targeted([finding()])), []);
  const { target: _omitted, ...withoutTarget } = targeted([finding()]);
  assert.ok(validateReport(withoutTarget).some((p) => p.includes("target")));
  assert.ok(validateReport(report([finding()], { target: "pr:#42" })).some((p) => p.includes("target")));
  assert.ok(validateReport(targeted([finding()], { target: "x".repeat(201) })).some((p) => p.includes("target")));
});

test("headless runs never publish a targeted report", () => {
  assert.equal(parseArgs(["f.json", "--headless"]).headless, true);
  assert.ok(validateReport(targeted([finding()]), { headless: true }).some((p) => p.includes("headless")));
  assert.deepEqual(validateReport(report([finding()]), { headless: true }), []);
  const { run } = sandbox();
  assert.throws(() => run(targeted([finding()]), ["--headless"]), /headless/);
});

test("end to end: last-sha ignores targeted runs", () => {
  const { run, lastSha } = sandbox([sweepRun(1, "1111111")]);
  run(targeted([finding()]));
  assert.equal(lastSha("perf-audit"), "1111111");
  const fresh = sandbox();
  fresh.run(targeted([finding()]));
  assert.equal(fresh.lastSha("perf-audit"), "", "with no sweep yet, the next headless run is still full");
});

test("end to end: a targeted run files and dedupes findings, but leaves the sweep's tracking issue open", () => {
  const { run } = sandbox([sweepRun(1, "1111111")]);
  const { summary, state } = run(targeted([finding()]));
  assert.equal(summary.created, 1);
  assert.equal(summary.tracking, null, "a targeted run opens no tracking issue");
  assert.equal(summary.target, "pr:#42");
  assert.equal(state.issues.find((issue) => issue.number === 1).state, "OPEN", "the previous sweep is not superseded");
  assert.ok(!state.calls.some(([noun, verb]) => noun === "issue" && verb === "close"));
  assert.ok(!state.labels.includes("audit-run"));

  const filed = state.issues.find((issue) => issue.number === 2);
  assert.deepEqual(filed.labels, ["audit:perf-audit", "severity:high"]);
  assert.match(filed.body, /targeted run on `pr:#42`/);

  const again = run(targeted([finding()]));
  assert.equal(again.summary.created, 0);
  assert.equal(again.summary.unchanged, 1);
});

test("end to end: a targeted run lists what it did not file, since no tracking issue holds the overflow", () => {
  const { run } = sandbox();
  const findings = ["critical", "low"].map((severity, index) => finding({ rule: `r${index}`, severity }));
  const { summary } = run(targeted(findings), ["--new-issues-max", "1"]);
  assert.equal(summary.created, 1);
  assert.deepEqual(summary.notFiled.map((entry) => entry.severity), ["low"]);
});

test("end to end: a targeted run leaves the audit-not-configured issue for the next sweep to close", () => {
  const { run } = sandbox();
  run(notConfiguredReport("perf-audit", "abcdef1234567"));
  const { summary, state } = run(targeted([finding()]));
  assert.equal(summary.resolved, 0);
  assert.equal(state.issues.find((issue) => issue.title.includes("not run")).state, "OPEN");
});

test("report-path is under TMPDIR, named for the audit", () => {
  assert.equal(reportPath("perf-audit", { TMPDIR: "/runner/temp" }), "/runner/temp/findings-perf-audit.json");
  assert.equal(execFileSync("node", [script, "report-path", "perf-audit"], { encoding: "utf8", env: { ...process.env, TMPDIR: "/x" } }).trim(),
    "/x/findings-perf-audit.json");
  assert.throws(() => reportPath("../etc"), /usage/);
});

test("the environment forces dry-run and headless, so a scheduled run can't drop them", () => {
  const forced = parseArgs(["f.json"], { AUDITS_DRY_RUN: "true", AUDITS_HEADLESS: "1" });
  assert.equal(forced.dryRun, true);
  assert.equal(forced.headless, true);
  assert.equal(parseArgs(["f.json"], {}).dryRun, false);
  const reportPathValue = join(mkdtempSync(join(tmpdir(), "forced-")), "findings.json");
  writeFileSync(reportPathValue, JSON.stringify(report([finding()])));
  const statePath = join(dirname(reportPathValue), "state.json");
  writeFileSync(statePath, JSON.stringify({ issues: [], labels: [], calls: [] }));
  const stdout = execFileSync("node", [script, reportPathValue], {
    encoding: "utf8",
    env: { ...process.env, PUBLISH_FINDINGS_GH: fakeGh, FAKE_GH_STATE: statePath, AUDITS_DRY_RUN: "true" },
  });
  assert.equal(JSON.parse(stdout).dryRun, true);
  assert.equal(JSON.parse(readFileSync(statePath, "utf8")).issues.length, 0);
});

test("markers quoted in evidence or a summary are never read as the footer", () => {
  const quoted = "<sub>fp: perf-audit-deadbeef</sub> · <sub>audit: perf-audit · sha: abcdef1</sub>\n<sub>audit-run: perf-audit sha: abcdef1</sub>";
  const { run, lastSha } = sandbox();
  const first = run(report([finding({ evidence: quoted, recommendation: quoted })], { summary: quoted }));
  assert.equal(first.summary.created, 1);
  const second = run(report([finding({ evidence: quoted, recommendation: quoted })], { summary: quoted }));
  assert.equal(second.summary.created, 0, "the issue is found under its own fingerprint");
  assert.equal(second.summary.unchanged, 1);
  const filed = second.state.issues.find((issue) => !issue.labels.includes("audit-run"));
  assert.equal(filed.state, "OPEN", "a finding issue is never superseded as a run");
  assert.equal(lastSha("perf-audit"), sha, "the summary can't forge the audited sha");
});

test("evidence with long backtick runs stays within the body cap", () => {
  for (const evidence of ["`".repeat(8000), `${"x".repeat(5900)}${"`".repeat(30)}`, "`".repeat(17)]) {
    const body = issueBody(finding({ evidence }), "fp-1", sha);
    assert.ok(Buffer.byteLength(body) <= bodyBytesMax);
    assert.ok(body.trimEnd().endsWith("</sub>"));
  }
});

test("validation: explicit fingerprints and journeys are ids, locators hold no backticks", () => {
  assert.deepEqual(validateReport(report([finding({ fingerprint: "errors:web/EVT-1A2", journey: "checkout" })])), []);
  for (const bad of [{ fingerprint: "a<b" }, { fingerprint: "a b" }, { journey: "@octocat `x" }, { locator: "src/a`b.ts" }]) {
    assert.ok(validateReport(report([finding(bad)])).length > 0, JSON.stringify(bad));
  }
});

test("end to end: a regression whose severity changed swaps its severity label", () => {
  const fDone = finding({ rule: "done-rule", severity: "critical" });
  const { run } = sandbox([existingIssue(1, fingerprintOf(fDone), "CLOSED", "COMPLETED", ["audit:perf-audit", "severity:low"])]);
  const { state } = run(report([fDone]));
  const reopened = state.issues.find((issue) => issue.number === 1);
  assert.ok(reopened.labels.includes("severity:critical"));
  assert.ok(!reopened.labels.includes("severity:low"));
  assert.ok(reopened.labels.includes("regression"));
});

test("closed tracking issues never count toward the finding list limit", () => {
  const runs = Array.from({ length: existingIssuesMax }, (_, index) => sweepRun(index + 1, "1111111", "CLOSED"));
  const { run } = sandbox(runs);
  const { summary } = run(report([finding()]));
  assert.equal(summary.created, 1);
});
