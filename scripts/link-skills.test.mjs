import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readlinkSync, existsSync, rmSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "link-skills.sh");
const dests = [".claude/skills", ".agents/skills"];

// A throwaway repo holding a copy of the script (it links the repo it lives in) and a temp HOME.
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "link-skills-")));
  const repo = join(root, "repo");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  copyFileSync(script, join(repo, "scripts", "link-skills.sh"));
  mkdirSync(join(repo, "skills", "quality", "some-audit"), { recursive: true });
  writeFileSync(join(repo, "skills", "quality", "some-audit", "SKILL.md"), "---\nname: some-audit\n---\n");
  return { root, repo, home: join(root, "home") };
}

function run({ repo, home }, ...args) {
  return execFileSync("bash", [join(repo, "scripts", "link-skills.sh"), ...args], {
    env: { ...process.env, HOME: home },
    encoding: "utf8",
  });
}

test("links every skill into both harness directories, flattened, and unlinks them", () => {
  const paths = fixture();
  try {
    run(paths);
    for (const dest of dests) {
      assert.equal(readlinkSync(join(paths.home, dest, "some-audit")), join(paths.repo, "skills", "quality", "some-audit"));
    }
    run(paths, "--unlink");
    for (const dest of dests) assert.equal(existsSync(join(paths.home, dest, "some-audit")), false);
  } finally {
    rmSync(paths.root, { recursive: true, force: true });
  }
});

test("a missing skills/ is not an error", () => {
  const paths = fixture();
  try {
    rmSync(join(paths.repo, "skills"), { recursive: true });
    assert.match(run(paths), /nothing to link/);
  } finally {
    rmSync(paths.root, { recursive: true, force: true });
  }
});
