---
name: report-findings
description: "Publish audit findings to the issue tracker: fingerprint dedupe against existing issues, one tracking issue per run, labelled child issues, hard caps, and PRs for mechanical fixes. Also defines headless vs interactive audit modes and incremental scope. Use when an audit skill hands over findings, when resolving an audit's mode or scope, or when the user asks to file audit results as issues."
---

# Report Findings

The shared back half of every audit. An audit gathers evidence and builds **findings**; this skill decides the mode, shapes the findings, and publishes them without duplicates.

The issue tracker should have been provided to you (`docs/agents/issue-tracker.md`). If not, tell the user to run `/setup-standards`. This skill publishes to GitHub; for any other tracker, show the findings table and stop.

## 1. Resolve the mode and scope

Read [MODES.md](MODES.md). It defines **headless** and **interactive**, what each may do, and how to scope an incremental run. Every audit calls this skill before gathering evidence, to get these rules, and again at the end, to publish.

## 2. Build findings

Each finding is one object matching [FINDINGS-SCHEMA.json](FINDINGS-SCHEMA.json). The rules that make dedupe work:

- **`rule`** is a stable kebab-case id for the kind of problem (`missing-tenant-predicate`, `journey-without-e2e`). Reuse the same id run after run.
- **`locator`** names *where* without line numbers: `path#symbol`, a route (`POST /api/bookings/:id/cancel`), a journey id, or a Sentry short id. Line numbers change on every edit and would defeat the fingerprint.
- **`fingerprint`** is omitted unless the finding has a natural id from its source, such as `sentry:<project>/<SHORT-ID>`.
- **`source`** is `external` whenever the finding derives from text a third party could write (Sentry events, user feedback, email). External findings carry a `source:*` label, and the triage label they get means a human must look before any agent acts on them.
- **`fix`** is `mechanical` only when the change is unambiguous and needs no product or design judgement (add a missing index, fix a dead path in a doc, add a journey tag to a test title).
- **`severity`**: `critical` means users are harmed or data is exposed now; `high` means it will happen under foreseeable conditions; `medium` is real but contained; `low` is hygiene.
- **One finding per problem.** Twenty routes missing the same guard are twenty findings with one `rule`; the per-run cap keeps the issue count sane and the tracking issue lists the rest.

## 3. Publish

The publisher is `${CLAUDE_SKILL_DIR}/scripts/publish-findings.mjs` (the `scripts/` folder beside this SKILL.md). It does the writing, so publishing is the same in every mode and idempotent across runs:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/publish-findings.mjs <findings.json> \
  --severity-min <from docs/agents/audits.md> \
  --new-issues-max <from docs/agents/audits.md> \
  --triage-label <the needs-triage label from docs/agents/triage-labels.md> \
  [--dry-run]
```

What it does:

- Fingerprints each finding and matches it against every existing `audit:<name>` issue (listed in full, never searched).
- **Open match**: leaves it, and relabels it if its severity changed. **Closed as completed**: reopens it with the `regression` label. **Closed as not planned**: suppresses it for good.
- Creates new issues, highest severity first, up to the cap. The rest are listed in the tracking issue.
- Creates one tracking issue per run, holding a task list and the audited SHA, and closes the previous run's tracking issue as superseded.
- Caps titles and bodies, fences evidence, and neutralises `@mentions`.

Read its JSON summary and report it to the user: the tracking issue, plus created, reopened and suppressed counts.

In GitHub Actions, skip this step: the workflow's publish job runs the script on your output (see MODES.md).

## 4. Mechanical fixes (interactive only)

For each `mechanical` finding the user wants fixed now, make the change on a branch `audit/<audit>/<fingerprint>`, run the relevant checks, open a PR that references the issue, and never merge it yourself.
