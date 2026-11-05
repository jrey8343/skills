import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  parseYaml,
  readConfig,
  readSettings,
  meteredReason,
  parseCron,
  cronsClash,
  placeCrons,
  detectSources,
  planSchedule,
  run,
  parseArgs,
  configPath,
  workflowPath,
  clashOffsetMinutes,
  knownAudits,
  allowedTools,
  disallowedTools,
  offsetCron,
} from "./render-workflow.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "render-workflow.mjs");
const template = readFileSync(join(here, "..", "audits.md"), "utf8");
const sha = "0123456789abcdef0123456789abcdef01234567";
const mattSha = "4ae2317ddb22b046e26455e4f9c9b3aaaf62212d";

// The shipped template with its placeholders filled in, as the skill does on first run.
const filledTemplate = () =>
  template.replace('sha: ""', `sha: "${sha}"`).replace('sha: ""', `sha: "${mattSha}"`).replace("<repo>-audits", "acme-audits");

const repoWith = (t, auditsMd, files = {}) => {
  const root = mkdtempSync(join(tmpdir(), "render-workflow-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "docs", "agents"), { recursive: true });
  writeFileSync(join(root, configPath), auditsMd);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

const runCli = (root, ...args) => spawnSync(process.execPath, [script, "--repo", root, ...args], { encoding: "utf8" });

// ---- parsing ----

test("the YAML subset reads nested maps, lists, inline lists, scalars and comments", () => {
  const value = parseYaml(['a:', '  b: 3        # three', '  c: "x # not a comment"', "  d: [one, 'two']", "  e:", '    - "dist/**"', "    - plain", "  f: true", "  g:"].join("\n"));
  assert.deepEqual(value, { a: { b: 3, c: "x # not a comment", d: ["one", "two"], e: ["dist/**", "plain"], f: true, g: null } });
});

test("the YAML subset refuses duplicate keys, tabs and stray indentation", () => {
  assert.throws(() => parseYaml("a: 1\na: 2"), /duplicate key "a"/);
  assert.throws(() => parseYaml("a:\n\tb: 1"), /tabs are not allowed/);
  assert.throws(() => parseYaml("a: 1\n  b: 2"), /unexpected indentation/);
});

test("the shipped template parses and names only audits that exist", () => {
  const config = readConfig(template);
  assert.deepEqual(Object.keys(config.audits).sort(), Object.keys(knownAudits).sort());
  assert.equal(config.defaults.model, "claude-sonnet-5-5");
  assert.equal(config.ci.claude_auth, "subscription");
});

test("the unfilled template is refused: the skill never invents the sha or vault", () => {
  const settings = readSettings(readConfig(template));
  assert.ok(settings.errors.some((error) => /skills\.sha/.test(error)));
  assert.ok(settings.errors.some((error) => /ci\.claude_token/.test(error)));
  assert.ok(settings.errors.some((error) => /skills\.matt\.sha/.test(error)));
});

test("a missing skills.matt block is refused: scheduled audits call Matt's skills by name", () => {
  const config = readConfig(filledTemplate());
  delete config.skills.matt;
  assert.ok(readSettings(config).errors.some((error) => /skills\.matt: missing/.test(error)));
});

test("an unknown audit or top-level key is refused, not ignored", () => {
  const config = readConfig(filledTemplate());
  config.audits["sentry-triage"] = { cron: "1 2 * * *" };
  config.extra = 1;
  const { errors } = readSettings(config);
  assert.ok(errors.some((error) => /audits\.sentry-triage: no such audit/.test(error)));
  assert.ok(errors.some((error) => /unknown top-level key "extra"/.test(error)));
});

// ---- metered models ----

test("subscription models pass; metered and unknown ones are named with a reason", () => {
  for (const model of ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-4-5-20251001", "claude-3-5-sonnet-20241022", "sonnet", "opus"]) {
    assert.equal(meteredReason(model), null, model);
  }
  assert.match(meteredReason("us.anthropic.claude-sonnet-5-5-v1:0"), /Bedrock/);
  assert.match(meteredReason("claude-sonnet-5-5@20260101"), /Vertex/);
  assert.match(meteredReason("openai/gpt-5"), /provider route/);
  assert.match(meteredReason("gpt-5"), /not a Claude model/);
  assert.match(meteredReason("claude-sonnet-5-5[1m]"), /variant/);
});

test("a metered model in audits.md is refused with a clear message and nothing is written", (t) => {
  const text = filledTemplate().replace('    cron: "29 19 1,15 * *"   # fortnightly', '    cron: "29 19 1,15 * *"\n    model: us.anthropic.claude-sonnet-5-5-v1:0');
  const root = repoWith(t, text);
  const result = runCli(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /audits\.perf-audit: model "us\.anthropic\.claude-sonnet-5-5-v1:0" is metered or unknown: it is an Amazon Bedrock id/);
  assert.match(result.stderr, /Nothing was written/);
  assert.equal(existsSync(join(root, workflowPath)), false);
});

test("claude_auth other than subscription is refused as metered", () => {
  const config = readConfig(filledTemplate());
  config.ci.claude_auth = "api-key";
  const { errors } = readSettings(config);
  assert.ok(errors.some((error) => /ci\.claude_auth is "api-key".*per-token \(metered\)/.test(error)));
});

// ---- cron ----

test("invalid crons are refused with the reason", () => {
  assert.throws(() => parseCron("1 2 3 4"), /five fields/);
  assert.throws(() => parseCron("*/5 * * * *"), /minute must be one number/);
  assert.throws(() => parseCron("1 24 * * *"), /outside 0-23/);
  assert.throws(() => parseCron("1 2 * * MON"), /not a number/);
  assert.doesNotThrow(() => parseCron("29 19 1,15 * *"));
  assert.doesNotThrow(() => parseCron("5 1-5/2 * 1-6 0"));
});

test("crons clash only when they can fire in the same minute", () => {
  assert.equal(cronsClash(parseCron("23 19 * * 0"), parseCron("23 19 * * *")), true);
  assert.equal(cronsClash(parseCron("23 19 * * 0"), parseCron("23 19 * * 1")), false);
  assert.equal(cronsClash(parseCron("23 19 1 * *"), parseCron("23 19 * * 3")), true);
  assert.equal(cronsClash(parseCron("23 19 * * *"), parseCron("24 19 * * *")), false);
});

test("a clashing cron moves later by the offset, and the move is reported", () => {
  const { placed, offsets, errors } = placeCrons([
    { audit: "docs-audit", cron: "10 3 * * 1" },
    { audit: "test-audit", cron: "10 3 * * *" },
    { audit: "prune-docs", cron: "10  3 * * 1" },
  ]);
  assert.deepEqual(errors, []);
  assert.deepEqual(placed.map((entry) => entry.cron), ["10 3 * * 1", `${10 + clashOffsetMinutes} 3 * * *`, `${10 + 2 * clashOffsetMinutes} 3 * * 1`]);
  assert.deepEqual(offsets[0], { audit: "test-audit", from: "10 3 * * *", clashes_with: "docs-audit", to: "15 3 * * *" });
  assert.equal(offsets.length, 2);
});

test("a clash near the end of an hour carries into the next hour, never earlier or onto the hour", () => {
  const { placed, errors } = placeCrons([
    { audit: "security-audit", cron: "58 19 * * 0" },
    { audit: "test-audit", cron: "58 19 * * 0" },
    { audit: "docs-audit", cron: "55 23 * * *" },
    { audit: "prune-docs", cron: "55 23 * * *" },
  ]);
  assert.deepEqual(errors, []);
  assert.deepEqual(placed.map((entry) => entry.cron), ["58 19 * * 0", "5 20 * * 0", "55 23 * * *", "5 0 * * *"]);
});

test("a clash that would cross into an unnamed hour or another day is refused", () => {
  const { errors } = placeCrons([
    { audit: "security-audit", cron: "57 1,13 * * 0" },
    { audit: "test-audit", cron: "57 1,13 * * 0" },
    { audit: "docs-audit", cron: "57 23 * * 2" },
    { audit: "prune-docs", cron: "57 23 * * 2" },
  ]);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /audits\.test-audit\.cron: .*hour "1,13" isn't one number/);
  assert.match(errors[1], /audits\.prune-docs\.cron: .*crosses midnight/);
});

test("every rendered cron is valid and unique", (t) => {
  const text = filledTemplate().replace('cron: "41 19 * * 1"', 'cron: "23 19 * * *"');
  const root = repoWith(t, text);
  const result = runCli(root);
  assert.equal(result.status, 0, result.stderr);
  const crons = [...readFileSync(join(root, workflowPath), "utf8").matchAll(/- cron: "([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(crons).size, crons.length);
  for (const cron of crons) assert.doesNotThrow(() => parseCron(cron));
  const parsed = crons.map(parseCron);
  parsed.forEach((a, i) => parsed.slice(i + 1).forEach((b) => assert.equal(cronsClash(a, b), false)));
  assert.equal(JSON.parse(result.stdout).offsets[0].audit, "test-audit");
});

// ---- third-party text ----

test("perf-audit is left out and named when Sentry is in use", (t) => {
  const root = repoWith(t, filledTemplate(), { "package.json": JSON.stringify({ dependencies: { "@sentry/cloudflare": "^9.0.0" } }) });
  const result = runCli(root);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.deepEqual(summary.left_out.find((item) => item.audit === "perf-audit"), { audit: "perf-audit", sources: ["sentry"] });
  assert.ok(!summary.scheduled.some((entry) => entry.audit === "perf-audit"));
  const workflow = readFileSync(join(root, workflowPath), "utf8");
  assert.match(workflow, /^# {3}perf-audit: sentry$/m);
  assert.doesNotMatch(workflow, /^ {2}perf-audit:$/m);
});

test("Sentry and the Cloudflare MCP are detected from the repo; user feedback only when declared", (t) => {
  const root = repoWith(t, "", { ".mcp.json": '{"mcpServers":{"cloudflare-observability":{}}}', "apps/api/pyproject.toml": 'dependencies = ["sentry-sdk"]', "node_modules/x/package.json": '"@sentry/node"' });
  assert.deepEqual(detectSources(root), [{ source: "cloudflare-mcp", evidence: ".mcp.json" }, { source: "sentry", evidence: "apps/api/pyproject.toml" }]);
  const settings = readSettings(readConfig(filledTemplate().replace("third_party_text: []", "third_party_text: [user-feedback]")));
  const plan = planSchedule(settings, []);
  assert.deepEqual(plan.leftOut, [{ audit: "product-review", sources: ["user-feedback"] }]);
});

test("a repo with no third-party sources schedules every audit in the template", (t) => {
  const root = repoWith(t, filledTemplate());
  const summary = JSON.parse(runCli(root).stdout);
  assert.deepEqual(summary.left_out, []);
  assert.deepEqual(summary.scheduled.map((entry) => entry.audit), Object.keys(knownAudits).sort());
});

// ---- rendering ----

test("re-running with an unchanged audits.md leaves the workflow byte-identical and untouched", (t) => {
  const root = repoWith(t, filledTemplate());
  assert.equal(JSON.parse(runCli(root).stdout).status, "created");
  const path = join(root, workflowPath);
  const first = readFileSync(path);
  const firstMtime = statSync(path).mtimeMs;
  const again = runCli(root);
  assert.equal(JSON.parse(again.stdout).status, "unchanged");
  assert.deepEqual(readFileSync(path), first);
  assert.equal(statSync(path).mtimeMs, firstMtime);
  assert.equal(runCli(root, "--check").status, 0);
});

test("--check reports drift without writing", (t) => {
  const root = repoWith(t, filledTemplate());
  const result = runCli(root, "--check");
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).status, "would-create");
  assert.equal(existsSync(join(root, workflowPath)), false);
});

test("each job runs its audit headless on the subscription token, with an issues-only GitHub token", (t) => {
  const root = repoWith(t, filledTemplate());
  runCli(root);
  const workflow = readFileSync(join(root, workflowPath), "utf8");
  assert.match(workflow, /claude -p "\/security-audit headless dry-run"\n {10}--model claude-sonnet-5-5\n {10}--max-turns 60/);
  assert.match(workflow, /CLAUDE_CODE_OAUTH_TOKEN: op:\/\/acme-audits\/CLAUDE_CODE_OAUTH_TOKEN\/password/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ secrets\.AUDITS_GITHUB_TOKEN \}\}/);
  assert.match(workflow, new RegExp(`repository: jrey8343/skills\n {10}ref: ${sha}\n {10}path: \\.audit-skills\n`));
  assert.match(workflow, new RegExp(`repository: mattpocock/skills\n {10}ref: ${mattSha}\n {10}path: \\.audit-skills-matt\n`));
  assert.match(workflow, /' \.audit-skills \.audit-skills-matt\n/);
  assert.match(workflow, /uses: actions\/checkout@v7/);
  assert.match(workflow, /uses: actions\/setup-node@v7/);
  assert.match(workflow, /^permissions:\n {2}contents: read$/m);
  assert.doesNotMatch(workflow, /ANTHROPIC_API_KEY|pull-requests|git push/);
  // The service account token reaches only the 1Password step, never the model's.
  const runSteps = workflow.split("      - name: Run ").slice(1);
  for (const step of runSteps) assert.doesNotMatch(step.split("\n  ")[0], /OP_SERVICE_ACCOUNT_TOKEN/);
});

test("github_auth app mints an issues-only App token; dry_run false drops dry-run", (t) => {
  const text = filledTemplate().replace("github_auth: pat", "github_auth: app").replace("dry_run: true", "dry_run: false");
  const root = repoWith(t, text);
  runCli(root);
  const workflow = readFileSync(join(root, workflowPath), "utf8");
  assert.match(workflow, /permission-issues: write/);
  assert.match(workflow, /uses: actions\/create-github-app-token@v3\n {8}with:\n {10}client-id: \$\{\{ vars\.AUDITS_APP_CLIENT_ID \}\}/);
  assert.doesNotMatch(workflow, /app-id:/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ steps\.github\.outputs\.token \}\}/);
  assert.match(workflow, /claude -p "\/docs-audit headless"\n/);
});

test("removing every audit removes the workflow", (t) => {
  const root = repoWith(t, filledTemplate());
  runCli(root);
  writeFileSync(join(root, configPath), filledTemplate().replace(/\naudits:\n[\s\S]*?\n```/, "\n```"));
  const result = runCli(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "removed");
  assert.equal(existsSync(join(root, workflowPath)), false);
});

test("a missing audits.md is refused with the way to seed it", (t) => {
  const root = mkdtempSync(join(tmpdir(), "render-workflow-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = runCli(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /docs\/agents\/audits\.md is missing/);
});

test("run and parseArgs are usable in-process", (t) => {
  assert.deepEqual(parseArgs(["--repo", "x", "--check"]), { repo: "x", check: true });
  assert.throws(() => parseArgs(["--nope"]), /unknown argument/);
  const root = repoWith(t, filledTemplate());
  assert.equal(run({ repo: root, check: true }).status, "would-create");
});

test("the run grants only read-only git, the publisher and writes to the runner temp dir", () => {
  assert.ok(!allowedTools.some((tool) => ["Write", "Bash(git:*)", "Bash(node:*)"].includes(tool) || /^Bash\(gh /.test(tool)));
  assert.ok(allowedTools.includes("Write(/${{ runner.temp }}/**)"));
  assert.ok(allowedTools.every((tool) => !tool.startsWith("Bash(node") || tool.endsWith(".claude/skills/report-findings/scripts/publish-findings.mjs:*)")));
});

test("the install step installs both manifests' skills, flattened, and refuses a name both share", (t) => {
  const root = repoWith(t, filledTemplate());
  runCli(root);
  const workflow = readFileSync(join(root, workflowPath), "utf8");
  const install = /run: \|\n {10}mkdir -p \.claude\/skills\n {10}(node -e '[\s\S]*?' \.audit-skills \.audit-skills-matt)\n/.exec(workflow)[1].replace(/\n {10}/g, "\n");
  const work = mkdtempSync(join(tmpdir(), "install-"));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const source = (dir, skills) => {
    mkdirSync(join(work, dir, ".claude-plugin"), { recursive: true });
    writeFileSync(join(work, dir, ".claude-plugin", "plugin.json"), JSON.stringify({ skills: skills.map((name) => `./skills/x/${name}`) }));
    for (const name of skills) {
      mkdirSync(join(work, dir, "skills", "x", name), { recursive: true });
      writeFileSync(join(work, dir, "skills", "x", name, "SKILL.md"), name);
    }
  };
  source(".audit-skills", ["report-findings"]);
  source(".audit-skills-matt", ["domain-modeling", "writing-for-agents"]);
  mkdirSync(join(work, ".claude", "skills"), { recursive: true });
  const ok = spawnSync("bash", ["-c", install], { cwd: work, encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  for (const name of ["report-findings", "domain-modeling", "writing-for-agents"]) assert.equal(readFileSync(join(work, ".claude", "skills", name, "SKILL.md"), "utf8"), name);
  source(".audit-skills-matt", ["report-findings"]);
  const clash = spawnSync("bash", ["-c", install], { cwd: work, encoding: "utf8" });
  assert.notEqual(clash.status, 0);
  assert.match(clash.stderr, /two skills would install as report-findings/);
});

test("the run step forces headless and the dry-run setting on the publisher, and denies package runners and issue text", (t) => {
  const root = repoWith(t, filledTemplate());
  runCli(root);
  const workflow = readFileSync(join(root, workflowPath), "utf8");
  assert.match(workflow, /AUDITS_HEADLESS: "1"\n {10}AUDITS_DRY_RUN: "true"\n/);
  assert.match(workflow, /--disallowedTools "Bash\(npx:\*\),[^"]*Bash\(wrangler:\*\),[^"]*Bash\(gh issue view:\*\),Bash\(gh pr:\*\)"/);
  for (const tool of disallowedTools) assert.ok(!allowedTools.includes(tool));
  const live = repoWith(t, filledTemplate().replace("dry_run: true", "dry_run: false"));
  runCli(live);
  assert.match(readFileSync(join(live, workflowPath), "utf8"), /AUDITS_DRY_RUN: "false"/);
});

test("each job first checks its audit still reads no third-party text in use", (t) => {
  const root = repoWith(t, filledTemplate());
  runCli(root);
  const workflow = readFileSync(join(root, workflowPath), "utf8");
  assert.match(workflow, /run: node \.claude\/skills\/schedule-audits\/scripts\/render-workflow\.mjs --check-audit perf-audit\n/);
  for (const job of workflow.split("\n\n  ").slice(1)) {
    const checkAt = job.indexOf("--check-audit");
    assert.ok(checkAt > 0 && checkAt < job.indexOf("Load the Claude subscription token"), "the check runs before any token is loaded");
  }
  assert.equal(runCli(root, "--check-audit", "perf-audit").status, 0);
  writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { "@sentry/node": "8.0.0" } }));
  const drifted = runCli(root, "--check-audit", "perf-audit");
  assert.equal(drifted.status, 3);
  assert.equal(JSON.parse(drifted.stdout).status, "left-out");
  assert.equal(runCli(root, "--check-audit", "test-audit").status, 0);
});

test("unknown keys, non-map audit entries and out-of-range caps are refused", () => {
  const config = readConfig(filledTemplate());
  config.audits["test-audit"].max_turn = 200;
  config.defaults.new_issues_max = 51;
  config.ci.dryrun = true;
  config.audits["docs-audit"] = true;
  const { errors } = readSettings(config);
  assert.ok(errors.some((error) => /audits\.test-audit: unknown key "max_turn"/.test(error)));
  assert.ok(errors.some((error) => /new_issues_max must be a whole number from 0 to 50/.test(error)));
  assert.ok(errors.some((error) => /ci: unknown key "dryrun"/.test(error)));
  assert.ok(errors.some((error) => /audits\.docs-audit must be a map/.test(error)));
  const subagents = readConfig(filledTemplate());
  subagents.defaults.subagents_max = 0;
  assert.ok(readSettings(subagents).errors.some((error) => /subagents_max/.test(error)));
});

test("a CRLF audits.md reads like an LF one", () => {
  assert.deepEqual(readConfig(filledTemplate().replace(/\n/g, "\r\n")), readConfig(filledTemplate()));
});

test("an hourly cron wraps its minute instead of refusing; a starred step counts as unrestricted", () => {
  assert.deepEqual(offsetCron(["58", "*", "*", "*", "*"]), ["5", "*", "*", "*", "*"]);
  const { placed, errors } = placeCrons([
    { audit: "security-audit", cron: "58 * * * *" },
    { audit: "test-audit", cron: "58 * * * *" },
  ]);
  assert.deepEqual(errors, []);
  assert.deepEqual(placed.map((entry) => entry.cron), ["58 * * * *", "5 * * * *"]);
  const everyOtherDay = parseCron("5 3 */2 * 1");
  assert.equal(everyOtherDay.domAny, true);
  // */2 counts as a star, so this fires only on odd days that are Mondays, never on an even-day Tuesday.
  assert.equal(cronsClash(everyOtherDay, parseCron("5 3 2 * 2")), false);
});
