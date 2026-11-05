import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { lintRepo, relativeLinks, skillToolTargets } from "./lint-skills.mjs";

const mattSha = "4ae2317ddb22b046e26455e4f9c9b3aaaf62212d";

function write(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function fixture(manifestSkills = []) {
  const root = mkdtempSync(join(tmpdir(), "lint-skills-"));
  write(root, ".claude-plugin/plugin.json", JSON.stringify({ name: "fixture", skills: manifestSkills }));
  write(
    root,
    "scripts/matt-skills.json",
    JSON.stringify({ repository: "mattpocock/skills", sha: mattSha, skills: ["skills/engineering/tdd"] }),
  );
  return root;
}

const docsPage = (name) =>
  `# ${name}\n\n## What it does\n\nX.\n\n## When to reach for it\n\nX.\n\n## It's working if\n\nX.\n\n## Where it fits\n\nX.\n`;

function addSkill(root, bucket, name, { body = "Body.\n", files = {}, frontmatter = "" } = {}) {
  const dir = `skills/${bucket}/${name}`;
  const userInvoked = frontmatter.includes("disable-model-invocation: true");
  write(root, `${dir}/SKILL.md`, `---\nname: ${name}\ndescription: Does a thing.\n${frontmatter}---\n${body}`);
  write(root, `${dir}/agents/openai.yaml`, `policy:\n  allow_implicit_invocation: ${!userInvoked}\n`);
  write(root, `docs/${bucket}/${name}.md`, docsPage(name));
  const readme = (() => {
    try {
      return readFileSync(join(root, "README.md"), "utf8");
    } catch {
      return "";
    }
  })();
  write(root, "README.md", `${readme}- [\`${name}\`](docs/${bucket}/${name}.md): does a thing.\n`);
  for (const [path, text] of Object.entries(files)) write(root, `${dir}/${path}`, text);
}

function lint(root) {
  try {
    return lintRepo(root).errors;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("an empty tree with no skills/ or docs/ passes", () => {
  assert.deepEqual(lint(fixture()), []);
});

test("a well-formed skill passes", () => {
  const root = fixture(["./skills/quality/some-audit"]);
  addSkill(root, "quality", "some-audit", { body: "See [REF.md](REF.md).\n", files: { "REF.md": "Ref.\n" } });
  assert.deepEqual(lint(root), []);
});

test("a skill named like one of Matt's fails, naming both", () => {
  const root = fixture(["./skills/quality/tdd"]);
  addSkill(root, "quality", "tdd");
  assert.deepEqual(lint(root), [
    `skills/quality/tdd: clashes with mattpocock/skills@${mattSha} skills/engineering/tdd`,
  ]);
});

test("manifest drift fails", () => {
  const root = fixture([]);
  addSkill(root, "product", "some-skill");
  assert.deepEqual(lint(root), [
    ".claude-plugin/plugin.json: skills array out of sync with skills/ (run npm run manifest)",
  ]);
});

test("--write-manifest repairs drift", () => {
  const root = fixture([]);
  addSkill(root, "product", "some-skill");
  assert.deepEqual(lintRepo(root, { writeManifest: true }).errors, []);
  const manifest = JSON.parse(readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8"));
  rmSync(root, { recursive: true, force: true });
  assert.deepEqual(manifest.skills, ["./skills/product/some-skill"]);
});

test("a link across skill folders fails", () => {
  const root = fixture(["./skills/architecture/one", "./skills/architecture/two"]);
  addSkill(root, "architecture", "one", { body: "See [two](../two/SKILL.md).\n" });
  addSkill(root, "architecture", "two");
  const errors = lint(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^skills\/architecture\/one\/SKILL\.md: link \.\.\/two\/SKILL\.md leaves the skill folder/);
});

test("a broken link in a reference file fails", () => {
  const root = fixture(["./skills/quality/some-audit"]);
  addSkill(root, "quality", "some-audit", { files: { "REF.md": "See [x](MISSING.md).\n" } });
  assert.deepEqual(lint(root), ["skills/quality/some-audit/REF.md: broken relative link: MISSING.md"]);
});

test("user-invoked frontmatter must agree with openai.yaml", () => {
  const root = fixture(["./skills/quality/some-audit"]);
  addSkill(root, "quality", "some-audit");
  const skillMd = join(root, "skills/quality/some-audit/SKILL.md");
  writeFileSync(skillMd, readFileSync(skillMd, "utf8").replace("---\nBody", "disable-model-invocation: true\n---\nBody"));
  assert.match(lint(root)[0], /out of sync/);
});

test("missing docs page, unknown bucket and name mismatch fail", () => {
  const root = fixture(["./skills/quality/some-audit"]);
  addSkill(root, "quality", "some-audit");
  rmSync(join(root, "docs/quality/some-audit.md"));
  write(root, "skills/engineering/x/SKILL.md", "---\nname: x\ndescription: d\n---\n");
  const skillMd = join(root, "skills/quality/some-audit/SKILL.md");
  writeFileSync(skillMd, readFileSync(skillMd, "utf8").replace("name: some-audit", "name: other"));
  const errors = lint(root).join("\n");
  assert.match(errors, /skills\/engineering: unknown bucket/);
  assert.match(errors, /docs\/quality\/some-audit\.md: missing docs page/);
  assert.match(errors, /name "other" does not match directory "some-audit"/);
});

test("relativeLinks skips URLs, anchors, placeholders and code", () => {
  const text = "[a](https://x.y) [b](#top) [c](link) [d](REF.md#part) [g](<x>/y.md) `[e](NO.md)` ``[`h`](NO.md)``\n```\n[f](NO.md)\n```\n";
  assert.deepEqual(relativeLinks(text), ["REF.md"]);
});

const auditFrontmatter =
  'disable-model-invocation: true\nargument-hint: "[headless] [dry-run] [full] [area]"\nallowed-tools: Read Grep Glob Bash(git log:*)\n';

test("Skill tool calls resolve to a model-invoked skill here or one of Matt's, in any skill markdown", () => {
  const root = fixture(["./skills/quality/report-findings", "./skills/quality/security-audit"]);
  addSkill(root, "quality", "report-findings");
  addSkill(root, "quality", "security-audit", {
    frontmatter: auditFrontmatter,
    body: "Call the Skill tool with `report-findings`, then the Skill tool with `tdd`. Use `headless`.\n",
    files: {
      "CLOUDFLARE.md": 'Call the Skill tool with `report-finding`. Call the Skill tool with "security-audit". Placeholder: Skill tool with `<name>`.\n',
    },
  });
  assert.deepEqual(lint(root), [
    'skills/quality/security-audit/CLOUDFLARE.md: Skill tool call names unknown skill "report-finding" (not here or in Matt\'s set)',
    'skills/quality/security-audit/CLOUDFLARE.md: calls user-invoked skill "security-audit" through the Skill tool (tell the user to run /security-audit)',
  ]);
});

test("pi's /skill: syntax fails outside code", () => {
  const root = fixture(["./skills/product/some-skill"]);
  addSkill(root, "product", "some-skill", { body: "Run `/skill:ok` in code.\n", files: { "REF.md": "Run /skill:tdd.\n" } });
  const errors = lint(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^skills\/product\/some-skill\/REF\.md: uses pi's "\/skill:<name>"/);
});

test("skillToolTargets takes only the name right after 'Skill tool with'", () => {
  assert.deepEqual(skillToolTargets('Call the Skill tool with `a-b` in `headless` mode; Skill tool with "c".'), ["a-b", "c"]);
});

test("a well-formed audit passes", () => {
  const root = fixture(["./skills/quality/test-audit"]);
  addSkill(root, "quality", "test-audit", { frontmatter: auditFrontmatter });
  assert.deepEqual(lint(root), []);
});

test("an audit must be user-invoked, take the shared argument-hint and grant no write tools", () => {
  const root = fixture(["./skills/product/persona-review"]);
  addSkill(root, "product", "persona-review", { frontmatter: 'argument-hint: "[area]"\nallowed-tools: Read, Edit, Write\n' });
  assert.deepEqual(lint(root), [
    "skills/product/persona-review/SKILL.md: audits are user-invoked (disable-model-invocation: true)",
    'skills/product/persona-review/SKILL.md: audits take argument-hint: "[headless] [dry-run] [full] [area]"',
    "skills/product/persona-review/SKILL.md: audit allowed-tools grants write tools: Edit, Write",
  ]);
});

test("a block-scalar description fails", () => {
  const root = fixture(["./skills/product/some-skill"]);
  addSkill(root, "product", "some-skill");
  const skillMd = join(root, "skills/product/some-skill/SKILL.md");
  writeFileSync(skillMd, readFileSync(skillMd, "utf8").replace("description: Does a thing.", "description: >-\n  Does a thing."));
  assert.deepEqual(lint(root), [
    'skills/product/some-skill/SKILL.md: "description" is a block scalar; use a single-line quoted value',
  ]);
});

test("docs pages outside a known bucket, or without a skill, fail", () => {
  const root = fixture();
  write(root, "docs/engineering/stale.md", "# stale\n");
  write(root, "docs/quality/nested/orphan.md", "# orphan\n");
  write(root, "docs/README.md", "# Docs\n");
  assert.deepEqual(lint(root), [
    "docs/engineering: unknown docs bucket (expected one of quality, architecture, product)",
    "docs/quality/nested/orphan.md: docs page without a matching skill",
  ]);
});

test("docs pages need the title and required sections in order", () => {
  const root = fixture(["./skills/architecture/one"]);
  addSkill(root, "architecture", "one");
  write(root, "docs/architecture/one.md", "# two\n\n## Where it fits\n\n## What it does\n\n## When to reach for it\n");
  assert.deepEqual(lint(root), [
    'docs/architecture/one.md: first line must be "# one"',
    "docs/architecture/one.md: missing sections: ## It's working if",
    "docs/architecture/one.md: sections out of order (expected What it does, When to reach for it, It's working if, Where it fits)",
  ]);
});
