#!/usr/bin/env node
// Publishes audit findings to GitHub issues: fingerprint dedupe, one tracking
// issue per run, labelled child issues, hard caps, mention neutralisation.
// Zero dependencies; needs Node 22+ and an authenticated `gh`.
//
// Usage:
//   node publish-findings.mjs <findings.json> [--dry-run] [--repo OWNER/NAME]
//        [--new-issues-max N] [--severity-min low|medium|high|critical]
//        [--triage-label NAME]
//   node publish-findings.mjs last-sha <audit> [--repo OWNER/NAME]
//        Prints the SHA audited by the most recent run (empty if none), for
//        incremental scoping.
//
// Deterministic by design: the model that reads untrusted text (Sentry events,
// feedback, email) never holds write access; this script does the writing.

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

export const titleCharsMax = 120;
export const bodyBytesMax = 8 * 1024;
export const newIssuesMaxDefault = 5;
export const findingsMax = 200;
export const existingIssuesMax = 1000;
export const fingerprintChars = 12;

const severities = ["low", "medium", "high", "critical"];
const confidences = ["low", "medium", "high"];
const fixKinds = ["mechanical", "judgement"];
const sourceKinds = ["internal", "external"];
const sourceLabels = ["source:sentry", "source:feedback", "source:email"];
const fingerprintPattern = /<sub>fp: ([^<\s]+)<\/sub>/;
const runMarkerPattern = /<sub>audit-run: ([a-z0-9-]+) sha: ([0-9a-f]+)<\/sub>/;

export function parseArgs(argv) {
  const options = {
    file: null,
    dryRun: false,
    repo: null,
    newIssuesMax: newIssuesMaxDefault,
    severityMin: "low",
    triageLabel: "needs-triage",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--repo") options.repo = argv[++index];
    else if (arg === "--new-issues-max") options.newIssuesMax = Number(argv[++index]);
    else if (arg === "--severity-min") options.severityMin = argv[++index];
    else if (arg === "--triage-label") options.triageLabel = argv[++index];
    else if (!arg.startsWith("--") && options.file === null) options.file = arg;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (options.file === null) throw new Error("missing <findings.json>");
  if (!Number.isInteger(options.newIssuesMax) || options.newIssuesMax < 0 || options.newIssuesMax > 50) {
    throw new Error("--new-issues-max must be an integer from 0 to 50");
  }
  if (!severities.includes(options.severityMin)) throw new Error(`--severity-min must be one of ${severities.join(", ")}`);
  return options;
}

export function validateReport(report) {
  const problems = [];
  const expect = (condition, message) => {
    if (!condition) problems.push(message);
  };
  expect(typeof report === "object" && report !== null, "report must be an object");
  if (problems.length > 0) return problems;

  expect(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(report.audit ?? ""), "audit must be a kebab-case skill name");
  expect(/^[0-9a-f]{7,40}$/.test(report.sha ?? ""), "sha must be a git SHA");
  expect(["incremental", "full"].includes(report.scope), "scope must be incremental or full");
  expect(Array.isArray(report.findings), "findings must be an array");
  if (!Array.isArray(report.findings)) return problems;
  expect(report.findings.length <= findingsMax, `at most ${findingsMax} findings per run`);

  report.findings.forEach((finding, index) => {
    const at = `findings[${index}]`;
    expect(finding.audit === report.audit, `${at}.audit must equal report.audit`);
    expect(typeof finding.rule === "string" && finding.rule.length > 0, `${at}.rule is required`);
    expect(typeof finding.title === "string" && finding.title.length > 0, `${at}.title is required`);
    expect(severities.includes(finding.severity), `${at}.severity must be one of ${severities.join(", ")}`);
    expect(confidences.includes(finding.confidence), `${at}.confidence must be one of ${confidences.join(", ")}`);
    expect(typeof finding.locator === "string" && finding.locator.length > 0, `${at}.locator is required`);
    expect(!/:\d+(:\d+)?$/.test(finding.locator ?? ""), `${at}.locator must not end in a line number`);
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
  });
  return problems;
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

export function issueBody(finding, fingerprint, sha) {
  const footer = `\n\n---\n<sub>fp: ${fingerprint}</sub> · <sub>audit: ${finding.audit} · sha: ${sha}</sub>`;
  const header = [
    `> *Filed by the \`${finding.audit}\` audit.*`,
    "",
    `**Severity**: ${finding.severity} · **Confidence**: ${finding.confidence} · **Fix**: ${finding.fix} · **Source**: ${finding.source}`,
    `**Where**: \`${neutraliseMentions(finding.locator)}\``,
    finding.journey ? `**Journey**: \`${finding.journey}\`` : null,
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

  const fixedBytes = Buffer.byteLength(header + footer) + 64;
  assert.ok(fixedBytes < bodyBytesMax, "header and footer leave room for evidence");
  let evidence = neutraliseMentions(finding.evidence);
  const evidenceBytesMax = bodyBytesMax - fixedBytes;
  if (Buffer.byteLength(evidence) > evidenceBytesMax) {
    evidence = `${Buffer.from(evidence).subarray(0, evidenceBytesMax - 32).toString("utf8")}\n[truncated]`;
  }
  const body = `${header}${fenced(evidence)}${footer}`;
  assert.ok(Buffer.byteLength(body) <= bodyBytesMax, "issue body within bound");
  return body;
}

export function labelsFor(finding, options) {
  const labels = [`audit:${finding.audit}`, `severity:${finding.severity}`, options.triageLabel];
  if (finding.fix === "mechanical" && finding.source === "internal") labels.push("mechanical-fix");
  for (const label of finding.labels ?? []) labels.push(label);
  return [...new Set(labels)];
}

export function indexExisting(issues) {
  const byFingerprint = new Map();
  const runs = [];
  for (const issue of issues) {
    const body = issue.body ?? "";
    const runMatch = runMarkerPattern.exec(body);
    if (runMatch) {
      runs.push({ number: issue.number, state: issue.state, audit: runMatch[1], sha: runMatch[2] });
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
    if (!match) {
      if (plan.create.length < options.newIssuesMax) plan.create.push(entry);
      else plan.overflow.push(entry);
      continue;
    }
    entry.number = match.number;
    if (match.state === "OPEN") {
      const severityLabel = `severity:${finding.severity}`;
      const labels = (match.labels ?? []).map((label) => (typeof label === "string" ? label : label.name));
      if (labels.some((name) => name.startsWith("severity:")) && !labels.includes(severityLabel)) {
        entry.previousSeverityLabels = labels.filter((name) => name.startsWith("severity:"));
        plan.relabel.push(entry);
      } else {
        plan.unchanged.push(entry);
      }
    } else if (match.stateReason === "COMPLETED" || match.stateReason == null) {
      plan.reopen.push(entry);
    } else {
      plan.suppressed.push(entry);
    }
  }
  plan.previousRuns = runs.filter((run) => run.audit === report.audit && run.state === "OPEN");
  return plan;
}

export function trackingBody(report, plan, numbers) {
  const line = (entry, note) =>
    `- [ ] #${entry.number ?? numbers.get(entry.fingerprint)} ${truncateTitle(entry.finding.title)} (${entry.finding.severity}${note ? `, ${note}` : ""})`;
  const sections = [
    `> *Tracking issue for one run of the \`${report.audit}\` audit at \`${report.sha}\` (${report.scope} scope).*`,
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
    `<sub>audit-run: ${report.audit} sha: ${report.sha}</sub>`,
  );
  const body = sections.filter((section) => section !== null).join("\n");
  if (Buffer.byteLength(body) <= bodyBytesMax * 4) return body;
  return `${body.slice(0, bodyBytesMax * 4 - 64)}\n[truncated]\n<sub>audit-run: ${report.audit} sha: ${report.sha}</sub>`;
}

function createGh(options) {
  const binary = process.env.PUBLISH_FINDINGS_GH ?? "gh";
  return (args, input) => {
    const fullArgs = options.repo ? [...args, "--repo", options.repo] : args;
    return execFileSync(binary, fullArgs, { input, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
  };
}

function listExisting(gh, audit) {
  const output = gh([
    "issue", "list", "--label", `audit:${audit}`, "--state", "all",
    "--limit", String(existingIssuesMax), "--json", "number,state,stateReason,body,labels",
  ]);
  const issues = JSON.parse(output);
  assert.ok(Array.isArray(issues), "gh issue list returns an array");
  if (issues.length >= existingIssuesMax) {
    throw new Error(`${issues.length} existing audit:${audit} issues reached the list limit; refusing to dedupe on a truncated list`);
  }
  return issues;
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

function execute(gh, report, plan, options) {
  const log = [];
  const numbers = new Map();
  const wanted = new Set([`audit:${report.audit}`, "audit-run"]);
  for (const entry of [...plan.create, ...plan.reopen, ...plan.relabel]) {
    for (const label of labelsFor(entry.finding, options)) wanted.add(label);
  }
  if (plan.reopen.length > 0) wanted.add("regression");
  ensureLabels(gh, wanted, options.dryRun, log);

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
    numbers.set(entry.fingerprint, issueNumberFromUrl(gh(args, issueBody(entry.finding, entry.fingerprint, report.sha))));
  }
  for (const entry of plan.reopen) {
    log.push({ op: "reopen", number: entry.number, fingerprint: entry.fingerprint });
    if (options.dryRun) continue;
    gh(["issue", "reopen", String(entry.number), "--comment", `Regression: the \`${report.audit}\` audit found this again at \`${report.sha}\`.`]);
    gh(["issue", "edit", String(entry.number), "--add-label", "regression"]);
  }
  for (const entry of plan.relabel) {
    log.push({ op: "relabel", number: entry.number, severity: entry.finding.severity });
    if (options.dryRun) continue;
    const args = ["issue", "edit", String(entry.number), "--add-label", `severity:${entry.finding.severity}`];
    for (const label of entry.previousSeverityLabels) args.push("--remove-label", label);
    gh(args);
    gh(["issue", "comment", String(entry.number), "--body", `Severity is now **${entry.finding.severity}** as of \`${report.sha}\`.`]);
  }

  const body = trackingBody(report, plan, numbers);
  const trackingTitle = truncateTitle(`[${report.audit}] audit run at ${report.sha.slice(0, 7)}`);
  log.push({ op: "create-tracking", title: trackingTitle });
  let trackingNumber = "new-tracking";
  if (!options.dryRun) {
    trackingNumber = issueNumberFromUrl(gh(
      ["issue", "create", "--title", trackingTitle, "--body-file", "-", "--label", `audit:${report.audit}`, "--label", "audit-run"],
      body,
    ));
  }
  for (const run of plan.previousRuns) {
    log.push({ op: "close-previous-run", number: run.number });
    if (options.dryRun) continue;
    gh(["issue", "close", String(run.number), "--reason", "not planned", "--comment", `Superseded by #${trackingNumber}.`]);
  }
  return { log, trackingNumber, body };
}

export function lastAuditedSha(issues, audit) {
  const runs = indexExisting(issues).runs.filter((run) => run.audit === audit);
  if (runs.length === 0) return "";
  return runs.reduce((latest, run) => (run.number > latest.number ? run : latest)).sha;
}

function mainLastSha(argv) {
  const audit = argv[0];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(audit ?? "")) throw new Error("usage: last-sha <audit> [--repo OWNER/NAME]");
  const repoIndex = argv.indexOf("--repo");
  const gh = createGh({ repo: repoIndex === -1 ? null : argv[repoIndex + 1] });
  const output = gh([
    "issue", "list", "--label", "audit-run", "--label", `audit:${audit}`, "--state", "all",
    "--limit", "20", "--json", "number,state,body",
  ]);
  console.log(lastAuditedSha(JSON.parse(output), audit));
  return 0;
}

export function main(argv) {
  if (argv[0] === "last-sha") return mainLastSha(argv.slice(1));
  const options = parseArgs(argv);
  const report = JSON.parse(readFileSync(options.file, "utf8"));
  const problems = validateReport(report);
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
    operations: result.log,
  };
  if (options.dryRun) summary.trackingBody = result.body;
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
