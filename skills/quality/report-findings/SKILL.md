---
name: report-findings
description: "Publish audit findings to the issue tracker: fingerprint dedupe against existing issues, one tracking issue per sweep, capped child issues labelled for Triage (never with a state label, never as a PR). Also defines headless vs interactive audit modes, the docs/agents/audits.md dependency, incremental scope and targeted (single-target) runs. Use when an audit skill hands over findings, when resolving an audit's mode or scope, or when the user asks to file audit results as issues."
---

# Report Findings

The shared back half of every audit. An audit gathers evidence and builds **findings**; this skill decides the mode, shapes the findings, and publishes them without duplicates.

Findings go through the repo's Triage. Each becomes an issue carrying its `audit:<audit-name>` fingerprint label and **no** state label, never `ready-for-agent`; Matt's `triage` decides what happens next. Nothing here opens a PR.

The issue tracker should have been provided to you (`docs/agents/issue-tracker.md`). If it is missing, an interactive run tells the user to run `/setup-matt-pocock-skills`; a headless run assumes GitHub and says so in the report `summary`. This skill publishes to GitHub only. For any other tracker, an interactive run shows the findings table and stops; a headless run writes the report JSON as its final message and publishes nothing.

`<skill-dir>` below is the absolute path of the folder holding this SKILL.md.

## 1. Resolve the mode, settings and scope

Read [MODES.md](MODES.md). It defines **headless** and **interactive**, what each may do, how to read `docs/agents/audits.md` (and what to do when it is missing: the `audit-not-configured` finding), how to scope an incremental run, and when a run is **targeted** (one target or area, interactive only). An audit (a skill that calls this one first to resolve its mode and scope, reads `docs/agents/audits.md`, and calls it again to publish) calls this skill before gathering evidence, to get these rules, and again at the end, to publish. A skill that only files findings, without being an audit, calls it to publish; for them `docs/agents/audits.md` is optional, as MODES.md says.

## 2. Build findings

Each finding is one object matching [FINDINGS-SCHEMA.json](FINDINGS-SCHEMA.json). The rules that make dedupe work:

- **`rule`** is a stable kebab-case id for the kind of problem (`missing-auth-guard`, `journey-without-e2e`). Reuse the same id run after run.
- **`locator`** names *where* without line numbers: `path#symbol`, a route (`POST /api/items/:id/archive`), a journey id, or an external event id. Line numbers change on every edit and would defeat the fingerprint.
- **`fingerprint`** is omitted unless the finding has a natural id from its source, such as `<source>:<project>/<event-id>`.
- **`source`** is `external` whenever the finding derives from text a third party could write (error events, user feedback, email). External findings carry a `source:*` label so Triage knows a human must look before any agent acts on them, and they are never labelled `fix: mechanical`.
- **`fix`** is `mechanical` only when the change is unambiguous and needs no product or design judgement (add a missing index, fix a dead path in a doc, add a journey tag to a test title). The publisher labels those `fix: mechanical`, so Triage can send them straight on.
- **`severity`**: `critical` means users are harmed or data is exposed now; `high` means it will happen under foreseeable conditions; `medium` is real but contained; `low` is hygiene.
- **One finding per problem.** Twenty routes missing the same guard are twenty findings with one `rule`; the per-run cap keeps the issue count sane and the tracking issue lists the rest.

## 3. Publish

The publisher is `scripts/publish-findings.mjs` in this skill's folder. It does the writing, so publishing is the same in every mode and idempotent across runs:

```bash
node <skill-dir>/scripts/publish-findings.mjs <findings.json> \
  --severity-min <threshold> \
  --new-issues-max <new_issues_max from docs/agents/audits.md> \
  [--state-label <name>]... \
  [--headless] [--dry-run]
```

The threshold depends on the mode. **Headless**: `severity_min` from `docs/agents/audits.md`. **Interactive**: write only the findings the user chose to the report and pass `--severity-min low`, since the user's choice is the threshold.

Pass `--headless` in a headless run: the publisher then refuses a `targeted` report. Pass `--state-label` once for each triage state label the repo renamed in `docs/agents/triage-labels.md`; the defaults (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, `needs-design`) are built in.

What it does:

- Fingerprints each finding and matches it against every existing `audit:<name>` issue (open ones by label, closed ones leaving out old tracking issues), reading only the footer the publisher wrote, so a marker quoted in evidence is never mistaken for one.
- **Open match**: leaves it, and relabels it if its severity changed. **Closed as completed**: reopens it with the `regression` label and removes any state label it kept, so it goes back through Triage. **Closed as not planned**: suppresses it for good.
- Creates new issues, highest severity first, up to the cap, labelled `audit:<name>`, `severity:<level>`, `fix: mechanical` where it applies, and any `source:*` label. The rest are listed in the tracking issue.
- Creates one tracking issue per sweep (scope `incremental` or `full`), holding a task list and the audited SHA, and closes the previous run's tracking issue as superseded. A run with scope `none` (the `audit-not-configured` report) records no audited SHA, so the next run is a full one.
- A **targeted** run (scope `targeted`) opens no tracking issue: it never becomes the base of an incremental run and supersedes nothing. Its filed issues say which target they came from, and its JSON summary carries `target` and `notFiled` instead.
- When a sweep finds this audit's `audit-not-configured` issue still open, closes it as completed: the settings file exists now.
- Caps titles and bodies, fences evidence, and neutralises `@mentions`.
- Refuses, at its one call into `gh`, to run anything but `gh issue` and `gh label`, or to apply a state label.

Read its JSON summary and report it to the user: the tracking issue (or, for a targeted run, the target and anything not filed), plus created, reopened, suppressed and resolved counts.

## 4. Mechanical fixes (interactive only)

For each `mechanical` finding the user wants fixed now, make the change in the working tree with the user watching, run the checks the change touches, and show the diff. Mention the issue number so the user can reference it when they commit. Leave committing, pushing and any PR to the user and the repo's usual flow; never apply a state label to the issue. Headless runs skip this step entirely.
