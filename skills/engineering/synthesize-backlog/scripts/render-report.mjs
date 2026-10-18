#!/usr/bin/env node
// Renders a synthesize-backlog synthesis.json as one self-contained HTML report.
// Zero dependencies; needs Node 22+.
//
// Usage:
//   node render-report.mjs <synthesis.json> <report.html> [--issue-url PREFIX]
//
// PREFIX turns issue numbers into links (https://github.com/OWNER/NAME/issues/). Without it
// the links derive from synthesis.meta.repo when that is OWNER/NAME, else numbers stay plain.
// Every string is escaped and every number checked: issue titles and agent prose are untrusted.

import { readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { shaCharsShown, scopeOf, startsAt } from "./assemble.mjs";

export const threadsRenderedMax = 200;
export const issuesRenderedMax = 2_000;
const lensLabels = [
  ["architecture", "Architecture"], ["domain-invariants", "Domain invariants"], ["identity-access", "Identity and access"],
  ["runtime-robustness", "Runtime robustness"], ["delivery-system", "Delivery system"], ["product-journeys", "Product journeys"],
];
const strengthKey = { Strong: "strong", "Worth exploring": "worth", Speculative: "spec" };
const issueReference = /(?<![\w/&#])#(\d{1,6})\b/;

export const escapeHtml = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

const isIssueNumber = (value) => Number.isInteger(value) && value > 0;

export function issueLink(number, context, className = "ref") {
  assert.ok(isIssueNumber(number), `issue number must be a positive integer: ${JSON.stringify(number)}`);
  const issue = context.issues.get(number);
  const closed = context.closed.has(number);
  const weak = className.includes("chip") && context.weak?.has(number);
  const title = `#${number}${issue ? ` ${issue.title}` : ""}${closed ? " (closed since the snapshot)" : ""}${weak ? " (the skeptic doubts this fit)" : ""}`;
  const classes = [className, closed ? "closed" : "", weak ? "weak" : ""].filter(Boolean).join(" ");
  if (!context.issueUrl) return `<span class="${classes}" title="${escapeHtml(title)}">#${number}</span>`;
  return `<a class="${classes}" href="${escapeHtml(context.issueUrl)}${number}" title="${escapeHtml(title)}">#${number}</a>`;
}

// Inline Markdown: `code`, **bold** that hugs text (so src/**/*.ts stays a glob), and #123 links.
// Issue references are found in the raw text, so an escaped entity such as &#39; never becomes one.
export function inline(text, context) {
  return String(text ?? "").split(/(`[^`]+`)/).map((part) => {
    if (part.length > 1 && part.startsWith("`") && part.endsWith("`")) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
    return part.split(new RegExp(issueReference.source, "g")).map((piece, index) => {
      if (index % 2 === 1) return isIssueNumber(Number(piece)) ? issueLink(Number(piece), context) : escapeHtml(`#${piece}`);
      return escapeHtml(piece).replace(/(?<![\w/*])\*\*(?=\S)(.+?)(?<=\S)\*\*(?![\w/*])/g, "<strong>$1</strong>");
    }).join("");
  }).join("");
}

// A small Markdown subset: paragraphs, nested - and 1. lists, # headings, ``` fences, and
// "Wave N: …" headings for the landing order.
export function markdown(text, context) {
  const state = { out: [], stack: [], paragraph: [], fence: null };
  for (const line of String(text ?? "").split("\n")) markdownLine(line, state, context);
  if (state.fence) state.out.push(`<pre><code>${escapeHtml(state.fence.join("\n"))}</code></pre>`);
  flushParagraph(state, context);
  closeLists(state, -1);
  return state.out.join("\n");
}

function markdownLine(line, state, context) {
  if (state.fence) {
    if (/^\s*```/.test(line)) { state.out.push(`<pre><code>${escapeHtml(state.fence.join("\n"))}</code></pre>`); state.fence = null; }
    else state.fence.push(line);
    return;
  }
  if (/^\s*```/.test(line)) { flushParagraph(state, context); closeLists(state, -1); state.fence = []; return; }
  if (line.trim() === "") { flushParagraph(state, context); return; }
  const item = /^(\s*)([-*]|(\d+)\.)\s+(.*)$/.exec(line);
  if (item) {
    flushParagraph(state, context);
    openItem(state, item[1].length, item[3] ? "ol" : "ul", item[3] ? Number(item[3]) : 1);
    state.out.push(`<li>${inline(item[4], context)}`);
    return;
  }
  const indent = line.length - line.trimStart().length;
  if (state.stack.length > 0 && indent > state.stack.at(-1).indent) { state.out.push(` ${inline(line.trim(), context)}`); return; }
  closeLists(state, -1);
  const heading = /^#{1,6}\s+(.*)$/.exec(line.trim());
  const wave = /^Wave (\d+): (.*)$/.exec(line.trim());
  if (heading) { flushParagraph(state, context); state.out.push(`<h4>${inline(heading[1], context)}</h4>`); return; }
  if (wave) { flushParagraph(state, context); state.out.push(`<h4 class="wave"><span>Wave ${wave[1]}</span> ${inline(wave[2], context)}</h4>`); return; }
  state.paragraph.push(line.trim());
}

function flushParagraph(state, context) {
  if (state.paragraph.length > 0) state.out.push(`<p>${inline(state.paragraph.join(" "), context)}</p>`);
  state.paragraph = [];
}

function closeLists(state, indent) {
  while (state.stack.length > 0 && state.stack.at(-1).indent > indent) state.out.push(`</li></${state.stack.pop().tag}>`);
}

function openItem(state, indent, tag, start) {
  closeLists(state, indent);
  const top = state.stack.at(-1);
  if (top && top.indent === indent) {
    state.out.push("</li>");
    if (top.tag === tag) return;
    state.out.push(`</${state.stack.pop().tag}>`);
  }
  state.out.push(tag === "ol" && start !== 1 ? `<ol start="${start}">` : `<${tag}>`);
  state.stack.push({ indent, tag });
}

function lensDots(found) {
  const dots = lensLabels.map(([key, label]) => `<i class="dot${found.includes(key) ? " on" : ""}" title="${escapeHtml(label)}"></i>`).join("");
  const names = lensLabels.filter(([key]) => found.includes(key)).map(([, label]) => label).join(", ") || "the completeness critic";
  return `<span class="lenses" title="Found by: ${escapeHtml(names)}">${dots}<span class="lens-count">${found.length}/${lensLabels.length} lenses</span></span>`;
}

// Each issue sits in its best row only: full beats partial beats no.
function chipRows(thread, context) {
  const best = new Map();
  const rankOf = { full: 0, partial: 1, no: 2 };
  for (const entry of [...thread.members, ...thread.added]) {
    const previous = best.get(entry.number);
    if (previous === undefined || rankOf[entry.resolves] < rankOf[previous]) best.set(entry.number, entry.resolves);
  }
  const numbers = (resolves) => [...best].filter(([, value]) => value === resolves).map(([number]) => number).sort((a, b) => a - b);
  const chipContext = { ...context, weak: new Set(thread.weakest) };
  const row = (label, list, className, rowClass = "") =>
    list.length === 0 ? "" : `<div class="chiprow ${rowClass}"><span class="label">${label}</span>${list.map((number) => issueLink(number, chipContext, `chip ${className}`)).join("")}</div>`;
  const full = numbers("full");
  const partial = numbers("partial");
  return { html: row("Fully", full, "full") + row("Partly", partial, "part") + row("Checked, not solved", numbers("no"), "no", "muted"), full: full.length, partial: partial.length };
}

function remainderList(thread, context) {
  const items = [
    ...thread.members.filter((member) => member.resolves !== "full" && member.remainder).map((member) => `<li>${issueLink(member.number, context)} <span class="tag">${escapeHtml(member.resolves)}</span> ${inline(member.remainder, context)}</li>`),
    ...thread.added.map((member) => `<li>${issueLink(member.number, context)} <span class="tag">added, ${escapeHtml(member.resolves)}</span> ${inline(member.why, context)}</li>`),
  ];
  return items.length === 0 ? "" : `<details><summary>What is left on partly-solved issues</summary><div class="body"><ul class="remainders">${items.join("")}</ul></div></details>`;
}

function factList(thread, context) {
  const list = (items) => `<ul>${items.map((item) => `<li>${inline(item, context)}</li>`).join("")}</ul>`;
  const fact = (label, html) => `<div><dt>${label}</dt><dd>${html}</dd></div>`;
  return [
    fact("Lands after", thread.depends_on.length > 0 ? thread.depends_on.map((dependency) => inline(dependency, context)).join("; ") : "Nothing"),
    fact("Would supersede", thread.supersedes.filter(isIssueNumber).map((number) => issueLink(number, context)).join(" ") || "None"),
    thread.files.length > 0 ? fact("Files", thread.files.map((file) => `<code>${escapeHtml(file)}</code>`).join(" ")) : "",
    thread.overlaps.length > 0 ? fact("Overlaps", list(thread.overlaps)) : "",
    thread.adr_conflicts.length > 0 ? fact("ADRs", list(thread.adr_conflicts)) : "",
  ].join("");
}

function threadCard(thread, context) {
  const key = strengthKey[thread.strength];
  const chips = chipRows(thread, context);
  const evidence = thread.evidence.length > 0 ? `<p class="small">Checked in:</p><ul>${thread.evidence.map((item) => `<li>${inline(item, context)}</li>`).join("")}</ul>` : "";
  return `
<article class="thread" id="t-${escapeHtml(thread.id)}" data-strength="${key}" data-entry="${escapeHtml(thread.entry)}">
  <header class="thread-head"><span class="rank">${thread.rank}</span><div class="head-text">
    <h3>${inline(thread.name, context)} <span class="thread-id">${escapeHtml(thread.id)}</span></h3>
    <div class="meta"><span class="badge ${key}">${escapeHtml(thread.strength)}</span>
      ${context.folded[thread.id] ? `<span class="pill folded">Folded as ${issueLink(context.folded[thread.id], context)}</span>` : ""}
      <span class="pill" title="Size of the change">Size ${escapeHtml(thread.size)}</span>
      <span class="pill" title="The fit-checker's estimate of the work">Scope: ${escapeHtml(scopeOf(thread.entry))}</span>
      <span class="pill entry" title="A thread tracker starts with you grilling it, never with building">Starts at ${escapeHtml(startsAt(thread.entry))}</span>
      ${lensDots(thread.lenses)}<span class="count">${chips.full} fully · ${chips.partial} partly</span></div>
  </div></header>
  <p class="leverage"><strong>Why it sits here:</strong> ${inline(thread.leverage_note, context)}</p>
  <div class="chips">${chips.html}</div>
  <details><summary>Shared cause, as verified in the code</summary><div class="body"><p>${inline(thread.cause, context)}</p>${evidence}</div></details>
  <details><summary>A proposed change: the fit-checker's hypothesis, to grill before building</summary><div class="body">${markdown(thread.change, context)}</div></details>
  ${remainderList(thread, context)}
  <details><summary>Open decisions (${thread.open_decisions.length})</summary><div class="body"><ul>${thread.open_decisions.map((decision) => `<li>${inline(decision, context)}</li>`).join("")}</ul></div></details>
  <dl class="facts">${factList(thread, context)}</dl>
</article>`;
}

function bestStrength(number, context) {
  const keys = (context.claims[number] ?? []).map((claim) => strengthKey[context.threadById.get(claim.id)?.strength]);
  return ["strong", "worth", "spec"].find((key) => keys.includes(key)) ?? "none";
}

function panelData(synthesis, context) {
  const standalone = new Map(synthesis.standalone.map((entry) => [entry.number, entry.reason]));
  return Object.fromEntries(synthesis.issues.map((issue) => [issue.number, {
    title: issue.title, state: issue.state, severity: issue.severity, cause: issue.cause_hint, closed: context.closed.has(issue.number),
    threads: (context.claims[issue.number] ?? [])
      .map((claim) => ({ id: claim.id, resolves: claim.resolves, thread: context.threadById.get(claim.id) }))
      .filter((entry) => entry.thread)
      .sort((a, b) => a.thread.rank - b.thread.rank)
      .map((entry) => ({ id: entry.id, name: entry.thread.name, rank: entry.thread.rank, resolves: entry.resolves })),
    alone: standalone.get(issue.number) ?? null,
  }]));
}

function mapSection(synthesis, context) {
  const { counts } = synthesis;
  const percent = (part, whole) => (whole === 0 ? 0 : Math.round((100 * part) / whole));
  const bar = (label, part, whole) => `<div class="bar-row"><span>${label}</span><b>${part} / ${whole} · ${percent(part, whole)}%</b><div class="bar"><i style="width:${percent(part, whole)}%"></i></div></div>`;
  const tally = (strength) => synthesis.threads.filter((thread) => thread.strength === strength).length;
  const cells = synthesis.issues.map((issue) => {
    const classes = [bestStrength(issue.number, context), issue.state === "tracker" ? "tracker" : "", context.closed.has(issue.number) ? "closed" : ""].filter(Boolean).join(" ");
    return `<button type="button" class="cell ${classes}" data-n="${issue.number}" title="#${issue.number} ${escapeHtml(issue.title)}">${issue.number}</button>`;
  }).join("");
  return `
  <section aria-labelledby="map-h"><h2 id="map-h">The backlog, by strongest thread</h2>
    <div class="coverage">${bar("Open work items in at least one verified thread", counts.covered, counts.work_items)}${bar("Needs-triage issues in at least one verified thread", counts.needs_triage_covered, counts.needs_triage)}</div>
    <div class="legend"><span><i class="strong"></i>In a Strong thread (${tally("Strong")} threads)</span><span><i class="worth"></i>Best is Worth exploring (${tally("Worth exploring")})</span><span><i class="spec"></i>Best is Speculative (${tally("Speculative")})</span><span><i class="none"></i>Stands alone</span><span>Dotted: a tracker · struck: closed since the snapshot · dashed chip: the skeptic doubts the fit</span></div>
    <div class="map" role="group" aria-label="Open issues; select one to see its threads">${cells}</div>
    <div class="inspector" id="inspector" aria-live="polite"><p class="small">Select an issue to see which threads claim it.</p></div>
  </section>`;
}

function threadsSection(synthesis, context) {
  const tally = (strength) => synthesis.threads.filter((thread) => thread.strength === strength).length;
  const button = (value, label, pressed = false) => `<button type="button" class="filter-button" data-v="${value}" aria-pressed="${pressed}">${label}</button>`;
  return `
  <section aria-labelledby="threads-h"><h2 id="threads-h">Threads, in a suggested order</h2>
    <p class="small">Each thread is one shared cause and one structural change. A skeptic tried to refute it against the code; a fit-checker read every member issue and decided whether the change solves it fully, partly or not at all. The order is the ranker's suggestion, with its reason on each card: you set the real order, one thread at a time, when you fold.</p>
    <div class="filters">
      <div class="filter-group" data-filter="strength"><span class="eyebrow">Strength</span>${button("all", `All ${synthesis.threads.length}`, true)}${button("strong", `Strong ${tally("Strong")}`)}${button("worth", `Worth exploring ${tally("Worth exploring")}`)}${button("spec", `Speculative ${tally("Speculative")}`)}</div>
      <div class="filter-group" data-filter="entry"><span class="eyebrow">Scope</span>${button("all", "Any", true)}${button("implement", scopeOf("implement"))}${button("to-spec", scopeOf("to-spec"))}${button("wayfinder", scopeOf("wayfinder"))}</div>
    </div>
    <div class="threads">${synthesis.threads.length > 0 ? synthesis.threads.map((thread) => threadCard(thread, context)).join("") : "<p>No thread survived verification.</p>"}</div>
  </section>`;
}

function headerSection(synthesis, context) {
  const { meta, counts } = synthesis;
  const closed = synthesis.closed_since_snapshot;
  const pinned = meta.sha ? `Code was checked at <code>${escapeHtml(String(meta.sha).slice(0, shaCharsShown))}</code>, the default branch's tip when the run began.` : "";
  const drift = closed.length > 0 ? ` ${closed.length} of these issues closed while the run was going (struck through): ${closed.map((number) => issueLink(number, context)).join(" ")}.` : "";
  return `
  <header class="top">
    <span class="eyebrow">Backlog synthesis${meta.repo ? ` · ${escapeHtml(meta.repo)}` : ""}${meta.date ? ` · ${escapeHtml(meta.date)}` : ""}</span>
    <h1>${escapeHtml(context.title)}</h1>
    <p class="lede">Every open issue read, grouped by shared cause and checked against the code. ${counts.survived} structural changes survived; together they touch ${counts.covered} of ${counts.work_items} open work items, including ${counts.needs_triage_covered} of the ${counts.needs_triage} waiting for triage.</p>
    <div class="funnel" aria-label="How the run narrowed down"><span><b>${counts.work_items}</b> issues digested</span><span><b>${lensLabels.length}</b> lenses</span><span><b>${counts.lens_threads}</b> lens threads</span><span><b>${counts.candidates}</b> candidates</span><span><b>${counts.survived}</b> survived verification</span></div>
    <p class="caveat">Snapshot of ${meta.snapshot_count} open issues, ${meta.skipped_count} tracking issues skipped. ${pinned}${drift} Agent-written analysis: read a thread's cause and change before acting on it.</p>
  </header>`;
}

function urgentSection(synthesis, context) {
  const urgent = synthesis.ranking.urgent;
  if (urgent.length === 0) return "";
  const items = urgent.map((entry) => `<li>${issueLink(entry.number, context)}${entry.by ? ` <strong>by ${escapeHtml(entry.by)}</strong>` : ""}: ${inline(entry.why, context)}</li>`).join("");
  return `<section class="alert" aria-labelledby="alert-h"><h2 id="alert-h">Needs a step by hand before any thread lands</h2><ul>${items}</ul></section>`;
}

function restSections(synthesis, context) {
  const standalone = synthesis.standalone.map((entry) => {
    const issue = context.issues.get(entry.number);
    return `<li>${issueLink(entry.number, context)} <span class="alone-title">${escapeHtml(issue?.title ?? "")}</span><span class="why">${inline(entry.reason, context)}</span></li>`;
  }).join("");
  const late = synthesis.late_members.map((entry) => `<li>${issueLink(entry.number, context)} belongs in <a href="#t-${escapeHtml(entry.candidate_id)}">${escapeHtml(entry.candidate_id)}</a>: ${inline(entry.why, context)}</li>`).join("");
  const unplaced = synthesis.unplaced.length > 0 ? `<p class="small">Placed nowhere: ${synthesis.unplaced.map((number) => issueLink(number, context)).join(" ")}.</p>` : "";
  const dropped = synthesis.dropped.map((entry) => `<li><strong>${inline(entry.name, context)}</strong><p>${inline(entry.reason.replace(/^skeptic: /, ""), context)}</p></li>`).join("");
  const rejected = synthesis.rejected.map((entry) => `<li><strong>${inline(entry.name, context)}</strong> ${inline(entry.reason, context)}</li>`).join("");
  return `
  <section aria-labelledby="sequence-h"><h2 id="sequence-h">Suggested landing order</h2><div class="prose">${markdown(synthesis.ranking.sequencing, context)}</div></section>
  <section aria-labelledby="triage-h"><h2 id="triage-h">What this means for triage</h2><div class="prose">${markdown(synthesis.ranking.triage_implication, context)}</div></section>
  <section aria-labelledby="alone-h"><h2 id="alone-h">Issues that stand alone (${synthesis.standalone.length})</h2>
    <p class="small">The completeness critic placed every issue no verified thread claimed: into a thread it was missed from, or here, with the reason it stands alone.</p>
    ${late ? `<div class="prose"><p><strong>Missed from a thread:</strong></p><ul>${late}</ul></div>` : ""}<ul class="alone">${standalone}</ul>${unplaced}</section>
  <section aria-labelledby="drop-h"><h2 id="drop-h">Threads that didn't survive</h2>
    <p class="small">Dropped at verification, with the skeptic's reason.</p><ol class="dropped">${dropped || "<li>None.</li>"}</ol>
    <p class="small"><strong>Rejected at merge:</strong></p><ul class="dropped">${rejected || "<li>None.</li>"}</ul></section>
  <section aria-labelledby="how-h"><h2 id="how-h">How this was made</h2>
    <p class="small">Every open issue was snapshotted with its comments and digested for its mechanism. Six lenses (architecture, domain invariants, identity and access, runtime robustness, the delivery system, product journeys) proposed threads confirmed in code; a merge grouped them into candidates; for each candidate a skeptic tried to refute it and a fit-checker ruled on every member; a completeness critic placed what no thread claimed; a ranker weighed leverage against cost and suggested an order. The run itself wrote nothing to the issue tracker; fold writes only what you approve.</p></section>`;
}

const scriptSafe = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

function pageScript(synthesis, context) {
  const firstMember = synthesis.threads[0]?.members[0]?.number;
  return `<script>
const PANEL = ${scriptSafe(panelData(synthesis, context))};
const URL_PREFIX = ${scriptSafe(context.issueUrl)};
const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const inspector = document.getElementById("inspector");
function show(number) {
  const issue = PANEL[number]; if (!issue) return;
  document.querySelectorAll(".cell").forEach((cell) => cell.setAttribute("aria-pressed", cell.dataset.n === String(number) ? "true" : "false"));
  const threads = issue.threads.length
    ? "<ul>" + issue.threads.map((thread) => \`<li><a href="#t-\${escapeHtml(thread.id)}">\${escapeHtml(thread.rank)}. \${escapeHtml(thread.name)}</a> <span class="small">(\${escapeHtml(thread.resolves)})</span></li>\`).join("") + "</ul>"
    : \`<p class="small">In no thread.\${issue.alone ? " Stands alone: " + escapeHtml(issue.alone) : ""}</p>\`;
  const heading = URL_PREFIX ? \`<a href="\${escapeHtml(URL_PREFIX)}\${escapeHtml(number)}">\${escapeHtml(issue.title)}</a>\` : escapeHtml(issue.title);
  inspector.innerHTML = \`<span class="eyebrow">#\${escapeHtml(number)} · \${escapeHtml(issue.state)} · severity \${escapeHtml(issue.severity)}\${issue.closed ? " · closed since the snapshot" : ""}</span><h3>\${heading}</h3><p class="small">Cause hint: \${escapeHtml(issue.cause)}</p>\${threads}\`;
}
document.querySelector(".map").addEventListener("click", (event) => { const cell = event.target.closest(".cell"); if (cell) show(cell.dataset.n); });
const filters = { strength: "all", entry: "all" };
document.querySelectorAll(".filter-group").forEach((group) => group.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-button"); if (!button) return;
  group.querySelectorAll(".filter-button").forEach((other) => other.setAttribute("aria-pressed", other === button ? "true" : "false"));
  filters[group.dataset.filter] = button.dataset.v;
  document.querySelectorAll(".thread").forEach((card) => {
    card.hidden = !((filters.strength === "all" || card.dataset.strength === filters.strength) && (filters.entry === "all" || card.dataset.entry === filters.entry));
  });
}));
${isIssueNumber(firstMember) ? `show(${firstMember});` : ""}
</script>`;
}

function assertRenderable(synthesis) {
  assert.ok(Array.isArray(synthesis.threads) && Array.isArray(synthesis.issues), "synthesis needs threads and issues");
  assert.ok(synthesis.threads.length <= threadsRenderedMax, `at most ${threadsRenderedMax} threads render`);
  assert.ok(synthesis.issues.length <= issuesRenderedMax, `at most ${issuesRenderedMax} issues render`);
  assert.ok(synthesis.issues.every((issue) => isIssueNumber(issue.number)), "issue numbers must be positive integers");
  assert.ok(synthesis.threads.every((thread) => Number.isInteger(thread.rank)), "thread ranks must be integers");
  for (const thread of synthesis.threads) {
    const numbers = [...thread.members, ...thread.added].map((entry) => entry.number);
    assert.ok(numbers.every(isIssueNumber), `${thread.id}: member numbers must be positive integers`);
  }
}

// `folded` is the run's folded.json, when fold has opened thread trackers: each card says so.
export function renderReport(synthesis, { issueUrl = null, folded = {} } = {}) {
  assertRenderable(synthesis);
  const repo = String(synthesis.meta?.repo ?? "");
  const derivedUrl = /^[\w.-]+\/[\w.-]+$/.test(repo) ? `https://github.com/${repo}/issues/` : null;
  const foldedNumbers = Object.entries(folded)
    .map(([id, entry]) => [id, typeof entry === "number" ? entry : entry?.number])
    .filter(([, number]) => isIssueNumber(number));
  const context = {
    folded: Object.fromEntries(foldedNumbers),
    issues: new Map(synthesis.issues.map((issue) => [issue.number, issue])),
    closed: new Set(synthesis.closed_since_snapshot ?? []),
    claims: synthesis.claims ?? {},
    threadById: new Map(synthesis.threads.map((thread) => [thread.id, thread])),
    issueUrl: issueUrl ?? derivedUrl,
    title: `${repo.split("/").pop() || "Backlog"} backlog threads`.replace(/^\w/, (first) => first.toUpperCase()),
  };
  const top = synthesis.threads[0];
  const start = top ? `<section class="start" aria-labelledby="start-h"><span class="eyebrow">Suggested first</span><h2 id="start-h">${inline(top.name, context)}</h2><div class="prose">${markdown(synthesis.ranking.top_recommendation, context)}</div></section>` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(context.title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>${styles}</style></head>
<body><div class="wrap">${headerSection(synthesis, context)}${urgentSection(synthesis, context)}${start}${mapSection(synthesis, context)}${threadsSection(synthesis, context)}${restSections(synthesis, context)}</div>
${pageScript(synthesis, context)}</body></html>
`;
}

const styles = `
:root { --bg:#f2f4f5; --surface:#fff; --ink:#17202a; --muted:#56626e; --rule:#d5dce1; --accent:#2a5986;
  --strong:#1f7550; --strong-bg:#e0f1e8; --worth:#9a5d0c; --worth-bg:#f7ecda; --spec:#5f6974; --spec-bg:#e9edf0;
  --none-bg:#f7f8f9; --none-line:#b9c3cb; --alert:#9c3019; --alert-bg:#fbe9e3; --code-bg:#e8edf1;
  --display:"IBM Plex Sans Condensed","Arial Narrow",system-ui,sans-serif; --body:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace; color-scheme:light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#10151a; --surface:#171f27; --ink:#e3e8ed; --muted:#98a4b0; --rule:#29333e; --accent:#8db4dc;
  --strong:#5fc597; --strong-bg:#15301f; --worth:#e2a853; --worth-bg:#372a14; --spec:#a5afb9; --spec-bg:#232b34; --none-bg:#141a20; --none-line:#3d4855;
  --alert:#f2937a; --alert-bg:#381e18; --code-bg:#222b35; color-scheme:dark; } }
:root[data-theme="dark"] { --bg:#10151a; --surface:#171f27; --ink:#e3e8ed; --muted:#98a4b0; --rule:#29333e; --accent:#8db4dc;
  --strong:#5fc597; --strong-bg:#15301f; --worth:#e2a853; --worth-bg:#372a14; --spec:#a5afb9; --spec-bg:#232b34; --none-bg:#141a20; --none-line:#3d4855;
  --alert:#f2937a; --alert-bg:#381e18; --code-bg:#222b35; color-scheme:dark; }
* { box-sizing:border-box; } [hidden] { display:none !important; }
body { margin:0; background:var(--bg); color:var(--ink); font-family:var(--body); font-size:15px; line-height:1.55; }
.wrap { max-width:980px; margin:0 auto; padding-block:40px 80px; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); display:grid; gap:44px; }
h1,h2,h3,h4 { font-family:var(--display); text-wrap:balance; margin:0; line-height:1.2; }
h1 { font-size:40px; font-weight:700; } h2 { font-size:25px; font-weight:600; } h3 { font-size:19px; font-weight:600; } h4 { font-size:16px; }
p { margin:0; } a { color:var(--accent); }
a:focus-visible, button:focus-visible, summary:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
code { font-family:var(--mono); font-size:.86em; background:var(--code-bg); padding:.05em .3em; border-radius:3px; overflow-wrap:anywhere; }
pre { margin:0; padding:10px 12px; background:var(--code-bg); border-radius:4px; overflow-x:auto; } pre code { padding:0; background:none; }
.eyebrow { font-family:var(--mono); font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
.small, .caveat { font-size:13px; color:var(--muted); } .caveat { max-width:75ch; }
section { display:grid; gap:16px; min-width:0; }
.prose { display:grid; gap:10px; max-width:70ch; }
.prose ul, .prose ol, .body ul, .body ol, .alert ul { margin:0; padding-left:1.3em; display:grid; gap:4px; }
header.top { display:grid; gap:14px; } .lede { font-size:17px; max-width:64ch; }
.funnel { display:flex; flex-wrap:wrap; gap:6px 0; font-family:var(--mono); font-size:13px; }
.funnel span { padding:6px 12px; background:var(--surface); border:1px solid var(--rule); border-left-width:0; color:var(--muted); }
.funnel span:first-child { border-left-width:1px; border-radius:4px 0 0 4px; } .funnel span:last-child { border-radius:0 4px 4px 0; }
.funnel b { font-weight:500; color:var(--ink); font-variant-numeric:tabular-nums; }
.alert { background:var(--alert-bg); border:1px solid var(--alert); border-radius:6px; padding:16px 18px; }
.alert h2 { font-size:19px; color:var(--alert); }
.start { background:var(--surface); border:1px solid var(--rule); border-radius:6px; padding:20px 22px; gap:10px; }
.coverage { display:grid; gap:10px; }
.bar-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 12px; align-items:center; font-size:14px; }
.bar-row b { font-family:var(--mono); font-weight:500; font-variant-numeric:tabular-nums; }
.bar { grid-column:1 / -1; height:10px; background:var(--none-bg); border:1px solid var(--rule); border-radius:5px; overflow:hidden; }
.bar i { display:block; height:100%; background:var(--strong); }
.legend { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:13px; color:var(--muted); }
.legend i { display:inline-block; width:12px; height:12px; border-radius:2px; vertical-align:-1px; margin-right:5px; border:1px solid; }
.map { display:grid; grid-template-columns:repeat(auto-fill, minmax(44px, 1fr)); gap:3px; }
.cell { font:inherit; font-family:var(--mono); font-size:11px; padding:6px 0; border-radius:3px; border:1px solid; cursor:pointer; color:var(--ink); font-variant-numeric:tabular-nums; }
.cell.strong, .legend .strong { background:var(--strong-bg); border-color:var(--strong); }
.cell.worth, .legend .worth { background:var(--worth-bg); border-color:var(--worth); }
.cell.spec, .legend .spec { background:var(--spec-bg); border-color:var(--spec); }
.cell.none, .legend .none { background:var(--none-bg); border-color:var(--none-line); border-style:dashed; color:var(--muted); }
.cell.tracker { text-decoration:underline dotted; } .closed { text-decoration:line-through; opacity:.6; }
.cell[aria-pressed="true"] { outline:2px solid var(--ink); outline-offset:1px; }
.inspector { background:var(--surface); border:1px solid var(--rule); border-radius:6px; padding:14px 16px; display:grid; gap:8px; min-height:120px; }
.inspector h3 { font-size:17px; } .inspector ul { margin:0; padding-left:1.2em; }
.filters { display:flex; flex-wrap:wrap; gap:8px 18px; } .filter-group { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.filter-button { font:inherit; font-size:13px; padding:4px 10px; border-radius:14px; border:1px solid var(--rule); background:var(--surface); color:var(--ink); cursor:pointer; }
.filter-button[aria-pressed="true"] { background:var(--ink); color:var(--bg); border-color:var(--ink); }
.threads { display:grid; gap:14px; }
.thread { background:var(--surface); border:1px solid var(--rule); border-radius:6px; padding:18px 20px; display:grid; gap:12px; min-width:0; }
.thread-head { display:grid; grid-template-columns:auto minmax(0,1fr); gap:14px; align-items:start; }
.rank { font-family:var(--display); font-weight:700; font-size:26px; line-height:1; color:var(--muted); min-width:1.6ch; text-align:right; font-variant-numeric:tabular-nums; }
.head-text { display:grid; gap:8px; min-width:0; }
.meta { display:flex; flex-wrap:wrap; gap:6px 10px; align-items:center; font-size:13px; }
.badge { font-family:var(--mono); font-size:12px; padding:2px 8px; border-radius:3px; border:1px solid; }
.badge.strong { color:var(--strong); background:var(--strong-bg); } .badge.worth { color:var(--worth); background:var(--worth-bg); } .badge.spec { color:var(--spec); background:var(--spec-bg); }
.pill { font-family:var(--mono); font-size:12px; color:var(--muted); border:1px solid var(--rule); padding:1px 7px; border-radius:3px; } .pill.entry { color:var(--accent); }
.pill.folded { color:var(--strong); border-color:var(--strong); }
.thread-id { font-family:var(--mono); font-size:12px; font-weight:400; color:var(--muted); overflow-wrap:anywhere; }
.lenses { display:inline-flex; gap:3px; align-items:center; }
.dot { width:8px; height:8px; border-radius:50%; border:1px solid var(--muted); display:inline-block; } .dot.on { background:var(--ink); border-color:var(--ink); }
.lens-count, .count { margin-left:5px; color:var(--muted); font-size:12px; } .count { font-family:var(--mono); }
.leverage { max-width:75ch; } .chips { display:grid; gap:6px; }
.chiprow { display:flex; flex-wrap:wrap; gap:4px; align-items:center; } .chiprow .label { font-size:12px; color:var(--muted); width:54px; }
.chiprow.muted .label { width:auto; margin-right:6px; }
.chip { font-family:var(--mono); font-size:12px; text-decoration:none; padding:1px 7px; border-radius:3px; border:1px solid; color:var(--ink); font-variant-numeric:tabular-nums; }
.chip.full { background:var(--strong-bg); border-color:var(--strong); } .chip.part { border-color:var(--worth); } .chip.no { border-color:var(--rule); color:var(--muted); }
.chip.weak { border-style:dashed; }
details { border-top:1px solid var(--rule); padding-top:8px; } summary { cursor:pointer; font-size:14px; font-weight:500; }
.body { padding-top:8px; display:grid; gap:8px; max-width:78ch; font-size:14px; }
.remainders .tag { font-family:var(--mono); font-size:11px; color:var(--muted); }
.facts { margin:0; display:grid; gap:6px; font-size:13px; border-top:1px solid var(--rule); padding-top:10px; }
.facts div { display:grid; grid-template-columns:92px minmax(0,1fr); gap:10px; } .facts dt { color:var(--muted); } .facts dd { margin:0; min-width:0; }
.facts ul { margin:0; padding-left:1.1em; }
.ref { font-family:var(--mono); font-size:.9em; text-decoration:none; font-variant-numeric:tabular-nums; } a.ref:hover { text-decoration:underline; }
h4.wave { margin-top:10px; }
h4.wave span { font-family:var(--mono); font-size:12px; font-weight:500; background:var(--ink); color:var(--bg); padding:2px 7px; border-radius:3px; margin-right:6px; }
.alone { list-style:none; margin:0; padding:0; }
.alone li { display:grid; grid-template-columns:56px minmax(0,1fr); gap:2px 10px; padding:8px 0; border-bottom:1px solid var(--rule); font-size:14px; }
.alone .why { grid-column:2; color:var(--muted); font-size:13px; }
.dropped { display:grid; gap:14px; margin:0; padding-left:1.2em; } .dropped p { color:var(--muted); font-size:14px; margin-top:4px; max-width:78ch; }
@media (max-width:560px) { h1 { font-size:31px; } .thread { padding:14px; } .facts div, .alone li { grid-template-columns:minmax(0,1fr); } .alone .why { grid-column:1; } }
`;

export function parseArgs(argv) {
  const options = { input: null, output: null, issueUrl: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--issue-url") options.issueUrl = argv[++index] ?? "";
    else if (!arg.startsWith("--") && options.input === null) options.input = arg;
    else if (!arg.startsWith("--") && options.output === null) options.output = arg;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (options.input === null || options.output === null) throw new Error("usage: render-report.mjs <synthesis.json> <report.html>");
  if (options.issueUrl !== null && !/^https:\/\//.test(options.issueUrl)) throw new Error("--issue-url must start with https://");
  return options;
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const foldedPath = join(dirname(options.input), "folded.json");
    const folded = existsSync(foldedPath) ? JSON.parse(readFileSync(foldedPath, "utf8")) : {};
    const html = renderReport(JSON.parse(readFileSync(options.input, "utf8")), { ...options, folded });
    writeFileSync(options.output, html);
    console.log(`wrote ${options.output} (${Buffer.byteLength(html)} bytes)`);
  } catch (error) {
    console.error(`render-report: ${error.message}`);
    process.exit(1);
  }
}
