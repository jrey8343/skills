#!/usr/bin/env node
// Test double for the subset of `gh` that publish-findings.mjs uses.
// State lives in the JSON file named by FAKE_GH_STATE: { issues: [...], labels: [...], calls: [...] }.

import { readFileSync, writeFileSync } from "node:fs";

const statePath = process.env.FAKE_GH_STATE;
if (!statePath) {
  console.error("FAKE_GH_STATE is not set");
  process.exit(2);
}
const state = JSON.parse(readFileSync(statePath, "utf8"));
const args = process.argv.slice(2).filter((arg, index, all) => arg !== "--repo" && all[index - 1] !== "--repo");
const stdin = (() => {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
})();
state.calls.push(args);

const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};
const flags = (name) => args.flatMap((arg, index) => (arg === name ? [args[index + 1]] : []));
const findIssue = (number) => {
  const issue = state.issues.find((candidate) => candidate.number === Number(number));
  if (!issue) {
    console.error(`no issue ${number}`);
    process.exit(1);
  }
  return issue;
};
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));

const [noun, verb, target] = args;
let output = "";

if (noun === "label" && verb === "list") {
  output = JSON.stringify(state.labels.map((name) => ({ name })));
} else if (noun === "label" && verb === "create") {
  state.labels.push(target);
} else if (noun === "issue" && verb === "list") {
  const wanted = flags("--label");
  const limit = Number(flag("--limit"));
  const matches = state.issues
    .filter((issue) => wanted.every((label) => issue.labels.includes(label)))
    .sort((a, b) => b.number - a.number)
    .slice(0, limit)
    .map((issue) => ({ ...issue, labels: issue.labels.map((name) => ({ name })) }));
  output = JSON.stringify(matches);
} else if (noun === "issue" && verb === "create") {
  const number = state.issues.reduce((max, issue) => Math.max(max, issue.number), 0) + 1;
  state.issues.push({
    number,
    title: flag("--title"),
    body: stdin,
    labels: flags("--label"),
    state: "OPEN",
    stateReason: null,
  });
  output = `https://github.com/example/repo/issues/${number}\n`;
} else if (noun === "issue" && verb === "reopen") {
  const issue = findIssue(target);
  issue.state = "OPEN";
  issue.stateReason = "REOPENED";
} else if (noun === "issue" && verb === "close") {
  const issue = findIssue(target);
  issue.state = "CLOSED";
  issue.stateReason = flag("--reason") === "not planned" ? "NOT_PLANNED" : "COMPLETED";
} else if (noun === "issue" && verb === "edit") {
  const issue = findIssue(target);
  issue.labels = issue.labels.filter((label) => !flags("--remove-label").includes(label));
  issue.labels.push(...flags("--add-label").filter((label) => !issue.labels.includes(label)));
} else if (noun === "issue" && verb === "comment") {
  findIssue(target);
} else {
  console.error(`fake gh: unsupported command ${args.join(" ")}`);
  process.exit(2);
}

save();
process.stdout.write(output);
