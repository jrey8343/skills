#!/usr/bin/env node
// Renders .github/workflows/audits.yml from docs/agents/audits.md: one scheduled
// job per enabled audit, each running `claude -p "/<audit> headless"`.
// Zero dependencies; needs Node 22+.
//
// Usage:
//   node render-workflow.mjs [--repo <dir>] [--check] [--check-audit <audit>]
//     --repo         the target repo's root (default: the current directory)
//     --check        write nothing; exit 2 if the workflow on disk differs
//     --check-audit  write nothing; exit 3 unless <audit> would still be
//                    scheduled (each rendered job runs this first, so a repo
//                    that took up a third-party source since rendering stops
//                    the audit that reads it)
//
// Deterministic: the same audits.md (and the same repo signals) renders the
// same bytes, and an unchanged workflow is not rewritten. It refuses, writing
// nothing, when a setting is invalid or a model is metered. Audits that would
// read text others wrote are left out of the schedule and named.
//
// Prints a JSON summary: status, scheduled, left_out, offsets.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

export const configPath = "docs/agents/audits.md";
export const workflowPath = ".github/workflows/audits.yml";
export const clashOffsetMinutes = 5;
export const clashAttemptsMax = 11;
export const maxTurnsLimit = 500;
export const timeoutMinutesLimit = 360; // GitHub-hosted runners stop a job at 6 hours.
export const configLinesMax = 1000;
export const auditsMax = 50;
export const scanDepthMax = 3;
export const scanFilesMax = 5000;
export const manifestBytesMax = 1024 * 1024;
export const newIssuesMaxLimit = 50; // report-findings' publisher refuses more
export const subagentsMaxLimit = 16;

// The audits that exist. `reads`: third-party text sources each reads when they are in use.
export const knownAudits = {
  "security-audit": { reads: ["cloudflare-mcp"] },
  "test-audit": { reads: [] },
  "perf-audit": { reads: ["sentry", "cloudflare-mcp"] },
  "docs-audit": { reads: [] },
  "prune-docs": { reads: [] },
  "product-review": { reads: ["sentry", "user-feedback"] },
  "persona-review": { reads: [] },
};
export const thirdPartySources = ["sentry", "user-feedback", "cloudflare-mcp"];

// Pinned majors of the actions the workflow uses. Check each action's README when bumping.
// All four run on node24.
export const actions = {
  checkout: "actions/checkout@v7",
  setupNode: "actions/setup-node@v7",
  loadSecrets: "1password/load-secrets-action@v5",
  appToken: "actions/create-github-app-token@v3",
};
export const nodeVersion = "22";
export const skillsCheckoutDir = ".audit-skills";
export const mattSkillsCheckoutDir = ".audit-skills-matt";
// What a headless audit run may use without asking, on top of each audit's own
// read-only allowed-tools: read-only git, writing the report into the runner's
// temp dir, and the report-findings publisher (which makes the only `gh` calls).
// No general `node`, `git` or `gh`, so repo text can't steer the run into code
// that holds the tokens. Nothing here can push: the checkout keeps no
// credentials and the GitHub token holds Issues access only.
// `disallowedTools` wins over any skill's own allowed-tools: no package runner
// (which would fetch and run code beside the tokens), and no reading issue or
// PR text, which in an open repo anyone can write. The run step's env also
// forces the publisher's --headless and, with ci.dry_run, --dry-run.
const publisherScript = ".claude/skills/report-findings/scripts/publish-findings.mjs";
const rendererScript = ".claude/skills/schedule-audits/scripts/render-workflow.mjs";
export const allowedTools = [
  "Read", "Grep", "Glob", "Skill", "Task", "Agent",
  "Write(/${{ runner.temp }}/**)",
  `Bash(node ${publisherScript}:*)`,
  `Bash(node \${{ github.workspace }}/${publisherScript}:*)`,
  "Bash(git log:*)", "Bash(git diff:*)", "Bash(git show:*)", "Bash(git rev-parse:*)", "Bash(git rev-list:*)", "Bash(git ls-files:*)",
  "Bash(ls:*)", "Bash(wc:*)", "Bash(du:*)",
];
export const disallowedTools = [
  "Bash(npx:*)", "Bash(pnpx:*)", "Bash(bunx:*)", "Bash(wrangler:*)",
  "Bash(gh issue view:*)", "Bash(gh pr:*)",
];

const topKeys = ["defaults", "ci", "skills", "third_party_text", "audits"];
const defaultKeys = ["model", "max_turns", "timeout_minutes", "severity_min", "new_issues_max", "subagents_max", "scope_ignore"];
const auditKeys = ["cron", ...defaultKeys, "reads", "live_targets"];
const ciKeys = ["claude_auth", "claude_token", "github_auth", "dry_run", "claude_code_version", "runner"];
const skillsKeys = ["repository", "sha", "matt"];
const mattKeys = ["repository", "sha"];
const severities = ["low", "medium", "high", "critical"];
const modelAliases = ["sonnet", "opus", "haiku", "opusplan"];
const claudeModelPatterns = [/^claude-(opus|sonnet|haiku)-\d+(-\d+)*$/, /^claude-\d+(-\d+)*-(opus|sonnet|haiku)(-\d+)*$/];
const opReferencePattern = /^op:\/\/[A-Za-z0-9 _.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const shaPattern = /^[0-9a-f]{40}$/;
const versionPattern = /^(latest|\d+\.\d+\.\d+)$/;
const runnerPattern = /^[a-z0-9][a-z0-9.-]*$/;
const keyPattern = /^([A-Za-z0-9_.-]+):(?:\s+(.*))?$/;
const scanSkipDirs = new Set(["node_modules", ".git", "dist", "build", "vendor", ".claude", skillsCheckoutDir]);
const dependencyManifests = new Set(["package.json", "requirements.txt", "pyproject.toml", "Pipfile", "Gemfile", "go.mod", "Cargo.toml", "composer.json", "pom.xml", "build.gradle", "build.gradle.kts", "mix.exs"]);
const sentryConfigFiles = [".sentryclirc", "sentry.properties"];

// ---- a YAML subset: nested maps, `- item` lists, inline [lists], scalars, comments ----

export function stripComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "#" && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line.trimEnd();
}

function splitInline(text) {
  const items = [];
  let quote = null;
  let current = "";
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ",") {
      items.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim() !== "") items.push(current.trim());
  return items;
}

export function parseScalar(text) {
  if (text.startsWith('"')) {
    assert.ok(text.endsWith('"') && text.length >= 2, `unterminated string: ${text}`);
    return JSON.parse(text);
  }
  if (text.startsWith("'")) {
    assert.ok(text.endsWith("'") && text.length >= 2, `unterminated string: ${text}`);
    return text.slice(1, -1).replace(/''/g, "'");
  }
  if (text.startsWith("[")) {
    assert.ok(text.endsWith("]"), `unterminated list: ${text}`);
    return splitInline(text.slice(1, -1)).map(parseScalar);
  }
  assert.ok(!text.startsWith("{"), `inline maps are not supported: ${text}`);
  if (text === "true" || text === "false") return text === "true";
  if (text === "null" || text === "~") return null;
  if (/^-?\d+$/.test(text)) return Number(text);
  return text;
}

function parseList(lines, start, indent) {
  const items = [];
  let index = start;
  while (index < lines.length && lines[index].indent === indent && /^-(\s|$)/.test(lines[index].text)) {
    const rest = lines[index].text.slice(1).trim();
    assert.ok(rest !== "" && !keyPattern.test(rest) || /^["']/.test(rest), `line ${lines[index].number}: list items must be scalars`);
    items.push(parseScalar(rest));
    index += 1;
  }
  return { value: items, next: index };
}

function parseBlock(lines, start, indent) {
  if (/^-(\s|$)/.test(lines[start].text)) return parseList(lines, start, indent);
  const map = {};
  let index = start;
  while (index < lines.length && lines[index].indent === indent) {
    const { text, number } = lines[index];
    const match = keyPattern.exec(text);
    assert.ok(match, `line ${number}: expected "key: value", got: ${text}`);
    const [, key, rest] = match;
    assert.ok(!Object.hasOwn(map, key), `line ${number}: duplicate key "${key}"`);
    index += 1;
    if (rest !== undefined && rest !== "") {
      map[key] = parseScalar(rest);
    } else if (index < lines.length && lines[index].indent > indent) {
      const child = parseBlock(lines, index, lines[index].indent);
      map[key] = child.value;
      index = child.next;
    } else {
      map[key] = null;
    }
  }
  assert.ok(index >= lines.length || lines[index].indent < indent, `line ${lines[index]?.number}: unexpected indentation`);
  return { value: map, next: index };
}

export function parseYaml(text) {
  const raw = text.split("\n");
  assert.ok(raw.length <= configLinesMax, `more than ${configLinesMax} lines`);
  const lines = [];
  raw.forEach((line, index) => {
    assert.ok(!line.includes("\t"), `line ${index + 1}: tabs are not allowed; indent with spaces`);
    const stripped = stripComment(line);
    if (stripped.trim() === "") return;
    lines.push({ indent: stripped.length - stripped.trimStart().length, text: stripped.trim(), number: index + 1 });
  });
  if (lines.length === 0) return {};
  assert.equal(lines[0].indent, 0, `line ${lines[0].number}: the top level must not be indented`);
  const { value, next } = parseBlock(lines, 0, 0);
  assert.equal(next, lines.length, `line ${lines[next]?.number}: unexpected indentation`);
  return value;
}

/** The first ```yaml fenced block of a markdown file, parsed. */
export function readConfig(markdown) {
  const match = /^```ya?ml\n([\s\S]*?)^```/m.exec(markdown.replace(/\r\n/g, "\n"));
  assert.ok(match, `${configPath} has no \`\`\`yaml block`);
  return parseYaml(match[1]);
}

// ---- settings ----

/** Why a model would bill per token, or null when the subscription covers it. */
export function meteredReason(model) {
  if (typeof model !== "string" || model === "") return "no model is set";
  if (modelAliases.includes(model) || claudeModelPatterns.some((pattern) => pattern.test(model))) return null;
  if (/^([a-z]{2,4}\.)?anthropic\./.test(model) || /-v\d+:\d+$/.test(model)) return "it is an Amazon Bedrock id, billed per token by AWS";
  if (model.includes("@")) return "it is a Google Vertex AI id, billed per token by Google Cloud";
  if (model.includes("/")) return "it names a provider route (provider/model), billed per token by that provider";
  if (model.includes("[")) return "it is a variant suffix, not a plain model id the subscription is known to cover";
  if (!model.startsWith("claude-")) return "it is not a Claude model, so it needs another provider's API key";
  return "it is not a Claude model id this renderer recognises";
}

function checkInteger(errors, where, value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) errors.push(`${where} must be a whole number from ${min} to ${max} (got ${JSON.stringify(value)})`);
}

function checkPattern(errors, where, value, pattern, hint) {
  if (typeof value !== "string" || !pattern.test(value) || /[<>]/.test(value)) errors.push(`${where} ${hint} (got ${JSON.stringify(value)})`);
}

const isMap = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function checkKeys(errors, where, map, known) {
  for (const key of Object.keys(map)) if (!known.includes(key)) errors.push(`${where}: unknown key ${JSON.stringify(key)} (known: ${known.join(", ")})`);
}

function checkCi(ci, errors) {
  if (!isMap(ci)) {
    errors.push("ci: missing; copy the ci block from the schedule-audits template");
    return;
  }
  checkKeys(errors, "ci", ci, ciKeys);
  if (ci.claude_auth !== "subscription") {
    errors.push(`ci.claude_auth is ${JSON.stringify(ci.claude_auth)}: scheduled audits run on a Claude subscription token only, never on per-token (metered) billing; set it to subscription`);
  }
  checkPattern(errors, "ci.claude_token", ci.claude_token, opReferencePattern, "must be an op://<vault>/<item>/<field> reference with every placeholder filled in");
  if (!["pat", "app"].includes(ci.github_auth)) errors.push(`ci.github_auth must be pat or app (got ${JSON.stringify(ci.github_auth)})`);
  if (typeof ci.dry_run !== "boolean") errors.push(`ci.dry_run must be true or false (got ${JSON.stringify(ci.dry_run)})`);
  checkPattern(errors, "ci.claude_code_version", ci.claude_code_version, versionPattern, "must be latest or an exact version such as 2.1.0");
  checkPattern(errors, "ci.runner", ci.runner, runnerPattern, "must be a runner label such as ubuntu-latest");
}

function checkSkills(skills, errors) {
  if (!isMap(skills)) {
    errors.push("skills: missing; it names the repository and commit the workflow installs the audit skills from");
    return;
  }
  checkKeys(errors, "skills", skills, skillsKeys);
  checkPattern(errors, "skills.repository", skills.repository, repositoryPattern, "must be owner/name");
  checkPattern(errors, "skills.sha", skills.sha, shaPattern, "must be the full 40-character commit to install the skills from");
  const matt = skills.matt;
  if (!isMap(matt)) {
    errors.push("skills.matt: missing; it names the repository and commit of Matt Pocock's skills, which the audits call by name (domain-modeling, writing-for-agents, tdd)");
    return;
  }
  checkKeys(errors, "skills.matt", matt, mattKeys);
  checkPattern(errors, "skills.matt.repository", matt.repository, repositoryPattern, "must be owner/name");
  checkPattern(errors, "skills.matt.sha", matt.sha, shaPattern, "must be the full 40-character commit of Matt's skills your install pins (Fabrik's skills.lock.json)");
  if (matt.repository === skills.repository) errors.push("skills.matt.repository must differ from skills.repository");
}

function checkAuditEntry(name, merged, errors) {
  const where = `audits.${name}`;
  if (typeof merged.cron !== "string") errors.push(`${where}.cron is missing`);
  const reason = meteredReason(merged.model);
  if (reason) {
    errors.push(`${where}: model ${JSON.stringify(merged.model)} is metered or unknown: ${reason}. Scheduled audits run on the Claude subscription only. Use a Claude model id (claude-sonnet-5-5) or an alias (${modelAliases.join(", ")})`);
  }
  checkInteger(errors, `${where}.max_turns`, merged.max_turns, 1, maxTurnsLimit);
  checkInteger(errors, `${where}.timeout_minutes`, merged.timeout_minutes, 1, timeoutMinutesLimit);
  if (!severities.includes(merged.severity_min)) errors.push(`${where}.severity_min must be one of ${severities.join(", ")}`);
  checkInteger(errors, `${where}.new_issues_max`, merged.new_issues_max, 0, newIssuesMaxLimit);
  checkInteger(errors, `${where}.subagents_max`, merged.subagents_max, 1, subagentsMaxLimit);
  for (const source of merged.reads ?? []) {
    if (!thirdPartySources.includes(source)) errors.push(`${where}.reads: unknown source ${JSON.stringify(source)} (known: ${thirdPartySources.join(", ")})`);
  }
}

/** Validated settings, or { errors }. Never fills in a setting audits.md leaves out. */
export function readSettings(config) {
  const errors = [];
  for (const key of Object.keys(config)) if (!topKeys.includes(key)) errors.push(`unknown top-level key ${JSON.stringify(key)} (known: ${topKeys.join(", ")})`);
  const defaults = config.defaults ?? {};
  if (!isMap(defaults)) errors.push("defaults must be a map of settings");
  else checkKeys(errors, "defaults", defaults, defaultKeys);
  checkCi(config.ci, errors);
  checkSkills(config.skills, errors);
  const declared = config.third_party_text ?? [];
  if (!Array.isArray(declared)) errors.push("third_party_text must be a list");
  else for (const source of declared) if (!thirdPartySources.includes(source)) errors.push(`third_party_text: unknown source ${JSON.stringify(source)} (known: ${thirdPartySources.join(", ")})`);
  const audits = config.audits ?? {};
  const names = Object.keys(audits).sort();
  if (names.length > auditsMax) errors.push(`more than ${auditsMax} audits`);
  const entries = [];
  for (const name of names) {
    if (!Object.hasOwn(knownAudits, name)) {
      errors.push(`audits.${name}: no such audit (known: ${Object.keys(knownAudits).join(", ")})`);
      continue;
    }
    const own = audits[name] ?? {};
    if (!isMap(own)) {
      errors.push(`audits.${name} must be a map of settings (at least a cron), got ${JSON.stringify(own)}`);
      continue;
    }
    checkKeys(errors, `audits.${name}`, own, auditKeys);
    const merged = { ...(isMap(defaults) ? defaults : {}), ...own };
    checkAuditEntry(name, merged, errors);
    entries.push({ audit: name, ...merged });
  }
  if (errors.length > 0) return { errors };
  return { ci: config.ci, skills: config.skills, declared: Array.isArray(declared) ? declared : [], entries };
}

// ---- cron ----

const cronFields = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "day of month", min: 1, max: 31 },
  { name: "month", min: 1, max: 12 },
  { name: "day of week", min: 0, max: 6 },
];

function expandPart(part, field) {
  const match = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(part);
  assert.ok(match, `${field.name} "${part}" is not a number, range, list or step`);
  const low = match[1] === "*" ? field.min : Number(match[2]);
  const high = match[1] === "*" ? field.max : match[3] === undefined ? (match[4] ? field.max : low) : Number(match[3]);
  const step = match[4] === undefined ? 1 : Number(match[4]);
  assert.ok(low >= field.min && high <= field.max && low <= high, `${field.name} "${part}" is outside ${field.min}-${field.max}`);
  assert.ok(step >= 1, `${field.name} "${part}" has a zero step`);
  const values = [];
  for (let value = low; value <= high; value += step) values.push(value);
  return values;
}

/** Five validated fields, each expanded to its set of values. Throws on an invalid cron. */
export function parseCron(cron) {
  assert.equal(typeof cron, "string", "cron must be a string");
  const parts = cron.trim().split(/\s+/);
  assert.equal(parts.length, cronFields.length, `"${cron}" must have five fields (minute hour day-of-month month day-of-week)`);
  assert.ok(/^\d+$/.test(parts[0]), `"${cron}": the minute must be one number, so an audit runs at most hourly; pick a minute off the hour`);
  const sets = parts.map((part, index) => new Set(part.split(",").flatMap((piece) => expandPart(piece, cronFields[index]))));
  // Like Vixie cron, a field starting with `*` (`*`, `*/2`) counts as unrestricted for the day OR rule.
  return { parts, sets, domAny: parts[2].startsWith("*"), dowAny: parts[4].startsWith("*") };
}

function firesOnDay(cron, month, dom, dow) {
  if (!cron.sets[3].has(month)) return false;
  const domHit = cron.sets[2].has(dom);
  const dowHit = cron.sets[4].has(dow);
  if (cron.domAny || cron.dowAny) return domHit && dowHit; // cron ORs the two only when both are restricted
  return domHit || dowHit;
}

/** True when two crons can fire in the same minute. */
export function cronsClash(a, b) {
  const intersects = (x, y) => [...x].some((value) => y.has(value));
  if (!intersects(a.sets[0], b.sets[0]) || !intersects(a.sets[1], b.sets[1])) return false;
  for (let month = 1; month <= 12; month += 1) {
    for (let dom = 1; dom <= 31; dom += 1) {
      for (let dow = 0; dow <= 6; dow += 1) if (firesOnDay(a, month, dom, dow) && firesOnDay(b, month, dom, dow)) return true;
    }
  }
  return false;
}

/** The cron clashOffsetMinutes later, skipping the top of the hour. An hourly cron (hour `*`) wraps its minute; otherwise throws when the move would cross into another hour it can't name, or another day. */
export function offsetCron(parts) {
  let minute = Number(parts[0]) + clashOffsetMinutes;
  let hour = parts[1];
  if (minute >= 60) {
    minute = Math.max(minute - 60, clashOffsetMinutes); // never the top of the hour
    if (hour === "*") return [String(minute), hour, ...parts.slice(2)];
    assert.ok(/^\d+$/.test(hour), `moving "${parts.join(" ")}" later crosses into the next hour, but the hour "${hour}" isn't one number; pick a minute that doesn't clash`);
    const next = Number(hour) + 1;
    const daily = parts.slice(2).every((part) => part === "*");
    assert.ok(next < 24 || daily, `moving "${parts.join(" ")}" later crosses midnight into another day; pick a minute that doesn't clash`);
    hour = String(next % 24);
  }
  return [String(minute), hour, ...parts.slice(2)];
}

/** Crons in audit-name order; a cron that clashes with an earlier one moves later (offsetCron). */
export function placeCrons(entries) {
  const placed = [];
  const offsets = [];
  const errors = [];
  for (const entry of entries) {
    let cron;
    try {
      cron = parseCron(entry.cron);
    } catch (error) {
      errors.push(`audits.${entry.audit}.cron: ${error.message}`);
      continue;
    }
    const original = cron.parts.join(" ");
    try {
      for (let attempt = 0; attempt <= clashAttemptsMax; attempt += 1) {
        const clash = placed.find((other) => cronsClash(other.parsed, cron));
        if (!clash) break;
        assert.ok(attempt < clashAttemptsMax, `still clashes after ${clashAttemptsMax} offsets`);
        if (attempt === 0) offsets.push({ audit: entry.audit, from: original, clashes_with: clash.audit });
        cron = parseCron(offsetCron(cron.parts).join(" "));
      }
    } catch (error) {
      errors.push(`audits.${entry.audit}.cron: ${error.message}`);
      continue;
    }
    const final = cron.parts.join(" ");
    if (final !== original) offsets.at(-1).to = final;
    placed.push({ ...entry, cron: final, parsed: cron });
  }
  return { placed: placed.map(({ parsed, ...entry }) => entry), offsets, errors };
}

// ---- third-party text in use ----

function readSmall(path) {
  try {
    if (statSync(path).size > manifestBytesMax) return "";
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function dependencyFiles(root, dir = root, depth = 0, found = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    assert.ok(found.length <= scanFilesMax, `more than ${scanFilesMax} dependency manifests under ${root}`);
    if (entry.isDirectory() && depth < scanDepthMax && !scanSkipDirs.has(entry.name)) dependencyFiles(root, join(dir, entry.name), depth + 1, found);
    else if (entry.isFile() && (dependencyManifests.has(entry.name) || /^requirements.*\.txt$/.test(entry.name))) found.push(join(dir, entry.name));
  }
  return found;
}

/** Third-party text sources the repo itself shows in use, each with the file that shows it. */
export function detectSources(root) {
  const detected = [];
  const mcp = readSmall(join(root, ".mcp.json"));
  if (/sentry/i.test(mcp)) detected.push({ source: "sentry", evidence: ".mcp.json" });
  if (/cloudflare/i.test(mcp)) detected.push({ source: "cloudflare-mcp", evidence: ".mcp.json" });
  if (!detected.some((item) => item.source === "sentry")) {
    const config = sentryConfigFiles.find((name) => existsSync(join(root, name)));
    const manifest = config ? null : dependencyFiles(root).find((path) => /@sentry\/|\bsentry[-_]|\bsentry\b/i.test(readSmall(path)));
    const evidence = config ?? (manifest ? manifest.slice(root.length + 1) : null);
    if (evidence) detected.push({ source: "sentry", evidence });
  }
  return detected;
}

// ---- plan ----

/** Which audits to schedule, at which cron; which are left out and why. Or { errors }. */
export function planSchedule(settings, detected) {
  const inUse = new Set([...settings.declared, ...detected.map((item) => item.source)]);
  const leftOut = [];
  const candidates = [];
  for (const entry of settings.entries) {
    const reads = [...new Set([...knownAudits[entry.audit].reads, ...(entry.reads ?? [])])].sort();
    const sources = reads.filter((source) => inUse.has(source));
    if (sources.length > 0) leftOut.push({ audit: entry.audit, sources });
    else candidates.push(entry);
  }
  const { placed, offsets, errors } = placeCrons(candidates);
  if (errors.length > 0) return { errors };
  return { scheduled: placed, leftOut, offsets };
}

// ---- render ----

const quote = (value) => `"${value}"`;

function promptFor(entry, ci) {
  return `/${entry.audit} headless${ci.dry_run ? " dry-run" : ""}`;
}

// Installs the skill folders each checkout's plugin manifest lists, flattened
// into .claude/skills/<name> as Fabrik installs them. Two sources naming the
// same skill is refused rather than one silently replacing the other.
const installScript = [
  "node -e '",
  "  const fs = require(\"node:fs\"), path = require(\"node:path\"), seen = new Set();",
  "  for (const root of process.argv.slice(1)) {",
  "    const manifest = JSON.parse(fs.readFileSync(path.join(root, \".claude-plugin/plugin.json\"), \"utf8\"));",
  "    for (const folder of manifest.skills) {",
  "      const name = path.basename(folder);",
  "      if (seen.has(name)) throw new Error(\"two skills would install as \" + name);",
  "      seen.add(name);",
  "      fs.rmSync(path.join(\".claude/skills\", name), { recursive: true, force: true });",
  "      fs.cpSync(path.join(root, folder), path.join(\".claude/skills\", name), { recursive: true });",
  "    }",
  "  }",
  `' ${skillsCheckoutDir} ${mattSkillsCheckoutDir}`,
];

function checkoutStep(name, source, dir) {
  return [
    `      - name: ${name}`,
    `        uses: ${actions.checkout}`,
    "        with:",
    `          repository: ${source.repository}`,
    `          ref: ${source.sha}`,
    `          path: ${dir}`,
    "          persist-credentials: false",
  ];
}

function setupSteps(settings) {
  const { ci, skills } = settings;
  return [
    "      - name: Check out the repo",
    `        uses: ${actions.checkout}`,
    "        with:",
    "          fetch-depth: 0 # incremental scope diffs against the last audited commit",
    "          persist-credentials: false",
    ...checkoutStep("Check out the audit skills", skills, skillsCheckoutDir),
    ...checkoutStep("Check out Matt Pocock's skills, which the audits call by name", skills.matt, mattSkillsCheckoutDir),
    `      - uses: ${actions.setupNode}`,
    "        with:",
    `          node-version: ${quote(nodeVersion)}`,
    "      - name: Install both skill sets into .claude/skills",
    "        run: |",
    "          mkdir -p .claude/skills",
    ...installScript.map((line) => `          ${line}`),
    `          rm -rf ${skillsCheckoutDir} ${mattSkillsCheckoutDir}`,
    "      - name: Install Claude Code",
    `        run: npm install --global @anthropic-ai/claude-code@${ci.claude_code_version}`,
  ];
}

function tokenSteps(ci) {
  const steps = [
    "      - name: Load the Claude subscription token from 1Password",
    "        id: op",
    `        uses: ${actions.loadSecrets}`,
    "        with:",
    "          export-env: false",
    "        env:",
    "          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}",
    `          CLAUDE_CODE_OAUTH_TOKEN: ${ci.claude_token}`,
  ];
  if (ci.github_auth !== "app") return steps;
  return [
    ...steps,
    "      - name: Mint the audit GitHub App token",
    "        id: github",
    `        uses: ${actions.appToken}`,
    "        with:",
    "          client-id: ${{ vars.AUDITS_APP_CLIENT_ID }}",
    "          private-key: ${{ secrets.AUDITS_APP_PRIVATE_KEY }}",
    "          permission-issues: write",
  ];
}

function renderJob(entry, settings) {
  const { ci } = settings;
  const githubToken = ci.github_auth === "app" ? "${{ steps.github.outputs.token }}" : "${{ secrets.AUDITS_GITHUB_TOKEN }}";
  return [
    `  ${entry.audit}:`,
    `    if: github.event.schedule == '${entry.cron}' || inputs.audit == '${entry.audit}'`,
    `    runs-on: ${ci.runner}`,
    "    concurrency:",
    `      group: audits-${entry.audit}`,
    "      cancel-in-progress: false",
    `    timeout-minutes: ${entry.timeout_minutes}`,
    "    steps:",
    ...setupSteps(settings),
    "      - name: Check the audit still reads no third-party text in use",
    `        run: node ${rendererScript} --check-audit ${entry.audit}`,
    ...tokenSteps(ci),
    `      - name: Run ${entry.audit}`,
    "        env:",
    "          CLAUDE_CODE_OAUTH_TOKEN: ${{ steps.op.outputs.CLAUDE_CODE_OAUTH_TOKEN }}",
    `          GH_TOKEN: ${githubToken}`,
    "          TMPDIR: ${{ runner.temp }}",
    '          AUDITS_HEADLESS: "1"',
    `          AUDITS_DRY_RUN: ${quote(String(ci.dry_run))}`,
    "        run: >-",
    `          claude -p ${quote(promptFor(entry, ci))}`,
    `          --model ${entry.model}`,
    `          --max-turns ${entry.max_turns}`,
    `          --allowedTools ${quote(allowedTools.join(","))}`,
    `          --disallowedTools ${quote(disallowedTools.join(","))}`,
  ];
}

function headerLines(plan) {
  const lines = [
    "# Rendered by the schedule-audits skill from docs/agents/audits.md. Don't edit",
    "# this file: edit docs/agents/audits.md and run /schedule-audits again.",
    "# Crons are UTC.",
  ];
  for (const offset of plan.offsets) lines.push(`# ${offset.audit}: cron moved from "${offset.from}" to "${offset.to}" (clashed with ${offset.clashes_with}).`);
  if (plan.leftOut.length > 0) lines.push("# Left out, because they read text others wrote (run them interactively):");
  for (const item of plan.leftOut) lines.push(`#   ${item.audit}: ${item.sources.join(", ")}`);
  return lines;
}

/** The workflow text for a plan with at least one scheduled audit. Pure. */
export function renderWorkflow(plan, settings) {
  assert.ok(plan.scheduled.length > 0, "nothing to schedule");
  const lines = [...headerLines(plan), "name: audits", "", "on:", "  schedule:"];
  for (const entry of plan.scheduled) lines.push(`    - cron: ${quote(entry.cron)} # ${entry.audit}`);
  lines.push("  workflow_dispatch:", "    inputs:", "      audit:", "        description: The audit to run now", "        required: true", "        type: choice", "        options:");
  for (const entry of plan.scheduled) lines.push(`          - ${entry.audit}`);
  lines.push("", "permissions:", "  contents: read", "", "jobs:");
  plan.scheduled.forEach((entry, index) => {
    if (index > 0) lines.push("");
    lines.push(...renderJob(entry, settings));
  });
  return `${lines.join("\n")}\n`;
}

// ---- CLI ----

export function parseArgs(argv) {
  const options = { repo: ".", check: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--check") options.check = true;
    else if (argv[index] === "--repo" && argv[index + 1]) options.repo = argv[(index += 1)];
    else if (argv[index] === "--check-audit" && argv[index + 1]) options.checkAudit = argv[(index += 1)];
    else throw new Error(`unknown argument ${JSON.stringify(argv[index])}`);
  }
  return options;
}

function writeResult(root, rendered, check) {
  const target = join(root, workflowPath);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (rendered === current) return "unchanged";
  if (rendered === null) {
    if (check) return "would-remove";
    rmSync(target);
    return "removed";
  }
  if (check) return current === null ? "would-create" : "would-change";
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, rendered);
  return current === null ? "created" : "changed";
}

/** Whether one audit would still be scheduled: what each rendered job checks before it runs. */
function checkAudit(audit, plan, detected) {
  const leftOut = plan.leftOut.find((item) => item.audit === audit);
  if (leftOut) {
    const evidence = detected.filter((item) => leftOut.sources.includes(item.source)).map((item) => `${item.source} (${item.evidence})`);
    return { status: "left-out", audit, sources: leftOut.sources, detected: evidence,
      message: `${audit} reads ${leftOut.sources.join(", ")}, now in use; run /schedule-audits again to take it off the schedule` };
  }
  if (!plan.scheduled.some((entry) => entry.audit === audit)) return { status: "not-scheduled", audit, message: `${audit} is not in ${configPath}` };
  return { status: "scheduled", audit };
}

/** Reads, validates, plans and writes. Returns the summary, or { errors }. */
export function run({ repo, check, checkAudit: auditToCheck }) {
  const root = resolve(repo);
  const config = join(root, configPath);
  if (!existsSync(config)) return { errors: [`${configPath} is missing; seed it from the schedule-audits template first`] };
  const settings = readSettings(readConfig(readFileSync(config, "utf8")));
  if (settings.errors) return settings;
  const detected = detectSources(root);
  const plan = planSchedule(settings, detected);
  if (plan.errors) return plan;
  if (auditToCheck !== undefined) return checkAudit(auditToCheck, plan, detected);
  const rendered = plan.scheduled.length > 0 ? renderWorkflow(plan, settings) : null;
  const status = writeResult(root, rendered, check);
  return {
    status,
    workflow: workflowPath,
    dry_run: settings.ci.dry_run,
    scheduled: plan.scheduled.map(({ audit, cron, model }) => ({ audit, cron, model })),
    left_out: plan.leftOut,
    offsets: plan.offsets,
    detected,
  };
}

function main() {
  let result;
  try {
    result = run(parseArgs(process.argv.slice(2)));
  } catch (error) {
    result = { errors: [error.message] };
  }
  if (result.errors) {
    for (const error of result.errors) console.error(`refused: ${error}`);
    console.error(`\nNothing was written. Fix ${configPath} and run again.`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status.startsWith("would-")) process.exit(2);
  if (result.status === "left-out" || result.status === "not-scheduled") process.exit(3);
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
