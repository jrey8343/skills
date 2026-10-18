#!/usr/bin/env node
// Joins the synthesize-backlog stage files in a run directory: checks them, rebuilds merged
// candidates from the lens threads, applies the survival rule, tracks coverage, writes
// synthesis.json, and renders thread tracker bodies. Zero dependencies; needs Node 22+.
//
// Usage (<run> is the run directory; N is a page number, from 1):
//   assemble.mjs issue <run> <number> [--page N]   one issue in full, paged
//   assemble.mjs digests <run> [--page N]           every digest, one compact line each, paged
//   assemble.mjs threads <run> [--page N]           every lens thread with its ref, paged
//   assemble.mjs check <run> --stage digests|lenses report missing or malformed stage files
//   assemble.mjs merge <run>                        grouping.json + threads/ -> candidates/
//   assemble.mjs critic-candidates <run>            critic.json new threads -> candidates/
//   assemble.mjs coverage <run>                     verdicts/ -> coverage.json, unassigned.json
//   assemble.mjs final <run> [--repo OWNER/NAME] [--sha SHA] [--date YYYY-MM-DD]
//   assemble.mjs summary <run> [--page N]           what the reply leads with, from synthesis.json
//   assemble.mjs tracker <run> <id> --picked <id,id,...>   a thread tracker's body file and attach plan
//
// Every command exits 1 when a stage file is malformed or the stage is incomplete, naming the
// file, so the orchestrator knows which agent to dispatch again.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, realpathSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { renderIssueFull } from "./batch-issues.mjs";

export const membersMin = 3;
export const candidatesMax = 150;
export const lensThreadsMax = 400;
export const evidenceKeptMax = 14;
export const pageCharsMax = 24_000; // Under a typical 30,000-character tool-output cap.
// An open-now list may drop up to max(closedCountFloor, closedFractionMax of the snapshot); more
// than that is a list cut short by a default limit, not issues closed during the run.
export const closedFractionMax = 0.2;
export const closedCountFloor = 5;
export const subIssuesMax = 100; // GitHub's limit per parent issue.
export const trackerBodyBytesMax = 60_000; // GitHub caps an issue body at 65,536 characters.
export const titleCharsMax = 256; // GitHub's issue title limit.
export const shaCharsShown = 12;
export const slugCharsMax = 40;
export const filesMax = 500;
export const lenses = ["architecture", "domain-invariants", "identity-access", "runtime-robustness", "delivery-system", "product-journeys"];
export const strengths = ["Strong", "Worth exploring", "Speculative"];
const states = ["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "tracker", "unlabelled"];
const kinds = ["bug", "missing-guard", "data-repair", "decision", "test-gap", "docs-drift", "process", "refactor", "feature", "external-check", "tracker"];
const severities = ["critical", "high", "medium", "low"];
const sizes = ["S", "M", "L", "XL"];
const fits = ["full", "partial"];
const resolutions = ["full", "partial", "no"];
const entryPoints = ["implement", "to-spec", "wayfinder"];
const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ---------- small helpers ----------

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path}: ${error.message}`);
  }
};
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 1)}\n`);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isIssueNumber = (value) => Number.isInteger(value) && value > 0;
const unique = (values) => [...new Set(values)];
const byNumber = (a, b) => a - b;

function jsonFiles(dir) {
  if (!existsSync(dir)) return [];
  const names = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  assert.ok(names.length <= filesMax, `${dir} holds ${names.length} files, more than ${filesMax}`);
  return names;
}

function objectFile(path, where) {
  const value = readJson(path);
  if (!isObject(value)) throw new Error(`${where}: must be a JSON object`);
  return value;
}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, slugCharsMax).replace(/-$/, "");
}

// Pure: splits lines into pages of at most charsMax characters, breaking any longer line.
export function pageLines(lines, charsMax = pageCharsMax) {
  const pages = [];
  let page = [];
  let chars = 0;
  for (const whole of lines) {
    const pieces = whole.length <= charsMax ? [whole] : whole.match(new RegExp(`[\\s\\S]{1,${charsMax}}`, "g"));
    for (const line of pieces) {
      if (page.length > 0 && chars + line.length + 1 > charsMax) {
        pages.push(page);
        page = [];
        chars = 0;
      }
      page.push(line);
      chars += line.length + 1;
    }
  }
  if (page.length > 0 || pages.length === 0) pages.push(page);
  return pages;
}

function printPage(lines, pageText, what) {
  const pages = pageLines(lines);
  const page = Number(pageText ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > pages.length) throw new Error(`--page must be from 1 to ${pages.length}`);
  for (const line of pages[page - 1]) console.log(line);
  const next = page < pages.length ? `: run again with --page ${page + 1}` : `: all ${what} read`;
  console.log(`# page ${page} of ${pages.length}${next}`);
}

function flag(rest, name) {
  const index = rest.indexOf(name);
  if (index === -1) return undefined;
  const value = rest[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${name} needs a value`);
  return value;
}

// ---------- validators (pure; each returns a list of problems) ----------

export function digestProblems(digest, where) {
  if (!isObject(digest)) return [`${where}: must be an object`];
  const problems = [];
  for (const field of ["title", "symptom", "mechanism", "cause_hint"]) {
    if (typeof digest[field] !== "string") problems.push(`${where}: ${field} must be a string`);
  }
  if (!isIssueNumber(digest.number)) problems.push(`${where}: number must be a positive integer`);
  if (!states.includes(digest.state)) problems.push(`${where}: state must be one of ${states.join(", ")}`);
  if (!kinds.includes(digest.kind)) problems.push(`${where}: kind must be one of ${kinds.join(", ")}`);
  if (!severities.includes(digest.severity)) problems.push(`${where}: severity must be one of ${severities.join(", ")}`);
  return problems;
}

export function threadProblems(thread, where) {
  if (!isObject(thread)) return [`${where}: must be an object`];
  const problems = [];
  for (const field of ["name", "root_cause", "structural_change"]) {
    if (typeof thread[field] !== "string" || thread[field] === "") problems.push(`${where}: ${field} must be a non-empty string`);
  }
  if (!Array.isArray(thread.members)) return [...problems, `${where}: members must be an array`];
  thread.members.forEach((member, index) => {
    if (!isIssueNumber(member?.number)) problems.push(`${where}.members[${index}]: number must be a positive integer`);
    if (!fits.includes(member?.fit)) problems.push(`${where}.members[${index}]: fit must be full or partial`);
  });
  return problems;
}

export function verdictProblems(skeptic, fit, candidate) {
  const where = `verdicts/${candidate.id}`;
  const problems = [];
  if (!isObject(skeptic) || typeof skeptic.refuted !== "boolean") problems.push(`${where}.skeptic.json: refuted must be a boolean`);
  if (!isObject(fit) || !Array.isArray(fit.member_fit)) return [...problems, `${where}.fit.json: member_fit must be an array`];
  const seen = new Map();
  for (const entry of fit.member_fit) {
    if (!isIssueNumber(entry?.number)) problems.push(`${where}.fit.json: member_fit numbers must be positive integers`);
    else seen.set(entry.number, (seen.get(entry.number) ?? 0) + 1);
    if (!resolutions.includes(entry?.resolves)) problems.push(`${where}.fit.json: #${entry?.number} resolves must be full, partial or no`);
  }
  for (const member of candidate.members) {
    if (seen.get(member.number) !== 1) problems.push(`${where}.fit.json: member #${member.number} must appear exactly once in member_fit`);
  }
  for (const entry of arrayOr(fit.additional_members)) {
    if (!isIssueNumber(entry?.number) || !fits.includes(entry?.resolves)) problems.push(`${where}.fit.json: additional_members need an integer number and resolves full or partial`);
  }
  if (!entryPoints.includes(fit.entry_point)) problems.push(`${where}.fit.json: entry_point must be one of ${entryPoints.join(", ")}`);
  if (!sizes.includes(fit.size)) problems.push(`${where}.fit.json: size must be one of ${sizes.join(", ")}`);
  problems.push(...listProblems(fit, `${where}.fit.json`, { additional_members: isObject, supersedes: isIssueNumber, depends_on: isString, open_decisions: isString, files_touched_estimate: isString }));
  if (isObject(skeptic)) problems.push(...listProblems(skeptic, `${where}.skeptic.json`, { weakest_members: isIssueNumber, code_evidence: isString, adr_conflicts: isString }));
  return problems;
}

const isString = (value) => typeof value === "string";
const arrayOr = (value) => (Array.isArray(value) ? value : []);

// Each named field, when present, must be an array whose entries pass its check.
function listProblems(record, where, checks) {
  const problems = [];
  for (const [field, check] of Object.entries(checks)) {
    if (record[field] === undefined) continue;
    if (!Array.isArray(record[field]) || !record[field].every(check)) problems.push(`${where}: ${field} must be an array of ${check === isString ? "strings" : check === isIssueNumber ? "issue numbers" : "objects"}`);
  }
  return problems;
}

export function groupingProblems(grouping) {
  if (!isObject(grouping)) return ["grouping.json: must be a JSON object"];
  const problems = [];
  if (!Array.isArray(grouping.rejected ?? [])) problems.push("grouping.json: rejected must be an array");
  if (!Array.isArray(grouping.candidates)) return [...problems, "grouping.json: candidates must be an array"];
  grouping.candidates.forEach((candidate, index) => {
    const where = `grouping.json candidates[${index}]`;
    if (!isObject(candidate)) { problems.push(`${where}: must be an object`); return; }
    problems.push(...listProblems(candidate, where, { source_refs: isString, drop_members: isIssueNumber, add_members: isIssueNumber, existing_proposals: isIssueNumber, overlaps: isString }));
  });
  return problems;
}

export function criticProblems(critic) {
  if (!isObject(critic)) return ["critic.json: must be a JSON object"];
  const problems = [];
  const list = (field) => {
    const value = critic[field] ?? [];
    if (Array.isArray(value)) return value;
    problems.push(`critic.json: ${field} must be an array`);
    return [];
  };
  list("new_threads").forEach((thread, index) => problems.push(...threadProblems(thread, `critic.json new_threads[${index}]`)));
  for (const entry of list("standalone")) {
    if (!isIssueNumber(entry?.number) || typeof entry?.reason !== "string") problems.push("critic.json: standalone entries need an integer number and a reason");
  }
  for (const entry of list("missing_from_candidates")) {
    if (!isIssueNumber(entry?.number) || typeof entry?.candidate_id !== "string") problems.push("critic.json: missing_from_candidates entries need a candidate_id and an integer number");
  }
  return problems;
}

export function rankingProblems(ranking) {
  if (!isObject(ranking)) return ["ranking.json: must be a JSON object"];
  const problems = [];
  if (!Array.isArray(ranking.ranking)) return ["ranking.json: ranking must be an array"];
  const ranks = new Set();
  for (const entry of ranking.ranking) {
    if (typeof entry?.id !== "string") problems.push("ranking.json: every entry needs a string id");
    if (!Number.isInteger(entry?.rank) || entry.rank < 1 || ranks.has(entry.rank)) problems.push(`ranking.json: ${entry?.id} needs a unique integer rank from 1`);
    ranks.add(entry?.rank);
    if (!strengths.includes(entry?.strength)) problems.push(`ranking.json: ${entry?.id} strength must be one of ${strengths.join(", ")}`);
  }
  for (const field of ["sequencing", "top_recommendation", "triage_implication"]) {
    if (typeof ranking[field] !== "string") problems.push(`ranking.json: ${field} must be a string`);
  }
  if (!Array.isArray(ranking.urgent)) problems.push("ranking.json: urgent must be an array, [] when nothing is urgent");
  for (const entry of ranking.urgent ?? []) {
    if (!isIssueNumber(entry?.number) || typeof entry?.why !== "string") problems.push("ranking.json: urgent entries need an integer number and a why");
  }
  for (const entry of ranking.owners ?? []) {
    if (!isIssueNumber(entry?.number) || typeof entry?.id !== "string") problems.push("ranking.json: owners entries need an integer number and an id");
  }
  return problems;
}

// gh prints [1, 2] with --jq '[.[].number]' and [{ "number": 1 }] without it; both are accepted.
export function openNowNumbers(raw) {
  assert.ok(Array.isArray(raw), "open-now.json: must be a JSON array");
  const numbers = raw.map((entry) => (isObject(entry) ? entry.number : entry));
  assert.ok(numbers.every(isIssueNumber), "open-now.json: entries must be issue numbers or { number }");
  return numbers;
}

// ---------- core (pure) ----------

export function checkRun({ manifest, digests, lensThreads, stage }) {
  const expected = manifest.batches.flatMap((batch) => batch.numbers);
  const expectedSet = new Set(expected);
  const missing = expected.filter((number) => !digests.byNumber.has(number));
  const extra = [...digests.byNumber.keys()].filter((number) => !expectedSet.has(number));
  const incomplete = manifest.batches.filter((batch) => batch.numbers.some((number) => !digests.byNumber.has(number))).map((batch) => batch.batch);
  const redo = [...new Set([...incomplete, ...digests.redoBatches])].sort(byNumber);
  const report = { digests: { expected: expected.length, got: digests.byNumber.size, missing, extra, redo_batches: redo }, problems: [...digests.problems] };
  let ok = missing.length === 0 && extra.length === 0 && digests.problems.length === 0;
  if (stage === "lenses") {
    const absent = lenses.filter((lens) => !lensThreads.present.includes(lens));
    report.lenses = { present: lensThreads.present, missing: absent, threads: lensThreads.byRef.size, non_issue_members: lensThreads.nonIssueMembers };
    report.problems.push(...lensThreads.problems);
    ok = ok && absent.length === 0 && lensThreads.problems.length === 0;
  }
  return { report, ok };
}

// Members are rebuilt from the lens threads (a full fit wins over a partial), so the merge agent
// only ever writes the grouping. Expected mistakes come back as lists, not throws.
export function buildCandidates(grouping, threadByRef, isWorkItem = () => true) {
  const result = { candidates: [], unknownRefs: [], unplacedRefs: [], contradictoryRefs: [], badIds: [], duplicateIds: [], tooSmall: [], nonIssueMembers: [] };
  const rejected = new Set();
  for (const rejection of grouping.rejected ?? []) {
    rejected.add(rejection?.ref);
    if (!threadByRef.has(rejection?.ref)) result.unknownRefs.push(rejection?.ref);
  }
  const placed = new Set(rejected);
  const ids = new Set();
  for (const group of grouping.candidates) {
    if (!kebab.test(group?.id ?? "")) { result.badIds.push(group?.id ?? null); continue; }
    if (ids.has(group.id)) { result.duplicateIds.push(group.id); continue; }
    ids.add(group.id);
    const sources = [];
    for (const ref of group.source_refs ?? []) {
      if (rejected.has(ref)) result.contradictoryRefs.push(ref);
      placed.add(ref);
      if (threadByRef.has(ref)) sources.push(threadByRef.get(ref));
      else result.unknownRefs.push(ref);
    }
    const candidate = candidateFromSources(group, sources, isWorkItem, result.nonIssueMembers);
    if (candidate.members.length >= membersMin) result.candidates.push(candidate);
    else result.tooSmall.push({ id: group.id, name: group.name ?? group.id });
  }
  assert.ok(result.candidates.length <= candidatesMax, `${result.candidates.length} candidates exceeds ${candidatesMax}`);
  result.unplacedRefs = [...threadByRef.keys()].filter((ref) => !placed.has(ref));
  const problemLists = [result.unknownRefs, result.unplacedRefs, result.contradictoryRefs, result.badIds, result.duplicateIds];
  result.ok = problemLists.every((list) => list.length === 0);
  return result;
}

function candidateFromSources(group, sources, isWorkItem, nonIssueMembers) {
  const drop = new Set(group.drop_members ?? []);
  const members = new Map();
  const consider = (member) => {
    if (drop.has(member.number)) return;
    if (!isWorkItem(member.number)) { nonIssueMembers.push({ id: group.id, number: member.number }); return; }
    const previous = members.get(member.number);
    if (!previous || (previous.fit === "partial" && member.fit === "full")) members.set(member.number, { ...member });
  };
  for (const thread of sources) thread.members.forEach(consider);
  for (const number of group.add_members ?? []) {
    if (!members.has(number)) consider({ number, fit: "partial", how: "added in merge" });
  }
  return {
    id: group.id, name: group.name, root_cause: group.root_cause, structural_change: group.structural_change,
    members: [...members.values()].sort((a, b) => a.number - b.number),
    existing_proposals: unique([...(group.existing_proposals ?? []), ...sources.flatMap((thread) => thread.existing_proposals ?? [])]),
    found_by_lenses: unique(sources.map((thread) => thread.lens)),
    overlaps: group.overlaps ?? [],
    evidence: unique(sources.flatMap((thread) => thread.evidence ?? [])).slice(0, evidenceKeptMax),
    origin: "merge",
  };
}

// The id comes from the name alone, so a critic that reorders its threads keeps their verdicts.
export function candidateFromThread(thread, isWorkItem = () => true) {
  return {
    id: `critic-${slugify(thread.name)}`,
    name: thread.name, root_cause: thread.root_cause, structural_change: thread.structural_change,
    members: thread.members.filter((member) => isWorkItem(member.number)).sort((a, b) => a.number - b.number),
    existing_proposals: thread.existing_proposals ?? [], found_by_lenses: [], overlaps: [],
    evidence: (thread.evidence ?? []).slice(0, evidenceKeptMax), origin: "critic",
  };
}

// Distinct work items a fit resolves, each at its best resolution.
export function resolvedIssues(fit, isWorkItem = () => true) {
  const best = new Map();
  for (const entry of [...fit.member_fit, ...(fit.additional_members ?? [])]) {
    if (entry.resolves === "no" || !isWorkItem(entry.number)) continue;
    const previous = best.get(entry.number);
    if (!previous || (previous.resolves === "partial" && entry.resolves === "full")) best.set(entry.number, { number: entry.number, resolves: entry.resolves });
  }
  return [...best.values()].sort((a, b) => a.number - b.number);
}

// The survival rule: the skeptic does not refute, and at least membersMin work items resolve.
export function survival(skeptic, fit, isWorkItem = () => true) {
  if (skeptic.refuted) return { survives: false, reason: `skeptic: ${skeptic.verdict ?? "refuted"}` };
  const resolved = resolvedIssues(fit, isWorkItem);
  if (resolved.length < membersMin) return { survives: false, reason: `only ${resolved.length} issues resolved, fewer than ${membersMin}` };
  return { survives: true, reason: "" };
}

export const verifiedCause = (candidate, skeptic) => skeptic?.actual_shared_cause || candidate.root_cause;

export function computeCoverage({ workItems, candidates, verdicts, critic }) {
  const isWorkItem = (number) => workItems.has(number);
  const coverage = { survivors: [], dropped: [], pending: [], claims: new Map(), outside: [] };
  const claim = (number, id, resolves) => {
    const list = coverage.claims.get(number) ?? [];
    if (!list.some((entry) => entry.id === id)) list.push({ id, resolves });
    coverage.claims.set(number, list);
  };
  for (const candidate of candidates) {
    const verdict = verdicts.get(candidate.id);
    if (!verdict) { coverage.pending.push(candidate.id); continue; }
    const extra = [...verdict.fit.member_fit, ...(verdict.fit.additional_members ?? [])].filter((entry) => !isWorkItem(entry.number));
    coverage.outside.push(...extra.map((entry) => ({ id: candidate.id, number: entry.number })));
    const outcome = survival(verdict.skeptic, verdict.fit, isWorkItem);
    if (!outcome.survives) { coverage.dropped.push({ id: candidate.id, name: candidate.name, reason: outcome.reason }); continue; }
    coverage.survivors.push(candidate.id);
    for (const entry of resolvedIssues(verdict.fit, isWorkItem)) claim(entry.number, candidate.id, entry.resolves);
  }
  for (const late of critic?.missing_from_candidates ?? []) {
    if (coverage.survivors.includes(late.candidate_id) && isWorkItem(late.number)) claim(late.number, late.candidate_id, "partial");
  }
  const standalone = new Set((critic?.standalone ?? []).map((entry) => entry.number));
  coverage.unassigned = [...workItems].filter((number) => !coverage.claims.has(number)).sort(byNumber);
  coverage.unplaced = critic ? coverage.unassigned.filter((number) => !standalone.has(number)) : coverage.unassigned;
  assert.ok(coverage.claims.size <= workItems.size, "claims cover more issues than the snapshot holds");
  return coverage;
}

// Who owns an issue two or more threads claim: the ranking's choice, else the best-ranked
// thread that resolves it fully, else the best-ranked thread.
export function ownersOf(claims, rankOf, rankingOwners = []) {
  const chosen = new Map(rankingOwners.map((entry) => [entry.number, entry.id]));
  const owners = {};
  for (const [number, list] of claims) {
    if (list.length < 2) continue;
    const ordered = [...list].sort((a, b) => rankOf(a.id) - rankOf(b.id));
    const fallback = (ordered.find((entry) => entry.resolves === "full") ?? ordered[0]).id;
    owners[number] = list.some((entry) => entry.id === chosen.get(number)) ? chosen.get(number) : fallback;
  }
  return owners;
}

export function buildSynthesis(inputs) {
  const { meta, manifest, snapshot, digests, candidates, verdicts, critic, ranking, grouping, mergeReport, threadByRef, openNow } = inputs;
  const workNumbers = manifest.batches.flatMap((batch) => batch.numbers);
  const workItems = new Set(workNumbers);
  const coverage = computeCoverage({ workItems, candidates, verdicts, critic });
  const refuse = (list, message) => {
    if (list.length > 0) throw new Error(`${message}: ${list.join(", ")}`);
  };
  refuse(coverage.pending, "candidates with no verdicts (verify them, or delete their candidate files)");
  const ranked = new Map(ranking.ranking.map((entry) => [entry.id, entry]));
  refuse(coverage.survivors.filter((id) => !ranked.has(id)), "survivors missing from ranking.json");
  refuse([...ranked.keys()].filter((id) => !coverage.survivors.includes(id)), "ranking.json ranks candidates that did not survive");
  const threads = coverage.survivors.map((id) => threadEntry(candidates.find((candidate) => candidate.id === id), verdicts.get(id), ranked.get(id)));
  threads.sort((a, b) => a.rank - b.rank);
  const closed = closedSinceSnapshot(workNumbers, openNow);
  const issues = workNumbers.slice().sort(byNumber).map((number) => issueEntry(number, snapshot.get(number), digests.get(number)));
  const needsTriage = issues.filter((issue) => issue.state === "needs-triage").map((issue) => issue.number);
  const rankOf = (id) => ranked.get(id).rank;
  const tooSmall = (mergeReport?.too_small ?? []).map((entry) => ({ ref: entry.id, name: entry.name, reason: `under ${membersMin} members once the merge trimmed it` }));
  return {
    meta: { ...meta, snapshot_count: manifest.total, skipped_count: manifest.skipped.length },
    counts: {
      work_items: issues.length, lens_threads: threadByRef.size, candidates: candidates.length, survived: threads.length,
      covered: coverage.claims.size, needs_triage: needsTriage.length, needs_triage_covered: needsTriage.filter((number) => coverage.claims.has(number)).length,
    },
    threads,
    claims: Object.fromEntries(coverage.claims),
    owners: ownersOf(coverage.claims, rankOf, ranking.owners),
    dropped: coverage.dropped,
    rejected: [...(grouping?.rejected ?? []).map((entry) => ({ ref: entry.ref, name: threadByRef.get(entry.ref)?.name ?? entry.ref, reason: entry.reason ?? "" })), ...tooSmall],
    standalone: (critic?.standalone ?? []).filter((entry) => workItems.has(entry.number)),
    late_members: (critic?.missing_from_candidates ?? []).filter((late) => coverage.survivors.includes(late.candidate_id) && workItems.has(late.number)),
    unplaced: coverage.unplaced,
    closed_since_snapshot: closed,
    issues,
    ranking: { sequencing: ranking.sequencing, top_recommendation: ranking.top_recommendation, triage_implication: ranking.triage_implication, urgent: ranking.urgent },
  };
}

function closedSinceSnapshot(workNumbers, openNow) {
  if (!openNow) return [];
  const open = new Set(openNow);
  const closed = workNumbers.filter((number) => !open.has(number));
  if (closed.length > Math.max(closedCountFloor, closedFractionMax * workNumbers.length)) {
    throw new Error(`open-now.json lists ${openNow.length} issues, so ${closed.length} of ${workNumbers.length} would show as closed: did the list stop at a default limit? (gh issue list returns 30 without --limit)`);
  }
  return closed.sort(byNumber);
}

function issueEntry(number, snapshotIssue, digest) {
  return {
    number, title: snapshotIssue?.title ?? digest?.title ?? "", state: digest?.state ?? "unlabelled", severity: digest?.severity ?? "",
    kind: digest?.kind ?? "", cause_hint: digest?.cause_hint ?? "", parent: snapshotIssue?.parent ?? null, sub_issues: snapshotIssue?.sub_issues ?? [],
  };
}

function threadEntry(candidate, verdict, rank) {
  const { skeptic, fit } = verdict;
  return {
    id: candidate.id, rank: rank.rank, strength: rank.strength, leverage_note: rank.leverage_note ?? "",
    name: candidate.name, lenses: candidate.found_by_lenses, origin: candidate.origin,
    cause: verifiedCause(candidate, skeptic), change: fit.change_outline || candidate.structural_change,
    size: fit.size, entry: fit.entry_point,
    members: fit.member_fit, added: fit.additional_members ?? [],
    supersedes: fit.supersedes ?? [], depends_on: fit.depends_on ?? [], open_decisions: fit.open_decisions ?? [],
    files: fit.files_touched_estimate ?? [], evidence: skeptic.code_evidence ?? [],
    weakest: skeptic.weakest_members ?? [], adr_conflicts: skeptic.adr_conflicts ?? [],
    existing_proposals: candidate.existing_proposals, overlaps: candidate.overlaps,
  };
}

// A title for the shell: control characters gone, capped at GitHub's limit, and single-quoted
// so a backtick or $( in an agent-written name stays text.
export function shellTitle(name) {
  const title = String(name ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, titleCharsMax);
  return { title, title_shell: `'${title.replace(/'/g, "'\\''")}'` };
}

// Who owns each member among the threads the user picked: an owner left unpicked gives way to
// the best-ranked picked claimant, so no member is left attached to nothing.
function pickedOwners(synthesis, picked) {
  const rankOf = new Map(synthesis.threads.map((thread) => [thread.id, thread.rank]));
  const pickedClaims = new Map(Object.entries(synthesis.claims).map(([number, list]) => [Number(number), list.filter((entry) => picked.has(entry.id))]));
  const preferred = Object.entries(synthesis.owners).map(([number, id]) => ({ number: Number(number), id }));
  return ownersOf(pickedClaims, (id) => rankOf.get(id), preferred);
}

// The issues a thread tracker attaches, and those it only lists, with the reason.
export function trackerPlan(synthesis, id, pickedIds = [id]) {
  const thread = synthesis.threads.find((entry) => entry.id === id);
  assert.ok(thread, `no surviving thread with id ${id}`);
  const picked = new Set([...pickedIds, id]);
  const owners = pickedOwners(synthesis, picked);
  const issues = new Map(synthesis.issues.map((issue) => [issue.number, issue]));
  const closed = new Set(synthesis.closed_since_snapshot);
  const existing = thread.existing_proposals.filter((number) => {
    const issue = issues.get(number);
    return issue !== undefined && (issue.state === "tracker" || issue.sub_issues.length > 0);
  });
  const claimed = Object.entries(synthesis.claims).filter(([, list]) => list.some((entry) => entry.id === id)).map(([number]) => Number(number)).sort(byNumber);
  const attach = [];
  const listed = [];
  for (const number of claimed) {
    const owner = owners[number] ?? id;
    const parent = issues.get(number)?.parent;
    if (existing.includes(number)) listed.push({ number, reason: "the existing tracker" });
    else if (closed.has(number)) listed.push({ number, reason: "closed since the snapshot" });
    else if (owner !== id) listed.push({ number, reason: `owned by thread ${owner}` });
    else if (parent) listed.push({ number, reason: `already under #${parent}` });
    else if (attach.length >= subIssuesMax) listed.push({ number, reason: `over the ${subIssuesMax} sub-issue limit` });
    else attach.push(number);
  }
  return { thread, ...shellTitle(thread.name), attach, listed, existing_trackers: existing };
}

const neutraliseMentions = (text) => String(text ?? "").replace(/@(?=[A-Za-z0-9-])/g, "@​");

function memberLines(synthesis, plan) {
  const { thread } = plan;
  const listedReason = new Map(plan.listed.map((entry) => [entry.number, entry.reason]));
  const resolution = new Map(Object.entries(synthesis.claims).map(([number, list]) => [Number(number), list.find((entry) => entry.id === thread.id)?.resolves]));
  const remainder = new Map([...thread.members.map((entry) => [entry.number, entry.remainder]), ...thread.added.map((entry) => [entry.number, entry.why])]);
  return [...plan.attach, ...plan.listed.map((entry) => entry.number)].sort(byNumber).map((number) => {
    const fit = resolution.get(number) === "full" ? "fully" : `partly. Still left: ${remainder.get(number) || "see the thread"}`;
    const note = listedReason.has(number) ? ` (listed here only: ${listedReason.get(number)})` : "";
    return `- #${number}: ${fit}${note}`;
  });
}

export function trackerBody(synthesis, plan) {
  const { thread } = plan;
  const members = memberLines(synthesis, plan);
  const { date, sha } = synthesis.meta;
  const footer = `<sub>synthesize-backlog thread \`${thread.id}\`${date ? ` · ${date}` : ""}${sha ? ` · ${String(sha).slice(0, shaCharsShown)}` : ""}</sub>`;
  const decisions = thread.open_decisions.length > 0 ? thread.open_decisions.map((decision) => `- ${decision}`) : ["- None recorded."];
  const sections = (change) => [
    "> *This was generated by AI during backlog synthesis.*", "", "## Thread", "", thread.cause, "", "## The change", "", change, "",
    "## Members", "", ...members, "", "## Open decisions", "", ...decisions, "",
    "## Enters at", "", `\`/${thread.entry}\`, size ${thread.size}. Lands after: ${thread.depends_on.join("; ") || "nothing"}.`, "", footer, "",
  ].join("\n");
  let body = neutraliseMentions(sections(thread.change));
  if (Buffer.byteLength(body) > trackerBodyBytesMax) {
    const room = trackerBodyBytesMax - Buffer.byteLength(neutraliseMentions(sections(""))) - 200;
    body = neutraliseMentions(sections(`${Buffer.from(thread.change).subarray(0, Math.max(0, room)).toString("utf8")}\n\n[cut to fit an issue body; the full outline is in the report]`));
  }
  return body;
}

// The ranking agent wrote its prose before the open-now re-list, so every issue it names that
// has closed since is marked where it appears.
export function summaryLines(synthesis) {
  const closed = new Set(synthesis.closed_since_snapshot);
  const mark = (text) => String(text ?? "").replace(/(?<![\w/&#])#(\d{1,6})\b/g, (whole, digits) => (closed.has(Number(digits)) ? `${whole} (closed since the snapshot)` : whole));
  const { urgent } = synthesis.ranking;
  const lines = [`URGENT (${urgent.length})`, ...urgent.map((entry) => mark(`- #${entry.number}${entry.by ? ` by ${entry.by}` : ""}: ${entry.why}`))];
  if (closed.size > 0) lines.push("", `CLOSED SINCE THE SNAPSHOT: ${[...closed].map((number) => `#${number}`).join(" ")}`);
  const top = synthesis.threads[0];
  lines.push("", `START HERE: ${top ? `${top.rank}. ${top.name} [${top.id}]` : "no thread survived"}`, mark(synthesis.ranking.top_recommendation));
  lines.push("", "STRONG THREADS");
  for (const thread of synthesis.threads.filter((entry) => entry.strength === "Strong")) {
    const open = Object.entries(synthesis.claims).filter(([number, list]) => !closed.has(Number(number)) && list.some((entry) => entry.id === thread.id)).length;
    lines.push(`${thread.rank}. ${thread.name} [${thread.id}] size ${thread.size}, /${thread.entry}, ${open} open issues`);
  }
  const { counts } = synthesis;
  lines.push("", `COVERAGE: ${counts.survived} threads cover ${counts.covered} of ${counts.work_items} issues, ${counts.needs_triage_covered} of ${counts.needs_triage} needs-triage`);
  if (synthesis.unplaced.length > 0) lines.push(`UNPLACED: ${synthesis.unplaced.map((number) => `#${number}`).join(" ")}`);
  lines.push("", "TRIAGE", mark(synthesis.ranking.triage_implication));
  return lines.join("\n").split("\n");
}

// ---------- loaders (I/O) ----------

function loadManifest(run) {
  const manifest = objectFile(join(run, "manifest.json"), "manifest.json");
  assert.ok(Array.isArray(manifest.batches), "manifest.json: batches must be an array; run batch-issues.mjs first");
  return manifest;
}

const loadSnapshot = (run) => new Map(readJson(join(run, "snapshot.json")).map((issue) => [issue.number, issue]));

const digestFileOf = (batch) => basename(batch.digest_path ?? `batch-${String(batch.batch).padStart(2, "0")}.json`);

// Each digests file belongs to one manifest batch, and holds only that batch's issues, so a
// wrong or repeated digest is blamed on the file that holds it and that batch is redone.
function loadDigests(run, manifest) {
  const result = { byNumber: new Map(), problems: [], redoBatches: new Set() };
  const batchOf = new Map(manifest.batches.map((batch) => [digestFileOf(batch), batch]));
  for (const name of jsonFiles(join(run, "digests"))) {
    const batch = batchOf.get(name);
    if (!batch) { result.problems.push(`digests/${name}: matches no batch in manifest.json; delete it`); continue; }
    const file = objectFile(join(run, "digests", name), `digests/${name}`);
    if (!Array.isArray(file.digests)) { result.problems.push(`digests/${name}: digests must be an array`); result.redoBatches.add(batch.batch); continue; }
    const inBatch = new Set(batch.numbers);
    const seen = new Set();
    file.digests.forEach((digest, index) => {
      const where = `digests/${name}[${index}]`;
      const found = digestProblems(digest, where);
      if (found.length === 0 && !inBatch.has(digest.number)) found.push(`${where}: #${digest.number} is not in batch ${batch.batch}`);
      if (found.length === 0 && seen.has(digest.number)) found.push(`${where}: #${digest.number} is digested twice`);
      result.problems.push(...found);
      if (found.length > 0) { result.redoBatches.add(batch.batch); return; }
      seen.add(digest.number);
      result.byNumber.set(digest.number, digest);
    });
  }
  return result;
}

function loadLensThreads(run, isWorkItem = () => true) {
  const result = { byRef: new Map(), problems: [], present: [], nonIssueMembers: [] };
  for (const name of jsonFiles(join(run, "threads"))) {
    const lens = name.replace(/\.json$/, "");
    const where = `threads/${name}`;
    const file = objectFile(join(run, "threads", name), where);
    if (!lenses.includes(lens)) result.problems.push(`${where}: ${lens} is not one of the six lenses`);
    if (file.lens !== undefined && file.lens !== lens) result.problems.push(`${where}: lens "${file.lens}" does not match its file name`);
    if (!Array.isArray(file.threads)) { result.problems.push(`${where}: threads must be an array`); continue; }
    result.present.push(lens);
    file.threads.forEach((thread, index) => {
      const found = threadProblems(thread, `${where}[${index}]`);
      result.problems.push(...found);
      if (found.length > 0) return;
      const ref = `${lens}#${index}`;
      result.byRef.set(ref, { ...thread, lens });
      for (const member of thread.members) if (!isWorkItem(member.number)) result.nonIssueMembers.push({ ref, number: member.number });
    });
  }
  assert.ok(result.byRef.size <= lensThreadsMax, `${result.byRef.size} lens threads exceeds ${lensThreadsMax}`);
  return result;
}

function loadCandidates(run) {
  const candidates = jsonFiles(join(run, "candidates")).map((name) => objectFile(join(run, "candidates", name), `candidates/${name}`));
  assert.ok(candidates.length <= candidatesMax, `${candidates.length} candidates exceeds ${candidatesMax}`);
  return candidates;
}

function loadVerdicts(run, candidates) {
  const verdicts = new Map();
  const problems = [];
  for (const candidate of candidates) {
    const skepticPath = join(run, "verdicts", `${candidate.id}.skeptic.json`);
    const fitPath = join(run, "verdicts", `${candidate.id}.fit.json`);
    if (!existsSync(skepticPath) || !existsSync(fitPath)) continue;
    const skeptic = readJson(skepticPath);
    const fit = readJson(fitPath);
    const found = verdictProblems(skeptic, fit, candidate);
    problems.push(...found);
    if (found.length === 0) verdicts.set(candidate.id, { skeptic, fit });
  }
  return { verdicts, problems };
}

const loadOptional = (run, name) => (existsSync(join(run, name)) ? readJson(join(run, name)) : null);

function loadCritic(run) {
  const critic = loadOptional(run, "critic.json");
  if (critic === null) return null;
  const problems = criticProblems(critic);
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return critic;
}

const workItemsOf = (manifest) => new Set(manifest.batches.flatMap((batch) => batch.numbers));

// Short keys on purpose: every lens, fit-checker and critic agent reads this output, and the
// keys save about 15% of its bytes.
const compactDigest = (digest) => ({
  n: digest.number, t: digest.title, st: digest.state, k: digest.kind, sev: digest.severity,
  sym: digest.symptom, mech: digest.mechanism, cause: digest.cause_hint,
  code: digest.code_locations, dom: digest.domain_concepts, who: digest.avatars,
  links: digest.links, subs: digest.sub_issues, size: digest.size,
});

// ---------- commands ----------

function commandIssue(run, rest) {
  const number = Number(String(rest[0] ?? "").replace(/^#/, ""));
  if (!isIssueNumber(number)) throw new Error("usage: assemble.mjs issue <run> <number> [--page N]");
  const issue = loadSnapshot(run).get(number);
  if (!issue) throw new Error(`#${number} is not in the snapshot`);
  printPage(renderIssueFull(issue).split("\n"), flag(rest, "--page"), `of #${number}`);
}

function commandDigests(run, rest) {
  const { byNumber: digests, problems } = loadDigests(run, loadManifest(run));
  if (problems.length > 0) throw new Error(problems.join("\n"));
  const lines = [...digests.keys()].sort(byNumber).map((number) => JSON.stringify(compactDigest(digests.get(number))));
  printPage(lines, flag(rest, "--page"), `${lines.length} digests`);
}

function commandThreads(run, rest) {
  const { byRef, problems } = loadLensThreads(run);
  if (problems.length > 0) throw new Error(problems.join("\n"));
  const lines = [...byRef].map(([ref, thread]) => JSON.stringify({
    ref, name: thread.name, cause: thread.root_cause, change: thread.structural_change,
    members: thread.members.map((member) => `${member.number}:${member.fit}`).join(" "), existing: thread.existing_proposals ?? [], confidence: thread.confidence,
  }));
  printPage(lines, flag(rest, "--page"), `${lines.length} lens threads`);
}

function commandCheck(run, rest) {
  const stage = flag(rest, "--stage") ?? "digests";
  if (!["digests", "lenses"].includes(stage)) throw new Error("--stage must be digests or lenses");
  const manifest = loadManifest(run);
  const workItems = workItemsOf(manifest);
  const lensThreads = stage === "lenses" ? loadLensThreads(run, (number) => workItems.has(number)) : null;
  const { report, ok } = checkRun({ manifest, digests: loadDigests(run, manifest), lensThreads, stage });
  console.log(JSON.stringify(report, null, 1));
  if (!ok) process.exitCode = 1;
}

function removeStale(dir, origin, keep) {
  const removed = [];
  for (const name of jsonFiles(dir)) {
    const old = readJson(join(dir, name));
    if (old?.origin === origin && !keep.has(old.id)) { rmSync(join(dir, name)); removed.push(old.id); }
  }
  return removed;
}

function commandMerge(run) {
  const workItems = workItemsOf(loadManifest(run));
  const { byRef, problems } = loadLensThreads(run);
  if (problems.length > 0) throw new Error(problems.join("\n"));
  const grouping = objectFile(join(run, "grouping.json"), "grouping.json");
  const shape = groupingProblems(grouping);
  if (shape.length > 0) throw new Error(shape.join("\n"));
  const result = buildCandidates(grouping, byRef, (number) => workItems.has(number));
  const dir = join(run, "candidates");
  mkdirSync(dir, { recursive: true });
  const removed = removeStale(dir, "merge", new Set(result.candidates.map((candidate) => candidate.id)));
  for (const candidate of result.candidates) writeJson(join(dir, `${candidate.id}.json`), candidate);
  const report = {
    ok: result.ok, candidates: result.candidates.length, rejected: (grouping.rejected ?? []).length, removed,
    unknown_refs: result.unknownRefs, unplaced_refs: result.unplacedRefs, contradictory_refs: result.contradictoryRefs,
    bad_ids: result.badIds, duplicate_ids: result.duplicateIds, too_small: result.tooSmall, non_issue_members: result.nonIssueMembers,
  };
  writeJson(join(run, "merge-report.json"), report);
  console.log(JSON.stringify(report));
  if (!result.ok) process.exitCode = 1;
}

function commandCriticCandidates(run) {
  const workItems = workItemsOf(loadManifest(run));
  const critic = loadCritic(run);
  if (critic === null) throw new Error("critic.json is missing");
  const dir = join(run, "candidates");
  mkdirSync(dir, { recursive: true });
  const ids = new Set();
  const built = (critic.new_threads ?? []).map((thread) => {
    const candidate = candidateFromThread(thread, (number) => workItems.has(number));
    let id = candidate.id;
    for (let suffix = 2; ids.has(id); suffix += 1) id = `${candidate.id}-${suffix}`;
    ids.add(id);
    return { ...candidate, id };
  });
  const kept = built.filter((candidate) => candidate.members.length >= membersMin);
  const removed = removeStale(dir, "critic", new Set(kept.map((candidate) => candidate.id)));
  for (const candidate of kept) writeJson(join(dir, `${candidate.id}.json`), candidate);
  const tooSmall = built.filter((candidate) => candidate.members.length < membersMin).map((candidate) => candidate.id);
  console.log(JSON.stringify({ written: kept.map((candidate) => candidate.id), too_small: tooSmall, removed }));
}

function commandCoverage(run) {
  const manifest = loadManifest(run);
  const workItems = workItemsOf(manifest);
  const { byNumber: digests } = loadDigests(run, manifest);
  const candidates = loadCandidates(run);
  const { verdicts, problems } = loadVerdicts(run, candidates);
  if (problems.length > 0) throw new Error(problems.join("\n"));
  const coverage = computeCoverage({ workItems, candidates, verdicts, critic: loadCritic(run) });
  const survivors = coverage.survivors.map((id) => {
    const candidate = candidates.find((entry) => entry.id === id);
    return { id, name: candidate.name, cause: verifiedCause(candidate, verdicts.get(id).skeptic) };
  });
  writeJson(join(run, "coverage.json"), {
    survivors, dropped: coverage.dropped, pending: coverage.pending, assigned: coverage.claims.size,
    unassigned: coverage.unassigned, unplaced: coverage.unplaced, outside_snapshot: coverage.outside,
  });
  writeJson(join(run, "unassigned.json"), coverage.unassigned.filter((number) => digests.has(number)).map((number) => compactDigest(digests.get(number))));
  console.log(JSON.stringify({ survivors: survivors.length, dropped: coverage.dropped.length, pending: coverage.pending, assigned: coverage.claims.size, unassigned: coverage.unassigned.length, unplaced: coverage.unplaced, outside_snapshot: coverage.outside.length }));
  if (coverage.pending.length > 0) process.exitCode = 1;
}

function commandFinal(run, rest) {
  const meta = { repo: flag(rest, "--repo") ?? "", sha: flag(rest, "--sha") ?? "", date: flag(rest, "--date") ?? "" };
  const manifest = loadManifest(run);
  const { byNumber: digests } = loadDigests(run, manifest);
  const candidates = loadCandidates(run);
  const { verdicts, problems } = loadVerdicts(run, candidates);
  const ranking = objectFile(join(run, "ranking.json"), "ranking.json");
  const allProblems = [...problems, ...rankingProblems(ranking)];
  if (allProblems.length > 0) throw new Error(allProblems.join("\n"));
  const openNowRaw = loadOptional(run, "open-now.json");
  const synthesis = buildSynthesis({
    meta, manifest, snapshot: loadSnapshot(run), digests, candidates, verdicts, critic: loadCritic(run), ranking,
    grouping: loadOptional(run, "grouping.json"), mergeReport: loadOptional(run, "merge-report.json"),
    threadByRef: loadLensThreads(run).byRef, openNow: openNowRaw === null ? null : openNowNumbers(openNowRaw),
  });
  writeJson(join(run, "synthesis.json"), synthesis);
  console.log(JSON.stringify(synthesis.counts));
}

const loadSynthesis = (run) => objectFile(join(run, "synthesis.json"), "synthesis.json; run final first");

function commandSummary(run, rest) {
  printPage(summaryLines(loadSynthesis(run)), flag(rest, "--page"), "of the summary");
}

function commandTracker(run, rest) {
  const id = rest[0];
  if (!id || id.startsWith("--")) throw new Error("usage: assemble.mjs tracker <run> <id> --picked <id,id,...>");
  const picked = (flag(rest, "--picked") ?? id).split(",").map((entry) => entry.trim()).filter(Boolean);
  const synthesis = loadSynthesis(run);
  const plan = trackerPlan(synthesis, id, picked);
  if (plan.attach.length === 0 && plan.existing_trackers.length === 0) {
    throw new Error(`thread ${id} has no member to attach (${plan.listed.map((entry) => `#${entry.number}: ${entry.reason}`).join("; ")}): open no thread tracker for it`);
  }
  mkdirSync(join(run, "trackers"), { recursive: true });
  const bodyPath = join(run, "trackers", `${id}.md`);
  writeFileSync(bodyPath, trackerBody(synthesis, plan));
  const warning = plan.attach.length < membersMin ? `only ${plan.attach.length} members to attach, fewer than a thread's ${membersMin}` : "";
  console.log(JSON.stringify({ title: plan.title, title_shell: plan.title_shell, body_path: bodyPath, attach: plan.attach, listed: plan.listed, existing_trackers: plan.existing_trackers, warning }, null, 1));
}

const commands = {
  issue: commandIssue, digests: commandDigests, threads: commandThreads, check: commandCheck, merge: commandMerge,
  "critic-candidates": commandCriticCandidates, coverage: commandCoverage, final: commandFinal, summary: commandSummary, tracker: commandTracker,
};

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const [command, run, ...rest] = process.argv.slice(2);
  try {
    if (!commands[command] || !run) throw new Error(`usage: assemble.mjs <${Object.keys(commands).join("|")}> <run> …`);
    commands[command](resolve(run), rest);
  } catch (error) {
    console.error(`assemble: ${error.message}`);
    process.exit(1);
  }
}
