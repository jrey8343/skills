#!/usr/bin/env node
// Lints the skills tree against this repo's invariants (see CLAUDE.md).
// Zero dependencies. Usage:
//   node scripts/lint-skills.mjs              check, exit 1 on any error
//   node scripts/lint-skills.mjs --write-manifest
//                                            also regenerate plugin.json's skills array

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(repoRoot, "skills");
const bucketsPromoted = ["setup", "audits", "engineering", "productivity"];
const descriptionCharsMax = 1536; // Claude Code truncates description + when_to_use here.
const skillCountMax = 200; // Sanity bound on the walk.
const frontmatterLinesMax = 60;
const docsPagesMax = 400;

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

// Minimal frontmatter reader: top-level `key: value` scalars plus nested blocks
// (kept as raw text). Enough for this repo; anything fancier is a lint error.
function readFrontmatter(path) {
  const text = readFileSync(path, "utf8");
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
    fields[key] = value;
  }
  return { fields, unquotedColonKeys, body: text.slice(end + 4) };
}

function readOpenaiPolicy(skillDir) {
  const path = join(skillDir, "agents", "openai.yaml");
  if (!existsSync(path)) return { missing: true };
  const text = readFileSync(path, "utf8");
  return {
    missing: false,
    implicitDisabled: /allow_implicit_invocation:\s*false/.test(text),
  };
}

function collectSkills() {
  const skills = [];
  for (const bucket of readdirSync(skillsRoot)) {
    const bucketDir = join(skillsRoot, bucket);
    if (!statSync(bucketDir).isDirectory()) continue;
    if (!bucketsPromoted.includes(bucket)) {
      fail(`skills/${bucket}`, "unknown bucket");
      continue;
    }
    for (const name of readdirSync(bucketDir)) {
      const dir = join(bucketDir, name);
      if (!statSync(dir).isDirectory()) continue;
      const skillMd = join(dir, "SKILL.md");
      if (!existsSync(skillMd)) {
        fail(relative(repoRoot, dir), "directory without SKILL.md");
        continue;
      }
      skills.push({ bucket, name, dir, skillMd });
      assert.ok(skills.length <= skillCountMax, "skill count exceeds sanity bound");
    }
  }
  return skills;
}

const skills = collectSkills();
const byName = new Map();

for (const skill of skills) {
  const where = relative(repoRoot, skill.skillMd);
  const fm = readFrontmatter(skill.skillMd);
  if (fm.error) {
    fail(where, fm.error);
    continue;
  }
  skill.fields = fm.fields;
  skill.body = fm.body;
  skill.userInvoked = fm.fields["disable-model-invocation"] === "true";

  if (byName.has(skill.name)) fail(where, `duplicate skill name (also ${byName.get(skill.name).bucket})`);
  byName.set(skill.name, skill);

  if (fm.fields.name !== skill.name) fail(where, `name "${fm.fields.name}" does not match directory "${skill.name}"`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(skill.name)) fail(where, "name must be lowercase-hyphenated");
  if (!fm.fields.description) fail(where, "missing description");
  for (const key of fm.unquotedColonKeys) fail(where, `"${key}" contains ": " and must be quoted`);

  const descriptionChars = (fm.fields.description ?? "").length + (fm.fields.when_to_use ?? "").length;
  if (descriptionChars > descriptionCharsMax) fail(where, `description + when_to_use is ${descriptionChars} chars (max ${descriptionCharsMax})`);

  const policy = readOpenaiPolicy(skill.dir);
  if (policy.missing) fail(where, "missing agents/openai.yaml");
  else if (policy.implicitDisabled !== skill.userInvoked) {
    fail(where, "disable-model-invocation and openai.yaml allow_implicit_invocation are out of sync");
  }

  // Relative links to sibling reference files must resolve.
  for (const match of skill.body.matchAll(/\]\(([^)#\s]+)\)/g)) {
    const target = match[1];
    if (/^[a-z]+:/.test(target)) continue;
    if (!/[./]/.test(target)) continue; // A template placeholder such as "(link)".
    if (!existsSync(join(skill.dir, target))) fail(where, `broken relative link: ${target}`);
  }
}

// Skill tool calls may only name model-invoked skills that exist.
for (const skill of skills) {
  if (!skill.body) continue;
  const where = relative(repoRoot, skill.skillMd);
  for (const line of skill.body.split("\n")) {
    if (!/Skill tool/.test(line)) continue;
    for (const match of line.matchAll(/["`]([a-z0-9]+(?:-[a-z0-9]+)+|[a-z0-9]+)["`]/g)) {
      const target = byName.get(match[1]);
      if (!target) continue; // Not a skill name (e.g. a quoted word).
      if (target.userInvoked) fail(where, `calls user-invoked skill "${match[1]}" through the Skill tool`);
    }
  }
}

// Manifest, README and docs pages must list every skill.
const manifestPath = join(repoRoot, ".claude-plugin", "plugin.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const expectedSkillPaths = skills
  .map((s) => `./skills/${s.bucket}/${s.name}`)
  .sort();

if (process.argv.includes("--write-manifest")) {
  manifest.skills = expectedSkillPaths;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${expectedSkillPaths.length} skills to plugin.json`);
}

const manifestSkills = [...(manifest.skills ?? [])].sort();
if (JSON.stringify(manifestSkills) !== JSON.stringify(expectedSkillPaths)) {
  fail("plugin.json", "skills array out of sync (run with --write-manifest)");
}

const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
for (const skill of skills) {
  const link = `skills/${skill.bucket}/${skill.name}/SKILL.md`;
  if (!readme.includes(link)) fail("README.md", `missing link to ${link}`);
  const docsPage = join(repoRoot, "docs", skill.bucket, `${skill.name}.md`);
  if (!existsSync(docsPage)) fail(relative(repoRoot, docsPage), "missing docs page");
}

// Relative links in human docs must resolve.
function walkMarkdown(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walkMarkdown(path, found);
    else if (entry.endsWith(".md")) found.push(path);
    assert.ok(found.length <= docsPagesMax, "docs page count exceeds sanity bound");
  }
  return found;
}
for (const page of [join(repoRoot, "README.md"), join(repoRoot, "CREDITS.md"), ...walkMarkdown(join(repoRoot, "docs"))]) {
  const text = readFileSync(page, "utf8");
  for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (target === "" || /^[a-z]+:/.test(target)) continue;
    if (!/[./]/.test(target)) continue;
    if (!existsSync(join(dirname(page), target))) fail(relative(repoRoot, page), `broken relative link: ${match[1]}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`error  ${error}`);
  console.error(`\n${errors.length} error(s) across ${skills.length} skills`);
  process.exit(1);
}
console.log(`ok  ${skills.length} skills`);
