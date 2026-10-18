import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildCandidates, candidateFromThread, resolvedIssues, survival, verdictProblems, computeCoverage, ownersOf, buildSynthesis,
  rankingProblems, criticProblems, openNowNumbers, pageLines, trackerPlan, trackerBody, summaryLines, digestProblems, membersMin,
  groupingProblems, shellTitle, applyLinks, keepDestination, threadLines, startsAt, scopeOf, plansInOrder, shortCardLines,
} from "./assemble.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "assemble.mjs");

const member = (number, fit = "full", how = `fixes #${number}`) => ({ number, fit, how });
const thread = (name, members, extra = {}) => ({
  name, root_cause: "cause", structural_change: "change", members, existing_proposals: [], evidence: [`e:${name}`], confidence: "high", ...extra,
});
const digest = (number, state = "needs-triage") => ({
  number, title: `Issue ${number}`, state, kind: "bug", severity: "medium", symptom: "s", mechanism: "m", cause_hint: "c",
  code_locations: [], domain_concepts: [], avatars: [], links: [], sub_issues: [], size: "S",
});
const fit = (entries, extra = {}) => ({
  member_fit: entries.map(([number, resolves]) => ({ number, resolves, remainder: resolves === "full" ? "" : "left" })),
  additional_members: [], change_outline: "outline", files_touched_estimate: [], size: "M", supersedes: [], depends_on: [],
  entry_point: "to-spec", open_decisions: [], ...extra,
});
const skeptic = (refuted = false) => ({ refuted, verdict: refuted ? "topic, not a cause" : "holds", actual_shared_cause: "sharpened", weakest_members: [], code_evidence: [], adr_conflicts: [] });
const candidate = (id, numbers, extra = {}) => ({ id, name: id.toUpperCase(), root_cause: "r", structural_change: "s", members: numbers.map((n) => member(n)), found_by_lenses: [], existing_proposals: [], overlaps: [], origin: "merge", ...extra });
const ranking = (entries, extra = {}) => ({ ranking: entries, sequencing: "Wave 0: now", top_recommendation: "Start", triage_implication: "Fold", urgent: [], ...extra });
const manifestOf = (numbers, skipped = []) => ({ total: numbers.length + skipped.length, skipped, batches: [{ batch: 1, numbers }] });
const snapshotOf = (numbers, extra = {}) => new Map(numbers.map((n) => [n, { number: n, title: `Snapshot ${n}`, parent: null, sub_issues: [], ...(extra[n] ?? {}) }]));

test("buildCandidates rebuilds members from the lens threads, preferring a full fit and dropping non-issues", () => {
  const byRef = new Map([
    ["architecture#0", { ...thread("a", [member(1, "partial"), member(2), member(3), member(900)]), lens: "architecture" }],
    ["identity-access#0", { ...thread("b", [member(1, "full", "better"), member(4)], { existing_proposals: [9] }), lens: "identity-access" }],
  ]);
  const grouping = { candidates: [{ id: "one-guard", name: "One guard", source_refs: ["architecture#0", "identity-access#0"], drop_members: [3], add_members: [5] }], rejected: [] };
  const result = buildCandidates(grouping, byRef, (number) => number < 100);
  assert.equal(result.ok, true);
  const [built] = result.candidates;
  assert.deepEqual(built.members.map((m) => [m.number, m.fit]), [[1, "full"], [2, "full"], [4, "full"], [5, "partial"]]);
  assert.equal(built.members[0].how, "better");
  assert.deepEqual(built.found_by_lenses, ["architecture", "identity-access"]);
  assert.deepEqual(built.existing_proposals, [9]);
  assert.deepEqual(result.nonIssueMembers, [{ id: "one-guard", number: 900 }]);
});

test("buildCandidates lists every expected mistake instead of throwing", () => {
  const byRef = new Map(["architecture#0", "architecture#1", "architecture#2"].map((ref, index) => [ref, { ...thread(ref, [member(index * 3 + 1), member(index * 3 + 2), member(index * 3 + 3)]), lens: "architecture" }]));
  const grouping = {
    candidates: [
      { id: "Bad Id", source_refs: [] },
      { id: "same", source_refs: ["architecture#0", "architecture#9"] },
      { id: "same", source_refs: ["architecture#1"] },
      { id: "small", source_refs: ["architecture#2"], drop_members: [8, 9] },
    ],
    rejected: [{ ref: "architecture#0", reason: "topic" }, { ref: "nonsense#5", reason: "?" }],
  };
  const result = buildCandidates(grouping, byRef);
  assert.equal(result.ok, false);
  assert.deepEqual(result.badIds, ["Bad Id"]);
  assert.deepEqual(result.duplicateIds, ["same"]);
  assert.deepEqual(result.unknownRefs.sort(), ["architecture#9", "nonsense#5"]);
  assert.deepEqual(result.contradictoryRefs, ["architecture#0"]);
  assert.deepEqual(result.unplacedRefs, ["architecture#1"]);
  assert.deepEqual(result.tooSmall.map((entry) => entry.id), ["small"]);
});

test("candidateFromThread names a critic thread from its name alone and keeps only work items", () => {
  const built = candidateFromThread(thread("Upgrade the web framework to its next major version", [member(1), member(2), member(77)]), (n) => n < 50);
  assert.equal(built.id, "critic-upgrade-the-web-framework-to-its-next-ma");
  assert.deepEqual(built.members.map((m) => m.number), [1, 2]);
  assert.equal(built.origin, "critic");
});

test("resolvedIssues counts each work item once, at its best resolution", () => {
  const entries = fit([[1, "partial"], [2, "full"], [3, "no"]], { additional_members: [{ number: 1, resolves: "full", why: "w" }, { number: 99, resolves: "full", why: "w" }] });
  assert.deepEqual(resolvedIssues(entries, (n) => n < 50), [{ number: 1, resolves: "full" }, { number: 2, resolves: "full" }]);
});

test("survival needs an unrefuted skeptic and three distinct work items resolved", () => {
  assert.equal(membersMin, 3);
  assert.equal(survival(skeptic(true), fit([[1, "full"], [2, "full"], [3, "full"]])).survives, false);
  const repeated = fit([[1, "full"], [2, "full"]], { additional_members: [{ number: 1, resolves: "partial", why: "w" }] });
  assert.match(survival(skeptic(), repeated).reason, /only 2 issues/);
  const invented = fit([[1, "full"], [2, "full"]], { additional_members: [{ number: 9001, resolves: "full", why: "w" }] });
  assert.equal(survival(skeptic(), invented, (n) => n < 100).survives, false);
});

test("verdictProblems wants every member exactly once and well-formed additions", () => {
  const problems = verdictProblems(skeptic(), fit([[1, "full"], [1, "partial"]], { additional_members: [{ number: 5, resolves: "no" }], size: "huge" }), candidate("c", [1, 2]));
  assert.ok(problems.some((p) => /#1 must appear exactly once/.test(p)));
  assert.ok(problems.some((p) => /#2 must appear exactly once/.test(p)));
  assert.ok(problems.some((p) => /additional_members/.test(p)));
  assert.ok(problems.some((p) => /size must be/.test(p)));
  assert.deepEqual(verdictProblems({ refuted: "no" }, null, candidate("c", [])).length, 2);
});

test("verdictProblems and groupingProblems check the list fields the report and trackers read", () => {
  const problems = verdictProblems({ ...skeptic(), code_evidence: "see routes.ts" }, fit([[1, "full"]], { depends_on: "nothing", supersedes: ["#4"] }), candidate("c", [1]));
  assert.ok(problems.some((p) => /fit\.json: depends_on must be an array of strings/.test(p)));
  assert.ok(problems.some((p) => /fit\.json: supersedes must be an array of issue numbers/.test(p)));
  assert.ok(problems.some((p) => /skeptic\.json: code_evidence must be an array of strings/.test(p)));
  assert.ok(groupingProblems({ candidates: [{ id: "a", drop_members: { 3: true } }] }).some((p) => /candidates\[0\]: drop_members/.test(p)));
});

test("computeCoverage claims only for survivors and work items, and keeps standalone apart from unplaced", () => {
  const workItems = new Set([1, 2, 3, 4, 5, 6, 7]);
  const candidates = [candidate("keep", [1, 2, 3, 4]), candidate("drop", [5, 6, 7]), candidate("wait", [1])];
  const verdicts = new Map([
    ["keep", { skeptic: skeptic(), fit: fit([[1, "full"], [2, "partial"], [3, "full"], [4, "no"]], { additional_members: [{ number: 404, resolves: "full", why: "w" }] }) }],
    ["drop", { skeptic: skeptic(true), fit: fit([[5, "full"], [6, "full"], [7, "full"]]) }],
  ]);
  const critic = { standalone: [{ number: 5, reason: "one-off" }], missing_from_candidates: [{ candidate_id: "keep", number: 6, why: "w" }, { candidate_id: "drop", number: 7, why: "w" }] };
  const coverage = computeCoverage({ workItems, candidates, verdicts, critic });
  assert.deepEqual(coverage.survivors, ["keep"]);
  assert.deepEqual(coverage.pending, ["wait"]);
  assert.deepEqual([...coverage.claims.keys()].sort(), [1, 2, 3, 6]);
  assert.deepEqual(coverage.outside, [{ id: "keep", number: 404 }]);
  assert.deepEqual(coverage.unassigned, [4, 5, 7]);
  assert.deepEqual(coverage.unplaced, [4, 7]);
});

test("ownersOf honours the ranking, else the best-ranked full fit", () => {
  const claims = new Map([[1, [{ id: "a", resolves: "partial" }, { id: "b", resolves: "full" }]], [2, [{ id: "a", resolves: "full" }, { id: "b", resolves: "full" }]], [3, [{ id: "a", resolves: "full" }]]]);
  const rankOf = (id) => ({ a: 1, b: 2 })[id];
  assert.deepEqual(ownersOf(claims, rankOf), { 1: "b", 2: "a" });
  assert.deepEqual(ownersOf(claims, rankOf, [{ number: 2, id: "b" }, { number: 1, id: "zzz" }]), { 1: "b", 2: "b" });
});

function synthesisInputs(overrides = {}) {
  const numbers = [1, 2, 3, 4];
  return {
    meta: { repo: "o/r", sha: "abc", date: "2026-10-18" }, manifest: manifestOf(numbers, [9]), snapshot: snapshotOf(numbers),
    digests: new Map([[1, digest(1)], [2, digest(2)], [3, digest(3, "ready-for-agent")], [4, digest(4)]]),
    candidates: [candidate("b", [1, 3, 4], { found_by_lenses: ["architecture"] }), candidate("a", [1, 2, 3])],
    verdicts: new Map([
      ["a", { skeptic: skeptic(), fit: fit([[1, "full"], [2, "full"], [3, "partial"]]) }],
      ["b", { skeptic: skeptic(), fit: fit([[1, "partial"], [3, "full"], [4, "full"]]) }],
    ]),
    critic: null, ranking: ranking([{ id: "a", rank: 2, strength: "Worth exploring", leverage_note: "n" }, { id: "b", rank: 1, strength: "Strong", leverage_note: "n" }]),
    grouping: { rejected: [{ ref: "x#0", reason: "topic" }] }, mergeReport: { too_small: [{ id: "tiny", name: "Tiny" }] }, threadByRef: new Map(), openNow: [1, 2, 3, 4],
    ...overrides,
  };
}

test("buildSynthesis orders threads by rank, takes titles from the snapshot and counts needs-triage coverage", () => {
  const synthesis = buildSynthesis(synthesisInputs());
  assert.deepEqual(synthesis.threads.map((t) => t.id), ["b", "a"]);
  assert.equal(synthesis.threads[0].cause, "sharpened");
  assert.equal(synthesis.issues[0].title, "Snapshot 1");
  assert.deepEqual(synthesis.counts, { work_items: 4, lens_threads: 0, candidates: 2, survived: 2, covered: 4, needs_triage: 3, needs_triage_covered: 3 });
  assert.deepEqual(synthesis.owners, { 1: "a", 3: "b" });
  assert.deepEqual(synthesis.rejected.map((r) => r.ref), ["x#0", "tiny"]);
});

test("buildSynthesis refuses pending candidates, unranked or stray rankings, and a truncated open-now list", () => {
  const inputs = synthesisInputs();
  assert.throws(() => buildSynthesis({ ...inputs, verdicts: new Map([["a", inputs.verdicts.get("a")]]) }), /no verdicts .*: b$/);
  assert.throws(() => buildSynthesis({ ...inputs, ranking: ranking([inputs.ranking.ranking[0]]) }), /missing from ranking.json: b$/);
  assert.throws(() => buildSynthesis({ ...inputs, ranking: ranking([...inputs.ranking.ranking, { id: "ghost", rank: 3, strength: "Strong" }]) }), /did not survive: ghost$/);
  assert.deepEqual(buildSynthesis({ ...inputs, openNow: null }).closed_since_snapshot, []);
});

test("buildSynthesis allows a few issues closing during a small run, and refuses a list cut short", () => {
  const inputs = synthesisInputs();
  assert.deepEqual(buildSynthesis({ ...inputs, openNow: [1, 2, 3] }).closed_since_snapshot, [4]);
  const forty = Array.from({ length: 40 }, (_, index) => index + 1);
  assert.throws(() => buildSynthesis({ ...inputs, manifest: manifestOf(forty), snapshot: snapshotOf(forty), openNow: [1, 2, 3, 4] }), /stop at a default limit/);
});

test("rankingProblems and criticProblems name what is missing", () => {
  assert.ok(rankingProblems({ ranking: [{ id: "a", rank: 1, strength: "Strong" }, { id: "b", rank: 1, strength: "Huge" }], sequencing: "", top_recommendation: "", triage_implication: "" }).some((p) => /urgent must be an array/.test(p)));
  assert.equal(rankingProblems({ ranking: [{ id: "a", rank: 1, strength: "Strong" }, { id: "b", rank: 1, strength: "Huge" }], sequencing: "", top_recommendation: "", triage_implication: "", urgent: [] }).length, 2);
  assert.deepEqual(rankingProblems(null), ["ranking.json: must be a JSON object"]);
  assert.ok(criticProblems({ standalone: {}, new_threads: [{ name: "x" }] }).length >= 2);
});

test("openNowNumbers accepts gh's two shapes and refuses anything else", () => {
  assert.deepEqual(openNowNumbers([1, 2]), [1, 2]);
  assert.deepEqual(openNowNumbers([{ number: 3 }]), [3]);
  assert.throws(() => openNowNumbers({ numbers: [1] }), /JSON array/);
  assert.throws(() => openNowNumbers(["3"]), /issue numbers/);
});

test("pageLines keeps pages under the cap and splits an overlong line", () => {
  const pages = pageLines(["a".repeat(30), "b".repeat(30), "c".repeat(75)], 64);
  assert.ok(pages.every((page) => page.join("\n").length <= 64));
  assert.equal(pages.flat().join(""), `${"a".repeat(30)}${"b".repeat(30)}${"c".repeat(75)}`);
  assert.deepEqual(pageLines([]), [[]]);
});

test("trackerPlan attaches only open, owned, parentless members, and trackerBody neutralises mentions", () => {
  const inputs = synthesisInputs({ snapshot: snapshotOf([1, 2, 3, 4], { 2: { parent: 50 } }) });
  const synthesis = buildSynthesis(inputs);
  synthesis.threads[1].cause = "Ping @someone about it";
  const plan = trackerPlan(synthesis, "a", { b: 412 });
  assert.deepEqual(plan.attach, []);
  assert.deepEqual(plan.listed, [
    { number: 1, reason: "on thread b's tracker #412" }, { number: 2, reason: "already under #50" }, { number: 3, reason: "on thread b's tracker #412" },
  ]);
  const body = trackerBody(synthesis, plan);
  assert.match(body, /^> \*This was generated by AI during backlog synthesis\.\*/);
  assert.match(body, /## Thread\n\nPing @​someone/);
  assert.match(body, /- #3: partly\. Still left: left \(listed here only: on thread b's tracker #412\)/);
  assert.throws(() => trackerPlan(synthesis, "nope"), /no surviving thread/);
});

test("trackerPlan lets the members an earlier tracker attached decide who owns a shared one", () => {
  const synthesis = buildSynthesis(synthesisInputs());
  const first = trackerPlan(synthesis, "a");
  assert.deepEqual(first.attach, [1, 2, 3]);
  assert.deepEqual(first.shared, [{ number: 1, also_in: ["b"], suggested_owner: "a" }, { number: 3, also_in: ["b"], suggested_owner: "b" }]);
  const second = trackerPlan(synthesis, "b", { a: { number: 501, attached: [1] } });
  assert.deepEqual(second.attach, [3, 4]);
  assert.deepEqual(second.listed, [{ number: 1, reason: "on thread a's tracker #501" }]);
  const legacy = trackerPlan(synthesis, "b", { a: 501 });
  assert.deepEqual(legacy.attach, [4], "a bare tracker number counts every member it claims as taken");
});

test("plansInOrder plans each thread as if the ones before it folded, honouring left members", () => {
  const synthesis = buildSynthesis(synthesisInputs());
  const [first, second] = plansInOrder(synthesis, ["a", "b"]);
  assert.deepEqual([first.attach, second.attach], [[1, 2, 3], [4]]);
  assert.deepEqual(second.listed.map((entry) => entry.reason), ["taken by thread a, earlier in the order", "taken by thread a, earlier in the order"]);
  const [leaving, taking] = plansInOrder(synthesis, ["a", "b"], {}, { a: [3] });
  assert.deepEqual(leaving.listed, [{ number: 3, reason: "left for another thread" }]);
  assert.deepEqual(taking.attach, [3, 4]);
  const card = shortCardLines(synthesis, first).join("\n");
  assert.match(card, /^2\. A \[a\] · Worth exploring · size M · scope several sessions\n   cause: sharpened\n   would attach: #1 #2 #3\n   shares: #1 is also in b; the ranker suggests a owns it; #3 is also in b; the ranker suggests b owns it$/);
});

test("trackerBody presents the change as a hypothesis and starts the tracker at grilling", () => {
  const synthesis = buildSynthesis(synthesisInputs());
  const body = trackerBody(synthesis, trackerPlan(synthesis, "a"));
  assert.match(body, /## A proposed change\n\n_A hypothesis that agents wrote from the code at `abc`\. Grill it before building: it is not a spec\._\n\noutline/);
  assert.match(body, /Members keep their own triage states\./);
  assert.match(body, /## Next\n\nStart with `\/grill-with-docs` on this tracker\./);
  assert.ok(!/## Enters at|`\/implement`,/.test(body));
  synthesis.threads[1].entry = "wayfinder";
  const wayfinder = trackerBody(synthesis, trackerPlan(synthesis, "a"));
  assert.match(wayfinder, /## Next\n\nStart with `\/wayfinder`, giving it this thread as the idea to chart: it opens its own `wayfinder:map` issue/);
  assert.match(wayfinder, /This tracker is not the map/);
  assert.equal(startsAt("implement"), "/grill-with-docs");
  assert.equal(scopeOf("to-spec"), "several sessions");
});

test("threadLines puts the evidence, the doubts, the members and the plan on one card", () => {
  const inputs = synthesisInputs({ openNow: [1, 2, 4] });
  inputs.verdicts.get("b").fit.supersedes = [3, 4];
  inputs.verdicts.get("b").fit.depends_on = ["a: shares the guard"];
  inputs.verdicts.get("b").skeptic.weakest_members = [4];
  inputs.verdicts.get("b").skeptic.adr_conflicts = ["ADR 0001 keeps identity in the PMS"];
  inputs.digests.set(4, digest(4, "ready-for-agent"));
  inputs.ranking = ranking([{ id: "a", rank: 2, strength: "Worth exploring", leverage_note: "n" }, { id: "b", rank: 1, strength: "Strong", leverage_note: "Leans on #3.", why_here: "First because #3 bites today." }]);
  const text = threadLines(buildSynthesis(inputs), "b", { a: 501 }).join("\n");
  assert.match(text, /^THREAD 1 of 2: B \[b\]\nStrong · size M · scope several sessions · would start at \/grill-with-docs/);
  assert.match(text, /WHY IT SITS HERE: First because #3 \(closed since the snapshot\) bites today\./);
  assert.match(text, /A PROPOSED CHANGE \(a hypothesis to grill\):\noutline/);
  assert.match(text, /SKEPTIC'S DOUBTS:\n- #4 may not fit the shared cause\n- ADR: ADR 0001 keeps identity in the PMS/);
  assert.match(text, /- #3 Snapshot 3 \[ready-for-agent, medium, closed since the snapshot\] fully/);
  assert.match(text, /LANDS AFTER: a: shares the guard/);
  assert.match(text, /FOLDING IT WOULD ATTACH: #4\nAND LIST: #1 \(on thread a's tracker #501\), #3 \(closed since the snapshot\)/);
  assert.match(text, /READY-FOR-AGENT BRIEFS IT SUPERSEDES: #4$/m);
});

test("trackerPlan lists the existing tracker and closed members instead of attaching them", () => {
  const inputs = synthesisInputs({ snapshot: snapshotOf([1, 2, 3, 4], { 4: { sub_issues: [70] } }), openNow: [1, 2, 4] });
  inputs.candidates[0].existing_proposals = [4];
  const plan = trackerPlan(buildSynthesis(inputs), "b");
  assert.deepEqual(plan.existing_trackers, [4]);
  assert.deepEqual(plan.attach, [1]);
  assert.deepEqual(plan.listed, [{ number: 3, reason: "closed since the snapshot" }, { number: 4, reason: "the existing tracker" }]);
});

test("shellTitle single-quotes an agent-written name so the shell runs none of it", () => {
  const { title, title_shell: quoted } = shellTitle("One `guard` for $(whoami)'s routes\n");
  assert.equal(title, "One `guard` for $(whoami)'s routes");
  assert.equal(quoted, `'One \`guard\` for $(whoami)'\\''s routes'`);
  assert.equal(shellTitle("x".repeat(300)).title.length, 256);
});

test("summaryLines leads with the run and the urgent list, and names the Strong threads", () => {
  const synthesis = buildSynthesis(synthesisInputs({ ranking: ranking(synthesisInputs().ranking.ranking, { urgent: [{ number: 4, why: "certificate expires", by: "2026-11-06" }] }) }));
  const text = summaryLines(synthesis).join("\n");
  assert.match(text, /^RUN: o\/r · run 2026-10-18 · code abc\n\nURGENT \(1\)\n- #4 by 2026-11-06: certificate expires/);
  assert.match(text, /STRONG THREADS, IN THE SUGGESTED ORDER\n1\. B \[b\] Strong, size M, scope several sessions, 3 open issues\n   why here: n/);
  assert.match(text, /OTHER THREADS\n2\. A \[a\] Worth exploring, size M, scope several sessions, 3 open issues/);
  assert.match(text, /TRIAGE PLAN \(the run's suggestions: nothing here has been done, fold closes nothing/);
});

test("summaryLines marks every issue the ranking names that closed after the snapshot", () => {
  const base = synthesisInputs();
  const synthesis = buildSynthesis({ ...base, openNow: [1, 2, 3, 77], ranking: ranking(base.ranking.ranking, { top_recommendation: "Pair it with #4, then #2." }) });
  const text = summaryLines(synthesis).join("\n");
  assert.match(text, /CLOSED SINCE THE SNAPSHOT: #4\nOPENED SINCE THE SNAPSHOT \(in no thread; for \/triage\): #77/);
  assert.match(text, /Pair it with #4 \(closed since the snapshot\), then #2\./);
  assert.match(text, /1\. B \[b\] Strong, size M, scope several sessions, 2 open issues/);
  assert.deepEqual(synthesis.opened_since_snapshot, [77]);
});

test("digestProblems checks the enums", () => {
  assert.deepEqual(digestProblems({ ...digest(1), severity: "critical" }, "d"), []);
  assert.equal(digestProblems({ ...digest(1), state: "blocked", kind: "vendor-check" }, "d").length, 2);
});

function writeRun(t) {
  const run = mkdtempSync(join(tmpdir(), "assemble-"));
  t.after(() => rmSync(run, { recursive: true, force: true }));
  for (const sub of ["digests", "threads", "verdicts"]) mkdirSync(join(run, sub));
  const write = (path, value) => writeFileSync(join(run, path), JSON.stringify(value));
  write("snapshot.json", [1, 2, 3, 4].map((n) => ({ number: n, title: `Issue ${n}`, labels: [], body: `body ${n}`, comments: [], parent: null, sub_issues: [] })));
  write("manifest.json", { total: 4, work_items: 4, skipped: [], batches: [{ batch: 1, path: "", numbers: [1, 2, 3, 4] }] });
  write("digests/batch-01.json", { digests: [1, 2, 3].map((n) => digest(n)) });
  write("threads/architecture.json", { lens: "architecture", threads: [thread("one", [member(1), member(2), member(3)])] });
  return { run, write };
}

const cli = (args) => spawnSync("node", [script, ...args], { encoding: "utf8" });

test("the CLI walks check, merge, coverage, final, summary and tracker over a run directory", (t) => {
  const { run, write } = writeRun(t);
  const check = cli(["check", run, "--stage", "digests"]);
  assert.equal(check.status, 1);
  assert.deepEqual(JSON.parse(check.stdout).digests.missing, [4]);
  write("digests/batch-01.json", { digests: [1, 2, 3, 4].map((n) => digest(n)) });
  assert.equal(cli(["check", run, "--stage", "digests"]).status, 0);
  assert.equal(cli(["check", run, "--stage", "lenses"]).status, 1, "five lenses are missing");

  write("grouping.json", { candidates: [{ id: "one", name: "One", root_cause: "r", structural_change: "s", source_refs: ["architecture#0"] }], rejected: [] });
  assert.equal(cli(["merge", run]).status, 0);
  assert.equal(cli(["coverage", run]).status, 1, "one has no verdicts yet");
  write("verdicts/one.skeptic.json", skeptic());
  write("verdicts/one.fit.json", fit([[1, "full"], [2, "full"], [3, "partial"]]));
  const coverage = cli(["coverage", run]);
  assert.equal(coverage.status, 0, coverage.stderr);
  assert.equal(JSON.parse(readFileSync(join(run, "unassigned.json"), "utf8"))[0].n, 4);

  write("ranking.json", ranking([{ id: "one", rank: 1, strength: "Strong", leverage_note: "n" }]));
  assert.equal(cli(["final", run, "--repo", "o/r"]).status, 0);
  assert.match(cli(["summary", run]).stdout, /SUGGESTED FIRST \(a recommendation; the order is the user's\): 1\. One \[one\]/);
  const tracker = JSON.parse(cli(["tracker", run, "one"]).stdout);
  assert.deepEqual(tracker.attach, [1, 2, 3]);
  assert.match(readFileSync(tracker.body_path, "utf8"), /## A proposed change\n\n_A hypothesis that agents wrote from the code\. Grill it before building: it is not a spec\._\n\noutline/);
  assert.match(cli(["thread", run, "one"]).stdout, /^THREAD 1 of 1: One \[one\][\s\S]*FOLDING IT WOULD ATTACH: #1 #2 #3[\s\S]*# page 1 of 1: all of thread one read/);
  assert.match(cli(["issue", run, "#2"]).stdout, /# #2: Issue 2[\s\S]*# page 1 of 1: all of #2 read/);
  assert.match(cli(["digests", run, "--page", "1"]).stdout, /# page 1 of 1: all 4 digests read/);
});

test("a second merge removes the candidates the first one wrote", (t) => {
  const { run, write } = writeRun(t);
  write("grouping.json", { candidates: [{ id: "same", name: "Same", source_refs: ["architecture#0"] }], rejected: [] });
  cli(["merge", run]);
  write("grouping.json", { candidates: [{ id: "renamed", name: "Renamed", source_refs: ["architecture#0"] }], rejected: [] });
  const report = JSON.parse(cli(["merge", run]).stdout);
  assert.deepEqual(report.removed, ["same"]);
  assert.ok(existsSync(join(run, "candidates", "renamed.json")) && !existsSync(join(run, "candidates", "same.json")));
});

test("the CLI names malformed files: a bad verdict, a duplicate digest and a mislabelled lens", (t) => {
  const { run, write } = writeRun(t);
  write("grouping.json", { candidates: [{ id: "one", name: "One", source_refs: ["architecture#0"] }], rejected: [] });
  cli(["merge", run]);
  write("verdicts/one.skeptic.json", { refuted: "no" });
  write("verdicts/one.fit.json", fit([[1, "maybe"]]));
  const coverage = cli(["coverage", run]);
  assert.equal(coverage.status, 1);
  assert.match(coverage.stderr, /one\.skeptic\.json: refuted must be a boolean/);
  assert.match(coverage.stderr, /#1 resolves must be full, partial or no/);

  write("digests/batch-02.json", { digests: [digest(3)] });
  write("threads/architecture.json", { lens: "Architecture", threads: [] });
  const check = JSON.parse(cli(["check", run, "--stage", "lenses"]).stdout);
  assert.ok(check.problems.some((p) => /digests\/batch-02\.json: matches no batch/.test(p)));
  assert.ok(check.problems.some((p) => /lens "Architecture" does not match its file name/.test(p)));
});

test("check blames the digests file that holds a wrong or repeated digest, and redoes its batch", (t) => {
  const { run, write } = writeRun(t);
  write("manifest.json", { total: 4, work_items: 4, skipped: [], batches: [{ batch: 1, numbers: [1, 2] }, { batch: 2, numbers: [3, 4] }] });
  write("digests/batch-01.json", { digests: [digest(1), digest(2), digest(3)] });
  write("digests/batch-02.json", { digests: [digest(3), digest(4), digest(4)] });
  const result = cli(["check", run, "--stage", "digests"]);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.digests.redo_batches, [1, 2]);
  assert.ok(report.problems.some((p) => /batch-01\.json\[2\]: #3 is not in batch 1/.test(p)));
  assert.ok(report.problems.some((p) => /batch-02\.json\[2\]: #4 is digested twice/.test(p)));
});

test("buildSynthesis checks an open-now list against the issue tracker's count instead of guessing", () => {
  const forty = Array.from({ length: 40 }, (_, index) => index + 1);
  const inputs = { ...synthesisInputs(), manifest: manifestOf(forty), snapshot: snapshotOf(forty) };
  assert.equal(buildSynthesis({ ...inputs, openNow: [1, 2, 3, 4], openCount: 4 }).closed_since_snapshot.length, 36);
  assert.throws(() => buildSynthesis({ ...inputs, openNow: [1, 2, 3, 4], openCount: 30 }), /lists 4 issues but the issue tracker reports 30 open/);
});

test("applyLinks takes today's parents and sub-issues, and leaves closed issues as they were", () => {
  const snapshot = [{ number: 1, parent: null, sub_issues: [] }, { number: 2, parent: 9, sub_issues: [] }];
  const updated = applyLinks(snapshot, new Map([[1, { parent: 50, sub_issues: [3] }]]));
  assert.deepEqual(updated, [{ number: 1, parent: 50, sub_issues: [3] }, { number: 2, parent: 9, sub_issues: [] }]);
});

test("keepDestination puts a run under the state directory, one folder per repo", () => {
  const run = "/tmp/scratch/synthesize-backlog-20261018-0500";
  assert.equal(keepDestination({ run, repo: "o/r", environment: {}, home: "/home/u", platform: "linux" }), "/home/u/.local/state/synthesize-backlog/o-r/20261018-0500");
  assert.equal(keepDestination({ run, repo: "o/r", environment: { XDG_STATE_HOME: "/xdg" }, home: "/home/u", platform: "linux" }), "/xdg/synthesize-backlog/o-r/20261018-0500");
  assert.throws(() => keepDestination({ run, repo: "", environment: {}, home: "/home/u", platform: "linux" }), /no OWNER\/NAME repo/);
});

test("summaryLines names the run and marks threads an earlier session folded", () => {
  const synthesis = buildSynthesis({ ...synthesisInputs(), meta: { repo: "o/r", sha: "abcdef1234567890", date: "2026-10-18", area: "label:ux", refreshed: "2026-10-21" } });
  const text = summaryLines(synthesis, { b: { number: 412, attached: [1, 3, 4] }, a: 413 }).join("\n");
  assert.match(text, /^RUN: o\/r · run 2026-10-18 · code abcdef123456 · area label:ux · refreshed 2026-10-21/);
  assert.match(text, /SUGGESTED FIRST \(a recommendation; the order is the user's\): 1\. B \[b\], folded as #412/);
  assert.match(text, /1\. B \[b\] Strong, size M, scope several sessions, 3 open issues, folded as #412/);
  assert.match(text, /OTHER THREADS\n2\. A \[a\] Worth exploring, size M, scope several sessions, 3 open issues, folded as #413/);
  assert.equal(trackerPlan(synthesis, "b", { b: { number: 412, attached: [1] } }).folded_as, 412);
});

function finishedRun(t) {
  const { run, write } = writeRun(t);
  write("digests/batch-01.json", { digests: [1, 2, 3, 4].map((n) => digest(n)) });
  write("grouping.json", { candidates: [{ id: "one", name: "One", root_cause: "r", structural_change: "s", source_refs: ["architecture#0"] }], rejected: [] });
  write("verdicts/one.skeptic.json", skeptic());
  write("verdicts/one.fit.json", fit([[1, "full"], [2, "full"], [3, "partial"]]));
  write("ranking.json", ranking([{ id: "one", rank: 1, strength: "Strong", leverage_note: "n" }]));
  cli(["merge", run]);
  const final = cli(["final", run, "--repo", "o/r", "--sha", "abc", "--date", "2026-10-18"]);
  assert.equal(final.status, 0, final.stderr);
  return { run, write };
}

test("keep copies a finished run without its checkout, once", (t) => {
  const { run } = finishedRun(t);
  mkdirSync(join(run, "code", "src"), { recursive: true });
  writeFileSync(join(run, "code", "src", "index.ts"), "checkout");
  const destination = join(mkdtempSync(join(tmpdir(), "keep-")), "kept");
  t.after(() => rmSync(dirname(destination), { recursive: true, force: true }));
  const kept = cli(["keep", run, "--to", destination]);
  assert.equal(kept.status, 0, kept.stderr);
  assert.deepEqual(JSON.parse(kept.stdout), { kept: destination });
  assert.ok(existsSync(join(destination, "synthesis.json")) && existsSync(join(destination, "snapshot.json")));
  assert.ok(!existsSync(join(destination, "code")));
  assert.match(cli(["keep", run, "--to", destination]).stderr, /already exists/);
});

test("refresh re-applies today's open issues and links to a kept run, and folded records a tracker", (t) => {
  const { run, write } = finishedRun(t);
  write("open-now.json", [1, 2, 4]);
  writeFileSync(join(run, "links.jsonl"), `${JSON.stringify({ number: 2, parent: { number: 80 }, subIssues: { nodes: [] } })}\n`);
  assert.match(cli(["refresh", run]).stderr, /needs --open-count/);
  const refresh = cli(["refresh", run, "--open-count", "3", "--date", "2026-10-21"]);
  assert.equal(refresh.status, 0, refresh.stderr);
  const synthesis = JSON.parse(readFileSync(join(run, "synthesis.json"), "utf8"));
  assert.deepEqual(synthesis.closed_since_snapshot, [3]);
  assert.equal(synthesis.meta.refreshed, "2026-10-21");
  assert.equal(synthesis.meta.repo, "o/r");
  assert.match(refresh.stdout, /"closed_since_snapshot":\[3\],"opened_since_snapshot":\[\]/);
  const plan = JSON.parse(cli(["tracker", run, "one"]).stdout);
  assert.deepEqual(plan.attach, [1]);
  assert.deepEqual(plan.listed.map((entry) => entry.reason), ["already under #80", "closed since the snapshot"]);
  assert.equal(cli(["folded", run, "one", "#412", "--attached", "1"]).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(join(run, "folded.json"), "utf8")), { one: { number: 412, attached: [1] } });
  assert.match(cli(["summary", run]).stdout, /\[one\] Strong, size M, scope several sessions, 2 open issues, folded as #412/);
  assert.match(cli(["folded", run, "one", "413"]).stderr, /already recorded as folded into #412: pass --force/);
  assert.match(cli(["tracker", run, "one"]).stderr, /already folded as #412: pass --again only to extend it/);
  assert.match(cli(["folded", run, "ghost", "5"]).stderr, /no surviving thread/);
});

test("plan prints the fold round's short cards in the agreed order, with --leave", (t) => {
  const { run } = finishedRun(t);
  const plan = cli(["plan", run, "--order", "one", "--leave", "one:3"]);
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /^ORDER: one \(each card assumes the threads above it fold as planned\)\n\n1\. One \[one\] · Strong · size M · scope several sessions\n   cause: sharpened\n   would attach: #1 #2; lists #3 \(left for another thread\)/);
  assert.match(cli(["plan", run]).stderr, /usage: assemble\.mjs plan/);
  assert.match(cli(["plan", run, "--order", "one", "--leave", "one"]).stderr, /--leave takes/);
});
