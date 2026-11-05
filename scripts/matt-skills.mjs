#!/usr/bin/env node
// Keeps scripts/matt-skills.json, the snapshot of Matt Pocock's pinned skill
// paths that lint-skills.mjs checks names against, in step with GitHub.
// Zero dependencies. Usage:
//   node scripts/matt-skills.mjs refresh <sha>     rewrite the snapshot from that commit
//   node scripts/matt-skills.mjs refresh --fabrik  rewrite it at the SHA in Fabrik's skills.lock.json
//   node scripts/matt-skills.mjs check             re-fetch at the snapshot's SHA, exit 1 on drift;
//                                                 when Fabrik's lock has moved on, exit 1 if Matt's set
//                                                 at the new SHA clashes with a skill here, else warn

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const repository = "mattpocock/skills";
const fabrikLockUrl = "https://raw.githubusercontent.com/jrey8343/fabrik/main/skills.lock.json";
const fetchTimeoutMs = 15_000;
const skillsMax = 500;
const fullSha = /^[0-9a-f]{40}$/;
const snapshotPath = join(dirname(fileURLToPath(import.meta.url)), "matt-skills.json");
const manifestPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".claude-plugin", "plugin.json");

/** Normalises a manifest's skill paths the way Fabrik's skillFolders() does: `skills/<...>/<name>`. */
export function snapshotFromManifest(manifestText, sha) {
  assert.match(sha, fullSha, "sha must be a 40-character commit SHA");
  const manifest = JSON.parse(manifestText);
  if (!Array.isArray(manifest.skills) || !manifest.skills.every((path) => typeof path === "string")) {
    throw new Error(`${repository}@${sha} plugin.json has no list of skill paths`);
  }
  assert.ok(manifest.skills.length <= skillsMax, "skill count exceeds sanity bound");
  const skills = manifest.skills.map((path) => {
    const segments = path.split("/").filter((segment) => segment !== "" && segment !== ".");
    if (segments[0] !== "skills" || segments.length < 2 || segments.includes("..")) {
      throw new Error(`${repository}@${sha} plugin.json lists ${path}, which is outside skills/`);
    }
    return segments.join("/");
  });
  return { repository, sha, skills: skills.sort() };
}

/** Skill paths here (plugin.json entries) whose last segment is also one of the snapshot's. */
export function clashingSkills(snapshot, ownSkillPaths) {
  const mattNames = new Set(snapshot.skills.map((path) => path.split("/").at(-1)));
  return ownSkillPaths.filter((path) => mattNames.has(path.split("/").filter(Boolean).at(-1)));
}

export function formatSnapshot(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(fetchTimeoutMs) });
  if (!response.ok) throw new Error(`GET ${url}: ${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchSnapshot(sha) {
  const url = `https://raw.githubusercontent.com/${repository}/${sha}/.claude-plugin/plugin.json`;
  return snapshotFromManifest(await fetchText(url), sha);
}

async function fabrikLockSha() {
  const lock = JSON.parse(await fetchText(fabrikLockUrl));
  assert.equal(lock.repository, repository, "Fabrik's skills.lock.json pins a different repository");
  assert.match(lock.sha, fullSha, "Fabrik's skills.lock.json sha is not a full SHA");
  return lock.sha;
}

async function refresh(arg) {
  const sha = arg === "--fabrik" ? await fabrikLockSha() : arg;
  if (!sha || !fullSha.test(sha)) throw new Error("usage: matt-skills.mjs refresh <40-char sha> | --fabrik");
  const snapshot = await fetchSnapshot(sha);
  writeFileSync(snapshotPath, formatSnapshot(snapshot));
  console.log(`wrote ${snapshot.skills.length} skills from ${repository}@${sha}`);
}

async function check() {
  const current = readFileSync(snapshotPath, "utf8");
  const { sha } = JSON.parse(current);
  const upstream = formatSnapshot(await fetchSnapshot(sha));
  if (upstream !== current) {
    console.error(`error  scripts/matt-skills.json drifted from ${repository}@${sha} (run refresh ${sha})`);
    process.exit(1);
  }
  console.log(`ok  snapshot matches ${repository}@${sha}`);
  await checkFabrikLock(sha);
}

// A moved lock only warns, unless Matt's set at the new SHA would collide with a skill here on install.
async function checkFabrikLock(sha) {
  let lockSha;
  try {
    lockSha = await fabrikLockSha();
  } catch (error) {
    console.log(`::warning::Fabrik's skills.lock.json is unreadable (${error.message})`);
    return;
  }
  if (lockSha === sha) return;
  const ownSkills = JSON.parse(readFileSync(manifestPath, "utf8")).skills ?? [];
  const clashes = clashingSkills(await fetchSnapshot(lockSha), ownSkills);
  if (clashes.length > 0) {
    console.error(`error  ${repository}@${lockSha} (Fabrik's lock) has skills named like ${clashes.join(", ")}; rename them here`);
    process.exit(1);
  }
  console.log(`::warning::Fabrik's skills.lock.json pins ${lockSha}; snapshot is at ${sha}. Run: npm run matt:refresh`);
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  if (command === "refresh") await refresh(arg);
  else if (command === "check") await check();
  else throw new Error("usage: matt-skills.mjs refresh <sha> | refresh --fabrik | check");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`error  ${error.message}`);
    process.exit(1);
  });
}
