# jrey8343/skills

Product-engineering skills that Matt Pocock's skills don't cover: audits and code quality, event storming and Deciders, and product modeling. A project pins this repo at a commit next to [mattpocock/skills](https://github.com/mattpocock/skills) and picks the skills it needs. In a [Fabrik](https://github.com/jrey8343/fabrik) Product repo, the Kit config names them per role ([fabrik#71](https://github.com/jrey8343/fabrik/issues/71)).

> **Being rebuilt.** The repo was archived while these skills lived in forge. It's now emptied and being refilled skill by skill. Nothing is installable yet. Don't install an older commit.

## Scope

Each candidate skill goes to the first home that fits:

1. **Removed**, if it works against the strategy: a skill that acts on the backlog or the code outside the delivery loop.
2. **Matt's set**, if he covers it. Use his directly, unforked. A skill here calls his by name and never reuses one of his names, because both install into the same `.claude/skills/`.
3. **Fabrik**, only if it's about running the Loop (labels, PRs, worktrees, Dispatch).
4. **This repo**, if it's reusable practice Matt doesn't cover.
5. **The codebase's own docs** (`CODING_STANDARDS.md`, ADRs, `.fabrik/<role>.md`), if it's bespoke to one product, stack layout or company. It becomes a skill here only once a second project needs it.

**Audits** run in the repo's own CI, set up by `schedule-audits`, not by Fabrik. They file issues with an `audit:*` label and no state label, so the repo's Triage decides what's ready; headless runs never edit code or open PRs.

## The plan

Each skill has an issue. `port` brings it back from forge, `add` writes a new one, `drop` records what stays out and why.

**First:** [Repo tooling: layout, a manifest Fabrik can pin, lint and CI](https://github.com/jrey8343/skills/issues/8)

**`quality/`**
- [Port report-findings, the shared audit base](https://github.com/jrey8343/skills/issues/17)
- [Add schedule-audits: run audits on a schedule in the repo's CI](https://github.com/jrey8343/skills/issues/28)
- [Port security-audit](https://github.com/jrey8343/skills/issues/18)
- [Port test-audit](https://github.com/jrey8343/skills/issues/19)
- [Port perf-audit](https://github.com/jrey8343/skills/issues/20)
- [Port docs-audit](https://github.com/jrey8343/skills/issues/21)
- [Port prune-docs](https://github.com/jrey8343/skills/issues/22)

**`architecture/`**
- [Add the deciders skill for event-sourced code](https://github.com/jrey8343/skills/issues/10)
- [Add event-storming](https://github.com/jrey8343/skills/issues/11)

**`product/`**
- [Port product-modeling](https://github.com/jrey8343/skills/issues/12)
- [Port discover-domain](https://github.com/jrey8343/skills/issues/13)
- [Port project-docs](https://github.com/jrey8343/skills/issues/14)
- [Port product-review](https://github.com/jrey8343/skills/issues/23)
- [Port persona-review](https://github.com/jrey8343/skills/issues/24)

**Dropped:** [skills Matt's set or Fabrik covers, bespoke ones, and ones against the strategy](https://github.com/jrey8343/skills/issues/26): house-style (per repo), roadmap, synthesize-backlog, adopt-sentry, adopt-1password, and forge-only ones.

## Porting rules

Port from forge's `skills/` at `c2a1cae`, not from this repo's history, which is older.

1. **No forge Loop:** no `.forge/config.json` checks, `/forge land` or `/forge run`, batch PRs, landing queue, or the `landed` and `needs-decision` labels.
2. **No carriers:** drop forge's "pending model change handed to a carrier" mechanism. Write glossary and ADR changes in place, as Matt's `domain-modeling` does.
3. **Claude Code invocation:** use "Call the Skill tool with `<name>`", not pi's `/skill:<name>` or "Read the `x` skill".
4. **Reach Matt's skills by name** (`domain-modeling`, `tdd`, `to-spec`, …) instead of copying their content.
5. **Stack-neutral main flow:** Cloudflare (or any other stack) specifics go in a clearly named reference file beside `SKILL.md`.
6. **Record the port** in [CREDITS.md](CREDITS.md).

## License

MIT. See [LICENSE](LICENSE) and [CREDITS.md](CREDITS.md).
