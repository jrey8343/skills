#!/usr/bin/env node
// Test double for the subset of `gh` and `glab` that prune-worktrees.mjs uses.
// State lives in the JSON file named by FAKE_FORGE_STATE:
// { authenticated: bool, merged: [{ branch, number, sha, url }], calls: [...] }.

import { readFileSync, writeFileSync } from "node:fs";

const statePath = process.env.FAKE_FORGE_STATE;
if (!statePath) {
  console.error("FAKE_FORGE_STATE is not set");
  process.exit(2);
}
const state = JSON.parse(readFileSync(statePath, "utf8"));
const args = process.argv.slice(2);
state.calls.push(args);
writeFileSync(statePath, JSON.stringify(state));

const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};
const mergedFor = (branch) => state.merged.filter((pullRequest) => pullRequest.branch === branch);

if (args[0] === "auth" && args[1] === "status") {
  process.exit(state.authenticated ? 0 : 1);
}
if (args[0] === "pr" && args[1] === "list") {
  const items = mergedFor(flag("--head")).map(({ number, sha, url }) => ({ number, headRefOid: sha, url }));
  console.log(JSON.stringify(items));
  process.exit(0);
}
if (args[0] === "mr" && args[1] === "list") {
  const items = mergedFor(flag("--source-branch")).map(({ number, sha, url }) => ({ iid: number, sha, web_url: url }));
  console.log(JSON.stringify(items));
  process.exit(0);
}
console.error(`fake-forge: unsupported command: ${args.join(" ")}`);
process.exit(2);
