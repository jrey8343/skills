# Maintaining jrey8343/skills

Agent skills for production engineering, forked from [mattpocock/skills](https://github.com/mattpocock/skills) and extended. Skills must stay **project-agnostic**: no product, domain or company specifics in any skill. Project knowledge is discovered per repo and written into that repo.

## Layout

- `skills/<bucket>/<skill>/SKILL.md`. Buckets: `setup/` (adopt a standard into a repo), `audits/` (inspect and file findings), `engineering/` (daily code work and shared references), `productivity/` (non-code workflow).
- Reference files sit beside `SKILL.md` as `UPPERCASE.md` (or lowercase seed templates) and are linked relatively: `[FCIS.md](FCIS.md)`. Never link across skill folders.
- Every skill has `agents/openai.yaml` (Codex picker metadata).
- Every skill has a docs page at `docs/<bucket>/<skill>.md` and a linked entry in `README.md`.
- `.claude-plugin/plugin.json` lists every skill; regenerate with `npm run manifest`.

## Invocation

- **User-invoked**: `disable-model-invocation: true` in frontmatter and `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. The description is a human-facing one-liner.
- **Model-invoked**: neither of those. The description is model-facing, with trigger branches ("Use when …").
- A skill reaches another skill only by an explicit instruction: `Call the Skill tool with "<name>"` (two skills is two calls). Only model-invoked skills can be reached this way. For a user-invoked precondition, write "tell the user to run `/<name>`".
- Quote any frontmatter value containing `: `.
- Audits are user-invoked so they never fire by surprise. CI runs them with the prompt `/jrey-skills:<audit> headless`.

## Audit skills

Every audit follows the same skeleton, with the shared mechanics in `report-findings`:

1. Call the Skill tool with "report-findings" to resolve the mode (headless or interactive) and scope.
2. Read `docs/agents/audits.md` (hard dependency; if missing, interactive runs tell the user to run `/setup-standards`, and headless runs emit one `audit-not-configured` finding and stop).
3. Gather evidence, with no more parallel sub-agents than `subagents_max`.
4. Build findings matching `skills/audits/report-findings/FINDINGS-SCHEMA.json`.
5. Call the Skill tool with "report-findings" to publish.

Frontmatter: `argument-hint: "[headless] [dry-run] [full] [area]"`, and an `allowed-tools` line granting read-only tools only.

## Docs pages

`docs/<bucket>/<skill>.md`, for a human deciding whether and when to use the skill. Sections in this order (omit the optional ones when empty):

1. `# <skill-name>`
2. `## What it does`: the job in one sentence, then the defining constraint (what makes it behave differently from the obvious default).
3. `## When to reach for it`: say whether you type it or the agent reaches for it, then the trigger boundary, naming the confusable sibling.
4. `## Prerequisites` (optional): setup it needs, files it writes.
5. One to three free-form sections in the skill's own vocabulary.
6. `## Common questions` (optional): only questions someone would really ask.
7. `## It's working if`: signals the reader can check without opening `SKILL.md`.
8. `## Where it fits`: its role (chain step, run-once setup, periodic audit, standalone), its neighbours, and a pointer to [which-skill](../productivity/which-skill.md).

Links are relative (`../engineering/tdd.md`). No install commands on docs pages; those live in `README.md`. Don't reproduce the SKILL.md steps.

## Rules

- When adding, renaming or removing a user-reachable skill, update `which-skill` and `docs/WORKFLOWS.md` in the same change.
- Forked skills: keep upstream text where unchanged so `scripts/sync-upstream.sh diff` stays readable. Record each modification in `CREDITS.md`.
- Scripts are zero-dependency Node (22+) or POSIX bash, written in the house style (named limits, assertions, functions of 70 lines or fewer), with tests beside them (`node --test`).
- Before committing: `node scripts/lint-skills.mjs`, `node --test "skills/**/*.test.mjs"`, and `claude plugin validate .` after touching the manifests. One warning is expected and harmless: this `CLAUDE.md` holds maintainer rules for the repo and is not shipped as plugin context. So don't use `--strict`.
- Dev install: `scripts/link-skills.sh` symlinks every skill into `~/.claude/skills` and `~/.agents/skills`.
