# jrey8343/skills

Bespoke product-engineering skills that Matt Pocock's skills don't cover: product modeling, event storming, Deciders, architecture house style and audits. A project pins this repo at a commit next to [mattpocock/skills](https://github.com/mattpocock/skills) and picks the skills it needs. In a [Fabrik](https://github.com/jrey8343/fabrik) Product repo, the Kit config names them per role ([fabrik#71](https://github.com/jrey8343/fabrik/issues/71)).

> **Being rebuilt.** The repo was archived while these skills lived in forge. It's now emptied and being refilled skill by skill. Nothing is installable yet. Don't install an older commit.

## Scope

**In:** skills with no counterpart in Matt's set, which stay architecture- and project-agnostic, apart from the architecture stances they name outright.

**Out:**
- **Forks of Matt's skills.** Use his directly. When something here needs one of his, it calls it by name. A skill here never reuses one of his names, because both install into the same `.claude/skills/`.
- **Operating a delivery loop** (labels, PRs, worktrees, dispatch). Fabrik owns that.
- **Anything specific to one product or company.**

## The plan

Each skill has an issue. `port` brings it back from forge, `add` writes a new one, `drop` records what stays out and why.

**First:** [Repo tooling: layout, a manifest Fabrik can pin, lint and CI](https://github.com/jrey8343/skills/issues/8)

**Architecture**
- [Port house-style as the architecture skill](https://github.com/jrey8343/skills/issues/9)
- [Add a Deciders reference for event-sourced code](https://github.com/jrey8343/skills/issues/10)
- [Add event-storming](https://github.com/jrey8343/skills/issues/11)

**Product**
- [Port product-modeling](https://github.com/jrey8343/skills/issues/12)
- [Port discover-domain](https://github.com/jrey8343/skills/issues/13)
- [Port project-docs](https://github.com/jrey8343/skills/issues/14)
- [Port roadmap](https://github.com/jrey8343/skills/issues/15)
- [Port synthesize-backlog](https://github.com/jrey8343/skills/issues/16)

**Audits**
- [Port report-findings, the shared audit base](https://github.com/jrey8343/skills/issues/17)
- [Port security-audit](https://github.com/jrey8343/skills/issues/18)
- [Port test-audit](https://github.com/jrey8343/skills/issues/19)
- [Port perf-audit](https://github.com/jrey8343/skills/issues/20)
- [Port docs-audit](https://github.com/jrey8343/skills/issues/21)
- [Port prune-docs](https://github.com/jrey8343/skills/issues/22)
- [Port product-review](https://github.com/jrey8343/skills/issues/23)
- [Port persona-review](https://github.com/jrey8343/skills/issues/24)

**To decide:** [Port or drop: adopt-1password and adopt-sentry](https://github.com/jrey8343/skills/issues/25)

**Dropped:** [Drop: skills Matt's set or Fabrik already covers, and forge-only ones](https://github.com/jrey8343/skills/issues/26)

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
