# Maintaining jrey8343/skills

Product-engineering skills that sit beside [mattpocock/skills](https://github.com/mattpocock/skills) in the same `.claude/skills/`. [README.md](README.md) holds the scope, the skill list and the **Porting rules**; follow them when bringing a skill back from forge.

Skills stay **project-agnostic**: no product, domain or company specifics. A skill discovers project knowledge in the target repo (the repo it runs in) and writes it there.

## Layout

- `skills/<bucket>/<skill>/SKILL.md`. Buckets: `quality/` (audits and the audit base), `architecture/` (event storming, Deciders), `product/` (product model, project docs, product and persona reviews).
- Reference files sit beside `SKILL.md` as `UPPERCASE.md` (or lowercase seed templates), linked relatively: `[FINDINGS-SCHEMA.json](FINDINGS-SCHEMA.json)`. A link stays inside its skill folder; to use another skill, call it.
- Stack specifics (Cloudflare, Sentry, …) go in a named reference file such as `CLOUDFLARE.md`; the main flow stays stack-neutral.
- Every skill has `agents/openai.yaml` (Codex picker metadata).
- Every skill has a docs page at `docs/<bucket>/<skill>.md` and a README entry: ``[`<skill>`](docs/<bucket>/<skill>.md): what it does``.
- `.claude-plugin/plugin.json` lists every skill folder; regenerate it with `npm run manifest`. Fabrik installs exactly these folders, flattened to their last segment, so folder names are unique across buckets.
- A skill folder name never matches one of Matt's (`scripts/matt-skills.json`, his manifest at the SHA Fabrik pins). Call his skills by name instead. Refresh the snapshot with `npm run matt:refresh` when Fabrik's lock moves.

## Invocation

- **User-invoked**: `disable-model-invocation: true` in frontmatter and `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. The description is a human-facing one-liner.
- **Model-invoked**: neither of those. The description is model-facing, with trigger branches ("Use when …").
- A skill reaches another only by an explicit instruction: "Call the Skill tool with `<name>`" (two skills is two calls). Only model-invoked skills are reachable this way; for a user-invoked one, write "tell the user to run `/<name>`".
- Quote any frontmatter value containing `: `.

## Audit skills

Audits (every `quality/` skill except `report-findings` and `schedule-audits`, plus `product-review` and `persona-review`) are user-invoked, so they never fire by surprise. CI runs them with `claude -p "/<audit> headless"` from the workflow `schedule-audits` renders. Each follows one skeleton, with the shared mechanics in `report-findings` (model-invoked, so audits can reach it):

1. Call the Skill tool with `report-findings` to resolve the mode (headless or interactive) and scope.
2. Read `docs/agents/audits.md`. It is a hard dependency: when missing, interactive runs tell the user to run `/schedule-audits`, and headless runs emit one `audit-not-configured` finding and stop.
3. Gather evidence, with no more parallel sub-agents than `subagents_max`.
4. Build findings matching `skills/quality/report-findings/FINDINGS-SCHEMA.json`.
5. Call the Skill tool with `report-findings` to publish.

Frontmatter: `argument-hint: "[headless] [dry-run] [full] [area]"` and an `allowed-tools` line granting read-only tools only. Lint enforces both, plus `disable-model-invocation: true`, for the audits named above.

Findings (every audit and `report-findings` agree on these):

- Each finding is filed as an issue carrying the fingerprint label `audit:<audit-name>` and **no** state label (never `ready-for-agent`); Matt's `triage` decides what happens next.
- A mechanical finding (one fix, no judgement) also gets `fix: mechanical`.
- No code path opens a PR or applies a state label.
- Headless runs never edit, commit or push. Interactive runs may edit with the user watching.
- An issue closed as not planned suppresses that finding for good.
- A missing input degrades the run: skip the checks that need it and say which were skipped. It never fails the run.

## Target-repo config

Skills read these files in the target repo. The owning skill seeds each from a template beside its `SKILL.md` when missing.

- `docs/agents/audits.md`: audit defaults (`model`, `max_turns`, `timeout_minutes`, `severity_min`, `new_issues_max`, `subagents_max`, `scope_ignore`) and per-audit cron and overrides. Owned by `schedule-audits`.
- `docs/agents/product.md`: where `PRODUCT.md`, avatars and journeys live (defaults `PRODUCT.md`, `docs/product/avatars.md`, `docs/product/journeys/<id>.md`). Owned by `product-modeling`.
- `docs/agents/docs-targets.md`: where feature docs, ADRs, runbooks and user docs live (feature docs default to `docs/features/<feature>.md`). Owned by `project-docs`.
- `docs/agents/perf-budgets.md`: performance budgets, drafted by `perf-audit` on its first run.
- `docs/agents/domain.md`: glossary and ADR layout, created by Matt's `setup-matt-pocock-skills`. Write glossary and ADR changes in place through Matt's `domain-modeling`.
- `CODING_STANDARDS.md` at the target repo root: the repo's own layout and test placement. Optional; when absent, a skill skips what depends on it and says so.

## Docs pages

`docs/<bucket>/<skill>.md`, for a human deciding whether and when to use the skill. Sections in this order (omit the optional ones when empty):

1. `# <skill-name>`
2. `## What it does`: the job in one sentence, then the defining constraint (what makes it behave differently from the obvious default).
3. `## When to reach for it`: whether you type it or the agent reaches for it, then the trigger boundary, naming the confusable sibling (here or in Matt's set).
4. `## Prerequisites` (optional): setup it needs, files it writes in the target repo.
5. One to three free-form sections in the skill's own vocabulary.
6. `## Common questions` (optional): only questions someone would really ask.
7. `## It's working if`: signals the reader can check without opening `SKILL.md`.
8. `## Where it fits`: its role (chain step, run-once setup, periodic audit, standalone) and its neighbours, linked.

Links are relative (`../quality/report-findings.md`). Install commands live in `README.md` only. Describe the skill; leave its steps to `SKILL.md`.

## Scripts

Zero-dependency Node (22+) or POSIX bash, with named limits, assertions and functions of 70 lines or fewer. Tests sit beside the script as `*.test.mjs` and run under `node --test`.

- `scripts/lint-skills.mjs`: the repo invariants above; `npm run manifest` regenerates `plugin.json`.
- `scripts/matt-skills.mjs`: refreshes and checks the snapshot of Matt's names. CI fails when Fabrik's lock moves to a SHA whose names clash with a skill here.
- `scripts/link-skills.sh`: symlinks every skill into `~/.claude/skills` and `~/.agents/skills` for local dev (`--unlink` removes them).

## Before committing

- `npm run check` (lint, then the tests in `scripts/` and `skills/`).
- `claude plugin validate .` after touching `.claude-plugin/`. One warning about `CLAUDE.md` not shipping as plugin context is expected; run it without `--strict`.
- Record every port or new skill in [CREDITS.md](CREDITS.md), saying what changed from the source. A port is a row in **Ported from forge**: `` | `<bucket>/<skill>` | `skills/<old-bucket>/<skill>` | what changed | ``. A new skill is a row in **New**: `` | `<bucket>/<skill>` | what it is and what it draws on | ``.
