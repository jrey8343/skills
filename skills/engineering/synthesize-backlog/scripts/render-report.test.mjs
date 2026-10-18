import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReport, markdown, inline, escapeHtml, parseArgs } from "./render-report.mjs";

const context = (overrides = {}) => ({
  issues: new Map([[7, { number: 7, title: "Seven <b>" }]]), closed: new Set(), claims: {}, threadById: new Map(),
  issueUrl: "https://github.com/o/r/issues/", ...overrides,
});

const thread = (overrides = {}) => ({
  id: "one-guard", rank: 1, strength: "Strong", leverage_note: "Closes #1.", name: "One guard <script>", lenses: ["architecture"], origin: "merge",
  cause: "Every route decides alone.", change: "- Add `requireAccess`\n  - mount it on every router", size: "L", entry: "to-spec",
  members: [{ number: 1, resolves: "full", remainder: "" }, { number: 2, resolves: "partial", remainder: "copy" }],
  added: [{ number: 3, resolves: "partial", why: "same guard" }, { number: 1, resolves: "partial", why: "repeat" }],
  supersedes: [1], depends_on: [], open_decisions: ["Budget"], files: ["src/guard.ts"], evidence: ["src/routes.ts: no guard"],
  weakest: [2], adr_conflicts: [], existing_proposals: [1], overlaps: [], ...overrides,
});

const synthesis = (overrides = {}) => ({
  meta: { repo: "o/r", sha: "abcdef1234567890", date: "2026-10-18", snapshot_count: 4, skipped_count: 1 },
  counts: { work_items: 3, lens_threads: 5, candidates: 2, survived: 1, covered: 3, needs_triage: 2, needs_triage_covered: 2 },
  threads: [thread()],
  claims: { 1: [{ id: "one-guard", resolves: "full" }], 2: [{ id: "one-guard", resolves: "partial" }], 3: [{ id: "one-guard", resolves: "partial" }] },
  dropped: [{ id: "x", name: "Topic", reason: "skeptic: a topic, not a cause" }], rejected: [],
  standalone: [], late_members: [], unplaced: [], closed_since_snapshot: [2],
  issues: [1, 2, 3].map((n) => ({ number: n, title: `Issue ${n}</script><script>alert(1)</script>`, state: "needs-triage", severity: "high", kind: "bug", cause_hint: "c" })),
  ranking: { sequencing: "Wave 0: now\n- #1 first", top_recommendation: "Start with **one guard**.", triage_implication: "1. Fold #2", urgent: [] },
  ...overrides,
});

test("escapeHtml covers the five special characters", () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

test("inline links issue numbers outside code spans, and never inside an escaped entity", () => {
  const html = inline("See #7 and `#7` and **bold** and it's", context());
  assert.match(html, /<a class="ref" href="https:\/\/github.com\/o\/r\/issues\/7" title="#7 Seven &lt;b&gt;">#7<\/a>/);
  assert.match(html, /<code>#7<\/code>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /it&#39;s$/);
});

test("inline leaves a glob alone rather than bolding it", () => {
  assert.ok(!inline("src/**/*.ts and lib/**/*.ts", context()).includes("<strong>"));
});

test("inline renders a hash that isn't an issue number as plain text", () => {
  assert.equal(inline("text colour #000 on white", context()), "text colour #000 on white");
});

test("inline leaves numbers plain with no issue URL, and marks closed issues", () => {
  assert.match(inline("#7", context({ issueUrl: null, closed: new Set([7]) })), /<span class="ref closed" title="#7 Seven &lt;b&gt; \(closed since the snapshot\)">#7<\/span>/);
});

test("markdown builds nested lists, headings, fences and wave headings with balanced tags", () => {
  const html = markdown("Wave 1: identity\n- one\n  - nested\n- two\n3. third\n\n### Modules\n```ts\nconst x = 1 < 2;\n```\nA paragraph\nthat wraps.", context());
  assert.match(html, /<h4 class="wave"><span>Wave 1<\/span> identity<\/h4>/);
  assert.match(html, /<ul>\n<li>one\n<ul>\n<li>nested\n<\/li><\/ul>/);
  assert.match(html, /<ol start="3">/);
  assert.match(html, /<h4>Modules<\/h4>/);
  assert.match(html, /<pre><code>const x = 1 &lt; 2;<\/code><\/pre>/);
  assert.match(html, /<p>A paragraph that wraps\.<\/p>/);
  for (const tag of ["ul", "ol", "li"]) {
    assert.equal((html.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length, (html.match(new RegExp(`</${tag}>`, "g")) ?? []).length, tag);
  }
});

test("renderReport escapes untrusted titles everywhere, including the embedded panel data", () => {
  const html = renderReport(synthesis());
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(!html.includes("One guard <script>"));
  assert.equal((html.match(/<script>/g) ?? []).length, 1);
  assert.match(html, /\\u003c\/script>/);
});

test("renderReport refuses a number field that isn't a number", () => {
  assert.throws(() => renderReport(synthesis({ threads: [thread({ rank: "<img src=x onerror=alert(1)>" })] })), /ranks must be integers/);
  assert.throws(() => renderReport(synthesis({ threads: [thread({ added: [{ number: "<svg onload=alert(1)>", resolves: "full", why: "" }] })] })), /positive integers/);
});

test("renderReport puts an issue in its best row once, dashes the skeptic's doubts and strikes closed issues", () => {
  const html = renderReport(synthesis());
  assert.equal((html.match(/class="chip [a-z]+[^"]*"[^>]*>#1</g) ?? []).length, 1);
  assert.match(html, /class="chip part closed weak"[^>]*>#2</);
  assert.match(html, /class="cell strong closed" data-n="2"/);
  assert.match(html, /<dt>Files<\/dt><dd><code>src\/guard\.ts<\/code>/);
  assert.match(html, /<title>R backlog threads<\/title>/);
});

test("renderReport shows the urgent section only when the ranking lists something", () => {
  assert.ok(!renderReport(synthesis()).includes('id="alert-h"'));
  const urgent = synthesis({ ranking: { ...synthesis().ranking, urgent: [{ number: 3, why: "certificate expires Friday", by: "2026-11-06" }] } });
  assert.match(renderReport(urgent), /id="alert-h"[\s\S]*by 2026-11-06/);
});

test("renderReport renders a run in which no thread survived", () => {
  const html = renderReport(synthesis({ threads: [], claims: {} }));
  assert.match(html, /No thread survived verification/);
  assert.ok(!html.includes('id="start-h"'));
});

test("parseArgs insists on an https issue URL", () => {
  assert.throws(() => parseArgs(["s.json", "r.html", "--issue-url", "javascript:alert(1)"]), /https/);
  assert.equal(parseArgs(["s.json", "r.html"]).issueUrl, null);
});
