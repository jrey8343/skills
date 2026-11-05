#!/usr/bin/env node
// Publishes audit findings to GitHub issues: fingerprint dedupe, one tracking
// issue per run, labelled child issues, hard caps, mention neutralisation.
// Zero dependencies; needs Node 22+ and an authenticated `gh`.
//
// Usage:
//   node publish-findings.mjs <findings.json> [--dry-run] [--repo OWNER/NAME]
//        [--new-issues-max N] [--severity-min low|medium|high|critical]
//        [--state-label NAME]... [--headless]
//   node publish-findings.mjs last-sha <audit> [--repo OWNER/NAME]
//        Prints the SHA audited by the most recent run (empty if none), for
//        incremental scoping.
//   node publish-findings.mjs report-path <audit>
//        Prints the absolute path a headless run writes its report to:
//        $TMPDIR/findings-<audit>.json (the OS temp dir when TMPDIR is unset).
//   node publish-findings.mjs not-configured <audit> [<sha>] [--out <file>]
//        Builds the one-finding report a headless run emits when the target
//        repo has no docs/agents/audits.md, at <sha> (default: git HEAD), and
//        writes it to <file> (default: stdout). Its scope is "none": the audit
//        did not run, so last-sha never starts an incremental run from it.
//
// The environment can force the safe modes, so a scheduled run can't drop
// them: AUDITS_DRY_RUN=true forces --dry-run, AUDITS_HEADLESS=1 forces
// --headless. The rendered workflow sets both on the run step.
//
// A report with scope "targeted" (an interactive run on one target or area)
// files and dedupes its findings like any other, but opens no tracking issue:
// it never becomes the base of an incremental run, never supersedes the last
// sweep's tracking issue and never closes audit-not-configured. --headless
// refuses it, since a scheduled run is always a sweep.
//
// Deterministic by design: the model that reads untrusted text (error events,
// feedback, email) never holds write access; this script does the writing.
//
// Findings go through the repo's Triage: an issue gets its `audit:<name>`
// fingerprint label and never a state label, and nothing here opens a PR.
// Both are enforced at the one place `gh` is called (guardedGh).

import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

export const titleCharsMax = 120;
export const bodyBytesMax = 8 * 1024;
export const newIssuesMaxDefault = 5;
export const newIssuesMaxLimit = 50;
export const findingsMax = 200;
// Issues per list: open ones, and closed findings (closed tracking issues are
// left out). The closed list goes through GitHub search, which returns at most
// 1000 results, so this is also where a list could be silently truncated.
export const existingIssuesMax = 1000;
// Backtick runs longer than this are shortened in evidence, so the fence stays bounded.
export const backtickRunMax = 16;
const fenceBytesReserved = 2 * (backtickRunMax + 1) + "text\n\n".length;
export const fingerprintChars = 12;
export const stateLabelsExtraMax = 20;

// The triage state labels (Matt's triage defaults, plus needs-design). A repo
// that renamed them in docs/agents/triage-labels.md passes its names with
// --state-label. The publisher never applies one, and strips them on reopen.
export const stateLabelsDefault = ["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix", "needs-design"];
export const mechanicalLabel = "fix: mechanical";
export const notConfiguredRule = "audit-not-configured";
// The only gh nouns this script may use. `pr` is deliberately absent.
const ghNounsAllowed = ["issue", "label"];
const labelFlags = ["--label", "--add-label", "-l"];

const severities = ["low", "medium", "high", "critical"];
const confidences = ["low", "medium", "high"];
const fixKinds = ["mechanical", "judgement"];
const sourceKinds = ["internal", "external"];
const sourceLabels = ["source:errors", "source:feedback", "source:email"];
const scopes = ["incremental", "full", "none", "targeted"];
export const summaryCharsMax = 2000;
export const targetCharsMax = 200;
const auditNamePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Both markers are matched only as the footer this script writes last, so a
// marker quoted in evidence, a recommendation or a summary is never read.
const fingerprintPattern = /<sub>fp: ([^<\s]+)<\/sub>(?: · <sub>audit: [^<]*<\/sub>)?\s*$/;
const runMarkerPattern = /<sub>audit-run: ([a-z0-9-]+) sha: ([0-9a-f]+)( scope: none)?<\/sub>\s*$/;
const explicitFingerprintPattern = /^[A-Za-z0-9._:\/-]{1,120}$/;
const journeyPattern = /^[a-z0-9][a-z0-9._-]{0,79}$/;
export const runLabel = "audit-run";

export function parseArgs(argv, env = process.env) {
  const options = {
    file: null,
    dryRun: env.AUDITS_DRY_RUN === "true",
    repo: null,
    newIssuesMax: newIssuesMaxDefault,
    severityMin: "low",
    stateLabels: [...stateLabelsDefault],
    headless: env.AUDITS_HEADLESS === "1",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--repo") options.repo = argv[++index];
    else if (arg === "--new-issues-max") options.newIssuesMax = Number(argv[++index]);
    else if (arg === "--severity-min") options.severityMin = argv[++index];
    else if (arg === "--state-label") options.stateLabels.push(argv[++index]);
    else if (arg === "--headless") options.headless = true;
    else if (!arg.startsWith("--") && options.file === null) options.file = arg;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (options.file === null) throw new Error("missing <findings.json>");
  if (!Number.isInteger(options.newIssuesMax) || options.newIssuesMax < 0 || options.newIssuesMax > newIssuesMaxLimit) {
    throw new Error(`--new-issues-max must be an integer from 0 to ${newIssuesMaxLimit}`);
  }
  if (!severities.includes(options.severityMin)) throw new Error(`--severity-min must be one of ${severities.join(", ")}`);
  if (options.stateLabels.some((label) => typeof label !== "string" || label.length === 0)) {
    throw new Error("--state-label needs a label name");
  }
  if (options.stateLabels.length > stateLabelsDefault.length + stateLabelsExtraMax) throw new Error("too many --state-label values");
  return options;
}

function validateFinding(finding, at, report, expect) {
  expect(finding.audit === report.audit, `${at}.audit must equal report.audit`);
  expect(typeof finding.rule === "string" && finding.rule.length > 0, `${at}.rule is required`);
  expect(typeof finding.title === "string" && finding.title.length > 0, `${at}.title is required`);
  expect(severities.includes(finding.severity), `${at}.severity must be one of ${severities.join(", ")}`);
  expect(confidences.includes(finding.confidence), `${at}.confidence must be one of ${confidences.join(", ")}`);
  expect(typeof finding.locator === "string" && finding.locator.length > 0, `${at}.locator is required`);
  expect(!/:\d+(:\d+)?$/.test(finding.locator ?? ""), `${at}.locator must not end in a line number`);
  expect(!String(finding.locator ?? "").includes("`"), `${at}.locator must not contain a backtick`);
  expect(finding.fingerprint === undefined || explicitFingerprintPattern.test(String(finding.fingerprint)),
    `${at}.fingerprint must be 1-120 of A-Z a-z 0-9 . _ : / -`);
  expect(finding.journey === undefined || journeyPattern.test(String(finding.journey)),
    `${at}.journey must be a journey id: lowercase letters, digits, . _ -`);
  expect(typeof finding.evidence === "string", `${at}.evidence is required`);
  expect(typeof finding.recommendation === "string", `${at}.recommendation is required`);
  expect(fixKinds.includes(finding.fix), `${at}.fix must be mechanical or judgement`);
  expect(sourceKinds.includes(finding.source), `${at}.source must be internal or external`);
  for (const label of finding.labels ?? []) {
    expect(sourceLabels.includes(label), `${at}.labels may only contain ${sourceLabels.join(", ")}`);
  }
  if (finding.source === "external") {
    expect((finding.labels ?? []).length > 0, `${at}: external findings need a source:* label`);
  }
}

export function validateReport(report, { headless = false } = {}) {
  const problems = [];
  const expect = (condition, message) => {
    if (!condition) problems.push(message);
  };
  expect(typeof report === "object" && report !== null, "report must be an object");
  if (problems.length > 0) return problems;

  expect(auditNamePattern.test(report.audit ?? ""), "audit must be a kebab-case skill name");
  expect(/^[0-9a-f]{7,40}$/.test(report.sha ?? ""), "sha must be a git SHA");
  expect(scopes.includes(report.scope), `scope must be one of ${scopes.join(", ")}`);
  expect(typeof report.summary === "string" && report.summary.length <= summaryCharsMax,
    `summary is required, at most ${summaryCharsMax} characters`);
  if (report.scope === "targeted") {
    expect(typeof report.target === "string" && report.target.length > 0 && report.target.length <= targetCharsMax,
      `a targeted report needs a target, at most ${targetCharsMax} characters`);
    expect(!String(report.target ?? "").includes("`"), "target must not contain a backtick");
    expect(!headless, "a headless run is always a sweep: scope targeted is interactive only");
  } else {
    expect(report.target === undefined, "only a targeted report has a target");
  }
  expect(Array.isArray(report.findings), "findings must be an array");
  if (!Array.isArray(report.findings)) return problems;
  expect(report.findings.length <= findingsMax, `at most ${findingsMax} findings per run`);
  report.findings.forEach((finding, index) => validateFinding(finding, `findings[${index}]`, report, expect));
  return problems;
}

/** The report a headless run emits, alone, when docs/agents/audits.md is missing. */
export function notConfiguredReport(audit, sha) {
  if (!auditNamePattern.test(audit ?? "")) throw new Error("usage: not-configured <audit> [<sha>] [--out <file>]");
  if (!/^[0-9a-f]{7,40}$/.test(sha ?? "")) throw new Error("usage: not-configured <audit> [<sha>] [--out <file>]");
  return {
    audit,
    sha,
    scope: "none",
    summary: `The ${audit} audit did not run: this repo has no docs/agents/audits.md, so it has no audit settings.`,
    findings: [{
      audit,
      rule: notConfiguredRule,
      title: `[${audit}] not run: docs/agents/audits.md is missing`,
      severity: "medium",
      confidence: "high",
      locator: "docs/agents/audits.md",
      evidence: "docs/agents/audits.md does not exist at this commit.",
      recommendation: "Run /schedule-audits in this repo. It seeds docs/agents/audits.md from its template and renders the workflow that runs audits on a schedule.",
      // Judgement: the fix is the user-invoked /schedule-audits (a cron, CI auth).
      fix: "judgement",
      source: "internal",
    }],
  };
}

export function normaliseLocator(locator) {
  return locator.trim().toLowerCase().replace(/\\/g, "/").replace(/\s+/g, " ");
}

export function fingerprintOf(finding) {
  if (typeof finding.fingerprint === "string" && finding.fingerprint.length > 0) {
    assert.ok(!/\s/.test(finding.fingerprint), "explicit fingerprints contain no whitespace");
    return finding.fingerprint;
  }
  const digest = createHash("sha1")
    .update(`${finding.audit}|${finding.rule}|${normaliseLocator(finding.locator)}`)
    .digest("hex");
  return `${finding.audit}-${digest.slice(0, fingerprintChars)}`;
}

// Untrusted text must never ping people or trigger bots.
export function neutraliseMentions(text) {
  return text.replace(/@(?=[A-Za-z0-9_-])/g, "@​");
}

/** Shortens backtick runs over backtickRunMax, so fenced() never needs a longer fence. */
export function boundBacktickRuns(text) {
  return text.replace(new RegExp(`\`{${backtickRunMax + 1},}`, "g"),
    (run) => `${"`".repeat(backtickRunMax)}[+${run.length - backtickRunMax} backticks]`);
}

export function fenced(text) {
  const longestRun = Math.max(2, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longestRun + 1);
  return `${fence}text\n${text}\n${fence}`;
}

export function truncateTitle(title) {
  const clean = neutraliseMentions(title.replace(/\s+/g, " ").trim());
  if (clean.length <= titleCharsMax) return clean;
  return `${clean.slice(0, titleCharsMax - 1)}…`;
}

export function issueBody(finding, fingerprint, sha, target = null) {
  const filedBy = target === null ? "" : ` in a targeted run on \`${neutraliseMentions(target)}\``;
  const footer = `\n\n---\n<sub>fp: ${fingerprint}</sub> · <sub>audit: ${finding.audit} · sha: ${sha}</sub>`;
  const header = [
    `> *Filed by the \`${finding.audit}\` audit${filedBy}. It has no state label: Triage decides what happens next.*`,
    "",
    `**Severity**: ${finding.severity} · **Confidence**: ${finding.confidence} · **Fix**: ${finding.fix} · **Source**: ${finding.source}`,
    `**Where**: \`${neutraliseMentions(finding.locator)}\``,
    finding.journey ? `**Journey**: \`${neutraliseMentions(finding.journey)}\`` : null,
    "",
    "## Recommendation",
    "",
    neutraliseMentions(finding.recommendation),
    "",
    "## Evidence",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const fixedBytes = Buffer.byteLength(header + footer) + fenceBytesReserved + 32;
  assert.ok(fixedBytes < bodyBytesMax, "header and footer leave room for evidence");
  let evidence = boundBacktickRuns(neutraliseMentions(finding.evidence));
  const evidenceBytesMax = bodyBytesMax - fixedBytes;
  if (Buffer.byteLength(evidence) > evidenceBytesMax) {
    evidence = `${Buffer.from(evidence).subarray(0, evidenceBytesMax - 32).toString("utf8")}\n[truncated]`;
  }
  const body = `${header}${fenced(evidence)}${footer}`;
  assert.ok(Buffer.byteLength(body) <= bodyBytesMax, "issue body within bound");
  return body;
}

/** Labels for a finding's issue: fingerprint, severity, fix kind, source. Never a state label. */
export function labelsFor(finding, options) {
  const labels = [`audit:${finding.audit}`, `severity:${finding.severity}`];
  if (finding.fix === "mechanical" && finding.source === "internal") labels.push(mechanicalLabel);
  for (const label of finding.labels ?? []) labels.push(label);
  const unique = [...new Set(labels)];
  assert.ok(!unique.some((label) => options.stateLabels.includes(label)), "a finding's labels never include a state label");
  return unique;
}

const labelNames = (issue) => (issue.labels ?? []).map((label) => (typeof label === "string" ? label : label.name));

/** Severity labels to remove when the issue's severity differs from the finding's; null when it matches. */
function staleSeverityLabels(labels, finding) {
  const current = labels.filter((name) => name.startsWith("severity:"));
  return current.length > 0 && !current.includes(`severity:${finding.severity}`) ? current : null;
}

export function indexExisting(issues) {
  const byFingerprint = new Map();
  const runs = [];
  for (const issue of issues) {
    const body = issue.body ?? "";
    const runMatch = labelNames(issue).includes(runLabel) ? runMarkerPattern.exec(body) : null;
    if (runMatch) {
      runs.push({ number: issue.number, state: issue.state, audit: runMatch[1], sha: runMatch[2], audited: !runMatch[3] });
      continue;
    }
    const fpMatch = fingerprintPattern.exec(body);
    if (!fpMatch) continue;
    const previous = byFingerprint.get(fpMatch[1]);
    const preferThis = !previous || (issue.state === "OPEN" && previous.state !== "OPEN") ||
      (issue.state === previous.state && issue.number > previous.number);
    if (preferThis) byFingerprint.set(fpMatch[1], issue);
  }
  return { byFingerprint, runs };
}

function planMatched(plan, entry, match, options) {
  const labels = labelNames(match);
  if (match.state === "OPEN") {
    const stale = staleSeverityLabels(labels, entry.finding);
    if (stale) {
      entry.previousSeverityLabels = stale;
      plan.relabel.push(entry);
    } else {
      plan.unchanged.push(entry);
    }
  } else if (match.stateReason === "COMPLETED" || match.stateReason == null) {
    // A regression goes back through Triage, so any state label it kept is removed.
    entry.staleStateLabels = labels.filter((name) => options.stateLabels.includes(name));
    entry.previousSeverityLabels = staleSeverityLabels(labels, entry.finding) ?? [];
    plan.reopen.push(entry);
  } else {
    plan.suppressed.push(entry); // Closed as not planned: suppressed for good.
  }
}

// A sweep (incremental or full) shows the settings file now exists, so this
// audit's open audit-not-configured issue is closed as completed. A targeted
// run leaves it for the next sweep.
function resolvedNotConfigured(report, byFingerprint, seen) {
  if (report.scope === "none" || report.scope === "targeted") return [];
  const fingerprint = fingerprintOf({ audit: report.audit, rule: notConfiguredRule, locator: "docs/agents/audits.md" });
  const match = byFingerprint.get(fingerprint);
  if (!match || match.state !== "OPEN" || seen.has(fingerprint)) return [];
  return [{ number: match.number, fingerprint }];
}

export function planOperations(report, existingIssues, options) {
  const severityFloor = severities.indexOf(options.severityMin);
  const { byFingerprint, runs } = indexExisting(existingIssues);
  const plan = { create: [], reopen: [], relabel: [], unchanged: [], suppressed: [], overflow: [], belowThreshold: 0 };
  const seen = new Set();

  const ordered = [...report.findings].sort(
    (a, b) => severities.indexOf(b.severity) - severities.indexOf(a.severity),
  );
  for (const finding of ordered) {
    if (severities.indexOf(finding.severity) < severityFloor) {
      plan.belowThreshold += 1;
      continue;
    }
    const fingerprint = fingerprintOf(finding);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const entry = { finding, fingerprint };
    const match = byFingerprint.get(fingerprint);
    if (match) {
      entry.number = match.number;
      planMatched(plan, entry, match, options);
    } else if (plan.create.length < options.newIssuesMax) {
      plan.create.push(entry);
    } else {
      plan.overflow.push(entry);
    }
  }
  // A targeted run opens no tracking issue, so it supersedes nothing.
  plan.previousRuns = report.scope === "targeted" ? [] :
    runs.filter((run) => run.audit === report.audit && run.state === "OPEN");
  plan.resolved = resolvedNotConfigured(report, byFingerprint, seen);
  return plan;
}

function runMarker(report) {
  return `<sub>audit-run: ${report.audit} sha: ${report.sha}${report.scope === "none" ? " scope: none" : ""}</sub>`;
}

export function trackingBody(report, plan, numbers) {
  const line = (entry, note) =>
    `- [ ] #${entry.number ?? numbers.get(entry.fingerprint)} ${truncateTitle(entry.finding.title)} (${entry.finding.severity}${note ? `, ${note}` : ""})`;
  const sections = [
    report.scope === "none"
      ? `> *Tracking issue for a run of the \`${report.audit}\` audit at \`${report.sha}\` that did not audit anything.*`
      : `> *Tracking issue for one run of the \`${report.audit}\` audit at \`${report.sha}\` (${report.scope} scope).*`,
    "",
    report.summary ? neutraliseMentions(report.summary) : null,
    "",
    "## Findings",
    "",
    ...plan.create.map((entry) => line(entry, "new")),
    ...plan.reopen.map((entry) => line(entry, "regression")),
    ...plan.relabel.map((entry) => line(entry, "severity changed")),
    ...plan.unchanged.map((entry) => line(entry, null)),
  ];
  if (plan.overflow.length > 0) {
    sections.push("", `## Not filed (over the per-run cap of new issues)`, "");
    for (const entry of plan.overflow) {
      sections.push(`- ${truncateTitle(entry.finding.title)} (${entry.finding.severity}) \`${entry.fingerprint}\``);
    }
  }
  sections.push(
    "",
    `Suppressed (closed as not planned): ${plan.suppressed.length}. Below severity threshold: ${plan.belowThreshold}.`,
    "",
    "---",
    runMarker(report),
  );
  const body = sections.filter((section) => section !== null).join("\n");
  if (Buffer.byteLength(body) <= bodyBytesMax * 4) return body;
  return `${body.slice(0, bodyBytesMax * 4 - 96)}\n[truncated]\n${runMarker(report)}`;
}

/** Label values an argv applies: `--label X`, `--label=X`, `-l X`, `-l=X`, comma-joined values split. */
export function appliedLabelValues(args) {
  const values = [];
  args.forEach((arg, index) => {
    if (labelFlags.includes(args[index - 1])) values.push(arg);
    for (const flag of labelFlags) {
      if (arg.startsWith(`${flag}=`)) values.push(arg.slice(flag.length + 1));
    }
  });
  return values.flatMap((value) => value.split(",")).map((label) => label.trim());
}

/** Wraps a gh runner so no call can touch PRs or apply a state label (GitHub label names ignore case). */
export function guardedGh(run, stateLabels) {
  const forbidden = new Set(stateLabels.map((label) => label.toLowerCase()));
  return (args, input) => {
    assert.ok(ghNounsAllowed.includes(args[0]), `publish-findings never runs gh ${args[0]}`);
    for (const label of appliedLabelValues(args)) {
      assert.ok(!forbidden.has(label.toLowerCase()), `publish-findings never applies the state label ${label}`);
    }
    if (args[0] === "label" && args[1] === "create") {
      assert.ok(!forbidden.has(String(args[2]).toLowerCase()), `publish-findings never creates the state label ${args[2]}`);
    }
    return run(args, input);
  };
}

function createGh(options) {
  const binary = process.env.PUBLISH_FINDINGS_GH ?? "gh";
  const run = (args, input) => {
    const fullArgs = options.repo ? [...args, "--repo", options.repo] : args;
    return execFileSync(binary, fullArgs, { input, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
  };
  return guardedGh(run, options.stateLabels ?? stateLabelsDefault);
}

// Open issues are listed by label alone, so one filed minutes ago is never
// missed. Closed ones go through search, to leave out the closed tracking
// issues that pile up one per run; search lags a little behind new issues,
// but a closed issue is old news to it.
function listIssues(gh, args) {
  const issues = JSON.parse(gh([...args, "--limit", String(existingIssuesMax), "--json", "number,state,stateReason,body,labels"]));
  assert.ok(Array.isArray(issues), "gh issue list returns an array");
  if (issues.length >= existingIssuesMax) {
    throw new Error(`${issues.length} existing ${args.join(" ")} issues reached the list limit; refusing to dedupe on a truncated list`);
  }
  return issues;
}

function listExisting(gh, audit) {
  const open = listIssues(gh, ["issue", "list", "--label", `audit:${audit}`, "--state", "open"]);
  const closed = listIssues(gh, ["issue", "list", "--label", `audit:${audit}`, "--search", `-label:${runLabel}`, "--state", "closed"]);
  const seen = new Set(open.map((issue) => issue.number));
  return [...open, ...closed.filter((issue) => !seen.has(issue.number) && !labelNames(issue).includes(runLabel))];
}

function ensureLabels(gh, wanted, dryRun, log) {
  const existing = new Set(JSON.parse(gh(["label", "list", "--limit", "500", "--json", "name"])).map((label) => label.name));
  for (const name of wanted) {
    if (existing.has(name)) continue;
    log.push({ op: "label-create", name });
    if (!dryRun) gh(["label", "create", name, "--description", "Created by publish-findings"]);
  }
}

function issueNumberFromUrl(url) {
  const match = /\/issues\/(\d+)\s*$/.exec(url.trim());
  assert.ok(match, `gh issue create returned an issue URL, got: ${url}`);
  return Number(match[1]);
}

function createIssues(gh, report, plan, options, log, bodies) {
  const numbers = new Map();
  let placeholder = 0;
  for (const entry of plan.create) {
    const title = truncateTitle(entry.finding.title);
    const labels = labelsFor(entry.finding, options);
    log.push({ op: "create", title, labels, fingerprint: entry.fingerprint });
    if (options.dryRun) {
      placeholder += 1;
      numbers.set(entry.fingerprint, `new-${placeholder}`);
      continue;
    }
    const args = ["issue", "create", "--title", title, "--body-file", "-"];
    for (const label of labels) args.push("--label", label);
    numbers.set(entry.fingerprint, issueNumberFromUrl(gh(args, bodies.get(entry.fingerprint))));
  }
  return numbers;
}

function updateMatched(gh, report, plan, options, log) {
  for (const entry of plan.reopen) {
    const removeLabels = [...entry.staleStateLabels, ...entry.previousSeverityLabels];
    log.push({ op: "reopen", number: entry.number, fingerprint: entry.fingerprint, removeLabels });
    if (options.dryRun) continue;
    gh(["issue", "reopen", String(entry.number), "--comment", `Regression: the \`${report.audit}\` audit found this again at \`${report.sha}\`.`]);
    const args = ["issue", "edit", String(entry.number), "--add-label", "regression"];
    if (entry.previousSeverityLabels.length > 0) args.push("--add-label", `severity:${entry.finding.severity}`);
    for (const label of removeLabels) args.push("--remove-label", label);
    gh(args);
  }
  for (const entry of plan.relabel) {
    log.push({ op: "relabel", number: entry.number, severity: entry.finding.severity });
    if (options.dryRun) continue;
    const args = ["issue", "edit", String(entry.number), "--add-label", `severity:${entry.finding.severity}`];
    for (const label of entry.previousSeverityLabels) args.push("--remove-label", label);
    gh(args);
    gh(["issue", "comment", String(entry.number), "--body", `Severity is now **${entry.finding.severity}** as of \`${report.sha}\`.`]);
  }
  for (const entry of plan.resolved) {
    log.push({ op: "close-resolved", number: entry.number, fingerprint: entry.fingerprint });
    if (options.dryRun) continue;
    gh(["issue", "close", String(entry.number), "--reason", "completed", "--comment",
      `Resolved: the \`${report.audit}\` audit ran with docs/agents/audits.md at \`${report.sha}\`.`]);
  }
}

function createTracking(gh, report, plan, numbers, options, log) {
  const body = trackingBody(report, plan, numbers);
  const trackingTitle = truncateTitle(`[${report.audit}] audit run at ${report.sha.slice(0, 7)}`);
  log.push({ op: "create-tracking", title: trackingTitle });
  let trackingNumber = "new-tracking";
  if (!options.dryRun) {
    trackingNumber = issueNumberFromUrl(gh(
      ["issue", "create", "--title", trackingTitle, "--body-file", "-", "--label", `audit:${report.audit}`, "--label", runLabel],
      body,
    ));
  }
  for (const run of plan.previousRuns) {
    log.push({ op: "close-previous-run", number: run.number });
    if (options.dryRun) continue;
    gh(["issue", "close", String(run.number), "--reason", "not planned", "--comment", `Superseded by #${trackingNumber}.`]);
  }
  return { trackingNumber, body };
}

function execute(gh, report, plan, options) {
  const log = [];
  // Every body is built before the first write, so a bad one fails the run whole.
  const bodies = new Map(plan.create.map((entry) =>
    [entry.fingerprint, issueBody(entry.finding, entry.fingerprint, report.sha, report.target ?? null)]));
  const wanted = new Set([`audit:${report.audit}`]);
  if (report.scope !== "targeted") wanted.add(runLabel);
  for (const entry of [...plan.create, ...plan.reopen, ...plan.relabel]) {
    for (const label of labelsFor(entry.finding, options)) wanted.add(label);
  }
  if (plan.reopen.length > 0) wanted.add("regression");
  ensureLabels(gh, wanted, options.dryRun, log);

  const numbers = createIssues(gh, report, plan, options, log, bodies);
  updateMatched(gh, report, plan, options, log);
  if (report.scope === "targeted") return { log, trackingNumber: null, body: null };
  const { trackingNumber, body } = createTracking(gh, report, plan, numbers, options, log);
  return { log, trackingNumber, body };
}

/** The SHA of the newest run that audited; runs with scope "none" (not configured) never count. */
export function lastAuditedSha(issues, audit) {
  const runs = indexExisting(issues).runs.filter((run) => run.audit === audit && run.audited);
  if (runs.length === 0) return "";
  return runs.reduce((latest, run) => (run.number > latest.number ? run : latest)).sha;
}

function mainLastSha(argv) {
  const audit = argv[0];
  if (!auditNamePattern.test(audit ?? "")) throw new Error("usage: last-sha <audit> [--repo OWNER/NAME]");
  const repoIndex = argv.indexOf("--repo");
  const gh = createGh({ repo: repoIndex === -1 ? null : argv[repoIndex + 1] });
  const output = gh([
    "issue", "list", "--label", runLabel, "--label", `audit:${audit}`, "--state", "all",
    "--limit", "20", "--json", "number,state,body,labels",
  ]);
  console.log(lastAuditedSha(JSON.parse(output), audit));
  return 0;
}

export function reportPath(audit, env = process.env) {
  if (!auditNamePattern.test(audit ?? "")) throw new Error("usage: report-path <audit>");
  return join(env.TMPDIR || tmpdir(), `findings-${audit}.json`);
}

function mainNotConfigured(argv) {
  const outIndex = argv.indexOf("--out");
  const out = outIndex === -1 ? null : argv[outIndex + 1];
  if (outIndex !== -1 && !out) throw new Error("--out needs a file");
  const positional = outIndex === -1 ? argv : argv.filter((_, index) => index !== outIndex && index !== outIndex + 1);
  if (positional.length < 1 || positional.length > 2) throw new Error("usage: not-configured <audit> [<sha>] [--out <file>]");
  const sha = positional[1] ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const text = `${JSON.stringify(notConfiguredReport(positional[0], sha), null, 2)}\n`;
  if (out === null) process.stdout.write(text);
  else writeFileSync(out, text);
  return 0;
}

export function main(argv) {
  if (argv[0] === "last-sha") return mainLastSha(argv.slice(1));
  if (argv[0] === "not-configured") return mainNotConfigured(argv.slice(1));
  if (argv[0] === "report-path") {
    console.log(reportPath(argv[1]));
    return 0;
  }
  const options = parseArgs(argv);
  const report = JSON.parse(readFileSync(options.file, "utf8"));
  const problems = validateReport(report, { headless: options.headless });
  if (problems.length > 0) {
    for (const problem of problems) console.error(`invalid: ${problem}`);
    return 1;
  }
  const gh = createGh(options);
  const plan = planOperations(report, listExisting(gh, report.audit), options);
  const result = execute(gh, report, plan, options);
  const summary = {
    dryRun: options.dryRun,
    tracking: result.trackingNumber,
    created: plan.create.length,
    reopened: plan.reopen.length,
    relabelled: plan.relabel.length,
    unchanged: plan.unchanged.length,
    suppressed: plan.suppressed.length,
    overflow: plan.overflow.length,
    belowThreshold: plan.belowThreshold,
    resolved: plan.resolved.length,
    operations: result.log,
  };
  if (report.scope === "targeted") {
    // No tracking issue holds a targeted run, so the summary carries what it would.
    summary.target = report.target;
    summary.notFiled = plan.overflow.map((entry) => ({
      title: truncateTitle(entry.finding.title), severity: entry.finding.severity, fingerprint: entry.fingerprint,
    }));
  }
  if (options.dryRun && result.body !== null) summary.trackingBody = result.body;
  console.log(JSON.stringify(summary, null, 2));
  return 0;
}

const invokedDirectly = process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`publish-findings: ${error.message}`);
    process.exitCode = 1;
  }
}
