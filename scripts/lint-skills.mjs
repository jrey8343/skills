#!/usr/bin/env node
// Lints the skills tree against this repo's invariants (see AGENTS.md).
// Zero dependencies. Usage:
//   node scripts/lint-skills.mjs                   check, exit 1 on any error
//   node scripts/lint-skills.mjs --write-manifest  also regenerate plugin.json's skills array

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const buckets = ["quality", "architecture", "product"];
// Audits are user-invoked, take the shared argument-hint and may not write (AGENTS.md, Audit skills).
const audits = ["security-audit", "test-audit", "perf-audit", "docs-audit", "prune-docs", "product-review", "persona-review"];
const auditArgumentHint = "[headless] [dry-run] [full] [area]";
const auditWriteTools = ["Edit", "Write", "NotebookEdit", "MultiEdit"];
// Required docs page sections, in this relative order (AGENTS.md, Docs pages).
const docsSections = ["What it does", "When to reach for it", "It's working if", "Where it fits"];
const scalarKeys = ["name", "description", "when_to_use"];
const descriptionCharsMax = 1536; // Claude Code truncates description + when_to_use here.
const skillCountMax = 200; // Sanity bound on the walk.
const frontmatterLinesMax = 60;
const markdownFilesMax = 2000;
const walkDepthMax = 8;
const manifestPath = join(".claude-plugin", "plugin.json");
const mattSnapshotPath = join("scripts", "matt-skills.json");
const skillNamePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Lints the repo at `root`. Returns { errors, skills }; writes the manifest when asked. */
export function lintRepo(root, { writeManifest = false } = {}) {
  assert.ok(existsSync(root), `repo root ${root} does not exist`);
  const errors = [];
  const fail = (where, message) => errors.push(`${where}: ${message}`);
  const skills = collectSkills(root, fail);
  for (const skill of skills) checkSkill(root, skill, fail);
  checkUniqueNames(root, skills, fail);
  const matt = readMattSnapshot(root);
  checkSkillToolCalls(root, skills, matt.snapshot, fail);
  checkMattNames(skills, matt, fail);
  checkAudits(root, skills, fail);
  checkManifest(root, skills, fail, writeManifest);
  checkDocsPages(root, skills, fail);
  checkHumanLinks(root, fail);
  return { errors, skills };
}

function isDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function collectSkills(root, fail) {
  const skillsRoot = join(root, "skills");
  const skills = [];
  if (!isDirectory(skillsRoot)) return skills;
  for (const bucket of readdirSync(skillsRoot).sort()) {
    const bucketDir = join(skillsRoot, bucket);
    if (!isDirectory(bucketDir)) continue;
    if (!buckets.includes(bucket)) {
      fail(`skills/${bucket}`, `unknown bucket (expected one of ${buckets.join(", ")})`);
      continue;
    }
    for (const name of readdirSync(bucketDir).sort()) {
      const dir = join(bucketDir, name);
      if (!isDirectory(dir)) continue;
      const skillMd = join(dir, "SKILL.md");
      if (!existsSync(skillMd)) {
        fail(relative(root, dir), "directory without SKILL.md");
        continue;
      }
      skills.push({ bucket, name, dir, skillMd, path: `skills/${bucket}/${name}` });
      assert.ok(skills.length <= skillCountMax, "skill count exceeds sanity bound");
    }
  }
  return skills;
}

// Minimal frontmatter reader: top-level `key: value` scalars plus nested blocks
// (skipped). Enough for this repo; anything fancier is a lint error.
export function readFrontmatter(text) {
  if (!text.startsWith("---\n")) return { error: "missing frontmatter" };
  const end = text.indexOf("\n---", 4);
  if (end === -1) return { error: "unterminated frontmatter" };
  const lines = text.slice(4, end).split("\n");
  if (lines.length > frontmatterLinesMax) return { error: "frontmatter too long" };

  const fields = {};
  const unquotedColonKeys = [];
  for (const line of lines) {
    if (line.trim() === "" || line.startsWith(" ") || line.startsWith("\t")) continue;
    const match = /^([a-zA-Z_-]+):(.*)$/.exec(line);
    if (!match) return { error: `unparseable frontmatter line: ${line}` };
    const key = match[1];
    let value = match[2].trim();
    const quoted = /^(["']).*\1$/.test(value);
    if (!quoted && value.includes(": ")) unquotedColonKeys.push(key);
    if (quoted) value = value.slice(1, -1).replace(/\\"/g, '"');
    if (scalarKeys.includes(key) && /^[|>][-+0-9]*$/.test(value)) {
      return { error: `"${key}" is a block scalar; use a single-line quoted value` };
    }
    fields[key] = value;
  }
  return { fields, unquotedColonKeys, body: text.slice(end + 4) };
}

function readOpenaiPolicy(skillDir) {
  const path = join(skillDir, "agents", "openai.yaml");
  if (!existsSync(path)) return { missing: true };
  const text = readFileSync(path, "utf8");
  return { missing: false, implicitDisabled: /allow_implicit_invocation:\s*false/.test(text) };
}

function checkSkill(root, skill, fail) {
  const where = relative(root, skill.skillMd);
  const fm = readFrontmatter(readFileSync(skill.skillMd, "utf8"));
  if (fm.error) {
    fail(where, fm.error);
    return;
  }
  skill.body = fm.body;
  skill.fields = fm.fields;
  skill.userInvoked = fm.fields["disable-model-invocation"] === "true";

  if (fm.fields.name !== skill.name) fail(where, `name "${fm.fields.name}" does not match directory "${skill.name}"`);
  if (!skillNamePattern.test(skill.name)) fail(where, "name must be lowercase-hyphenated");
  if (!fm.fields.description) fail(where, "missing description");
  for (const key of fm.unquotedColonKeys) fail(where, `"${key}" contains ": " and must be quoted`);

  const descriptionChars = (fm.fields.description ?? "").length + (fm.fields.when_to_use ?? "").length;
  if (descriptionChars > descriptionCharsMax) {
    fail(where, `description + when_to_use is ${descriptionChars} chars (max ${descriptionCharsMax})`);
  }

  const policy = readOpenaiPolicy(skill.dir);
  if (policy.missing) fail(where, "missing agents/openai.yaml");
  else if (policy.implicitDisabled !== skill.userInvoked) {
    fail(where, "disable-model-invocation and openai.yaml allow_implicit_invocation are out of sync");
  }
  checkSkillLinks(root, skill, fail);
}

function walkMarkdown(dir, found = [], depth = 0) {
  assert.ok(depth <= walkDepthMax, `directory nesting exceeds ${walkDepthMax} at ${dir}`);
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (isDirectory(path)) walkMarkdown(path, found, depth + 1);
    else if (entry.endsWith(".md")) found.push(path);
    assert.ok(found.length <= markdownFilesMax, "markdown file count exceeds sanity bound");
  }
  return found;
}

/** Markdown with fenced and inline code removed. */
function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, "").replace(/(`+)[^`\n][^\n]*?\1/g, "");
}

/** Relative link targets in markdown, ignoring code, URLs, anchors and placeholders such as "(link)" or "(<path>)". */
export function relativeLinks(text) {
  const prose = stripCode(text);
  const targets = [];
  for (const match of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (target === "" || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    if (!/[./]/.test(target) || /[<>]/.test(target)) continue;
    targets.push(target);
  }
  return targets;
}

// Every link inside a skill folder resolves, and stays inside that folder.
function checkSkillLinks(root, skill, fail) {
  for (const file of walkMarkdown(skill.dir)) {
    const where = relative(root, file);
    for (const target of relativeLinks(readFileSync(file, "utf8"))) {
      const resolved = resolve(dirname(file), target);
      if (resolved !== skill.dir && !resolved.startsWith(skill.dir + sep)) {
        fail(where, `link ${target} leaves the skill folder ${skill.path} (skills never link across folders)`);
      } else if (!existsSync(resolved)) {
        fail(where, `broken relative link: ${target}`);
      }
    }
  }
}

function checkUniqueNames(root, skills, fail) {
  const byName = new Map();
  for (const skill of skills) {
    const other = byName.get(skill.name);
    if (other) fail(skill.path, `duplicate skill name (also ${other.path}); both would install as ${skill.name}`);
    else byName.set(skill.name, skill);
  }
}

/** Names given directly after "Skill tool with", backticked or quoted. */
export function skillToolTargets(text) {
  const names = [...text.matchAll(/Skill tool with\s+["`]([^"`\n]+)["`]/g)].map((match) => match[1]);
  return names.filter((name) => !/[<>]/.test(name)); // "<name>" is a placeholder, not a call.
}

// Every Skill tool call, in any markdown file of a skill, names a model-invoked skill
// here or one of Matt's. pi's `/skill:<name>` form is refused outside code.
function checkSkillToolCalls(root, skills, mattSnapshot, fail) {
  const byName = new Map(skills.map((skill) => [skill.name, skill]));
  const mattNames = new Set((mattSnapshot?.skills ?? []).map((path) => path.split("/").at(-1)));
  for (const skill of skills) {
    for (const file of walkMarkdown(skill.dir)) {
      const where = relative(root, file);
      const text = readFileSync(file, "utf8");
      if (/\/skill:/.test(stripCode(text))) fail(where, 'uses pi\'s "/skill:<name>"; write "Call the Skill tool with `<name>`"');
      for (const name of skillToolTargets(text)) {
        const target = byName.get(name);
        if (target?.userInvoked) fail(where, `calls user-invoked skill "${name}" through the Skill tool (tell the user to run /${name})`);
        else if (!target && !mattNames.has(name)) fail(where, `Skill tool call names unknown skill "${name}" (not here or in Matt's set)`);
      }
    }
  }
}

/** Reads the checked-in snapshot of Matt Pocock's pinned skill paths. */
export function readMattSnapshot(root) {
  const path = join(root, mattSnapshotPath);
  if (!existsSync(path)) return { error: `missing ${mattSnapshotPath} (run node scripts/matt-skills.mjs refresh <sha>)` };
  const snapshot = JSON.parse(readFileSync(path, "utf8"));
  const valid =
    typeof snapshot.repository === "string" &&
    /^[0-9a-f]{40}$/.test(snapshot.sha ?? "") &&
    Array.isArray(snapshot.skills) &&
    snapshot.skills.every((skill) => typeof skill === "string");
  if (!valid) return { error: `${mattSnapshotPath} needs repository, a 40-character sha and a skills array` };
  return { snapshot };
}

// Both sets install flat into the same .claude/skills/, so a shared last segment collides.
function checkMattNames(skills, { snapshot, error }, fail) {
  if (error) {
    fail(mattSnapshotPath, error);
    return;
  }
  const mattByName = new Map(snapshot.skills.map((path) => [path.split("/").at(-1), path]));
  for (const skill of skills) {
    const clash = mattByName.get(skill.name);
    if (clash) fail(skill.path, `clashes with ${snapshot.repository}@${snapshot.sha} ${clash}`);
  }
}

function checkAudits(root, skills, fail) {
  for (const skill of skills) {
    if (!audits.includes(skill.name) || skill.fields === undefined) continue;
    const where = relative(root, skill.skillMd);
    if (!skill.userInvoked) fail(where, "audits are user-invoked (disable-model-invocation: true)");
    if (skill.fields["argument-hint"] !== auditArgumentHint) fail(where, `audits take argument-hint: "${auditArgumentHint}"`);
    if (!skill.fields["allowed-tools"]) fail(where, "audits need a single-line allowed-tools granting read-only tools");
    const tools = (skill.fields["allowed-tools"] ?? "").split(/[\s,]+/).map((tool) => tool.replace(/\(.*$/, ""));
    const writers = auditWriteTools.filter((tool) => tools.includes(tool));
    if (writers.length > 0) fail(where, `audit allowed-tools grants write tools: ${writers.join(", ")}`);
  }
}

function checkManifest(root, skills, fail, writeManifest) {
  const path = join(root, manifestPath);
  if (!existsSync(path)) {
    fail(manifestPath, "missing plugin manifest");
    return;
  }
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const expected = skills.map((skill) => `./${skill.path}`).sort();
  if (writeManifest) {
    manifest.skills = expected;
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const actual = Array.isArray(manifest.skills) ? [...manifest.skills].sort() : null;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(manifestPath, "skills array out of sync with skills/ (run npm run manifest)");
  }
}

// Every skill has a docs page and a README entry; every docs page has a skill.
function checkDocsPages(root, skills, fail) {
  const readmePath = join(root, "README.md");
  const readme = existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "";
  for (const skill of skills) {
    const page = `docs/${skill.bucket}/${skill.name}.md`;
    if (!existsSync(join(root, page))) fail(page, `missing docs page for ${skill.path}`);
    else checkDocsSections(page, skill.name, readFileSync(join(root, page), "utf8"), fail);
    if (!readme.includes(`](${page})`)) fail("README.md", `missing entry linking ${page}`);
  }
  const docsRoot = join(root, "docs");
  if (!isDirectory(docsRoot)) return;
  const known = new Set(skills.map((skill) => `docs/${skill.bucket}/${skill.name}.md`));
  for (const entry of readdirSync(docsRoot).sort()) {
    if (!isDirectory(join(docsRoot, entry))) continue;
    if (!buckets.includes(entry)) {
      fail(`docs/${entry}`, `unknown docs bucket (expected one of ${buckets.join(", ")})`);
      continue;
    }
    for (const file of walkMarkdown(join(docsRoot, entry))) {
      const page = relative(root, file).split(sep).join("/");
      if (!known.has(page)) fail(page, "docs page without a matching skill");
    }
  }
}

/** Title is `# <skill>`, and the required `## ` sections appear in AGENTS.md's order. */
export function checkDocsSections(page, name, text, fail) {
  const prose = text.replace(/```[\s\S]*?```/g, "");
  if (!prose.startsWith(`# ${name}\n`)) fail(page, `first line must be "# ${name}"`);
  const headings = [...prose.matchAll(/^## (.+?)\s*$/gm)].map((match) => match[1]);
  const present = headings.filter((heading) => docsSections.includes(heading));
  const missing = docsSections.filter((section) => !headings.includes(section));
  if (missing.length > 0) fail(page, `missing sections: ${missing.map((section) => `## ${section}`).join(", ")}`);
  const ordered = docsSections.filter((section) => present.includes(section));
  if (JSON.stringify([...new Set(present)]) !== JSON.stringify(ordered)) {
    fail(page, `sections out of order (expected ${docsSections.join(", ")})`);
  }
}

// Relative links in human docs must resolve.
function checkHumanLinks(root, fail) {
  const pages = ["README.md", "CREDITS.md", "AGENTS.md"].map((page) => join(root, page)).filter(existsSync);
  if (isDirectory(join(root, "docs"))) pages.push(...walkMarkdown(join(root, "docs")));
  for (const page of pages) {
    for (const target of relativeLinks(readFileSync(page, "utf8"))) {
      if (!existsSync(join(dirname(page), target))) fail(relative(root, page), `broken relative link: ${target}`);
    }
  }
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const writeManifest = process.argv.includes("--write-manifest");
  const { errors, skills } = lintRepo(root, { writeManifest });
  if (writeManifest) console.log(`wrote ${skills.length} skills to ${manifestPath}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`error  ${error}`);
    console.error(`\n${errors.length} error(s) across ${skills.length} skills`);
    process.exit(1);
  }
  console.log(`ok  ${skills.length} skills`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
