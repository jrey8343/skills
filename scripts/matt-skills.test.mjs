import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { snapshotFromManifest, formatSnapshot, clashingSkills } from "./matt-skills.mjs";

const sha = "4ae2317ddb22b046e26455e4f9c9b3aaaf62212d";

test("normalises and sorts manifest paths the way Fabrik does", () => {
  const manifest = JSON.stringify({ skills: ["./skills/productivity/grill-me", "./skills/engineering/tdd"] });
  assert.deepEqual(snapshotFromManifest(manifest, sha), {
    repository: "mattpocock/skills",
    sha,
    skills: ["skills/engineering/tdd", "skills/productivity/grill-me"],
  });
});

test("rejects paths outside skills/ and manifests without a skills list", () => {
  assert.throws(() => snapshotFromManifest(JSON.stringify({ skills: ["./other/tdd"] }), sha), /outside skills/);
  assert.throws(() => snapshotFromManifest(JSON.stringify({}), sha), /no list of skill paths/);
  assert.throws(() => snapshotFromManifest(JSON.stringify({ skills: [] }), "abc"), /40-character/);
});

test("the checked-in snapshot is in canonical form", () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), "matt-skills.json");
  const text = readFileSync(path, "utf8");
  const snapshot = JSON.parse(text);
  assert.equal(formatSnapshot(snapshot), text);
  assert.deepEqual(snapshot.skills, [...snapshot.skills].sort());
});

test("clashingSkills matches on the last path segment", () => {
  const snapshot = { repository: "mattpocock/skills", sha, skills: ["skills/engineering/tdd", "skills/productivity/grill-me"] };
  assert.deepEqual(clashingSkills(snapshot, ["./skills/quality/tdd", "./skills/quality/test-audit"]), ["./skills/quality/tdd"]);
  assert.deepEqual(clashingSkills(snapshot, []), []);
});
