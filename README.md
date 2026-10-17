# jrey8343/skills

[![skills.sh](https://skills.sh/b/jrey8343/skills)](https://skills.sh/jrey8343/skills)

Agent skills for building production software the way I like it built:

- **Architecture**: a functional core behind an imperative shell, vertical slices, and TigerStyle discipline (assertions, explicit limits, short functions, napkin math).
- **Product**: a product model (avatars and journeys) that features, tests and docs are judged against.
- **Audits**: architecture, performance, security, tests, docs, product, persona and Sentry checks that run on a schedule and file deduped GitHub issues.
- **Delivery**: the grill → spec → tickets → implement flow from [mattpocock/skills](https://github.com/mattpocock/skills), which this collection forks.

The skills are project-agnostic. Each repo's knowledge (its domain, avatars, stack, docs locations and audit settings) is discovered and written into that repo by [`/setup-standards`](skills/setup/setup-standards/SKILL.md) and [`/discover-domain`](skills/setup/discover-domain/SKILL.md).

The default stack is TypeScript on Cloudflare, with 1Password for secrets, Sentry for errors and feedback, GitHub for issues and PRs, Markdown for docs, and a marketing site that hosts user docs. Most skills work without some of these and say so when one is missing.

## Install

Pick one.

```bash
# skills.sh: editable copies (global for Claude Code)
npx skills@latest add jrey8343/skills -g -a claude-code

# Claude Code plugin: managed, namespaced as /jrey-skills:<skill>
claude plugin marketplace add jrey8343/skills
claude plugin install jrey-skills@jrey8343

# Working on the skills themselves: symlink this checkout
git clone git@github.com:jrey8343/skills.git && cd skills && scripts/link-skills.sh
```

## Start in a repo

```text
/setup-standards     configure the repo, file a roadmap of gaps
/discover-domain     product model: PRODUCT.md, avatars, journeys, glossary
/prune-docs          slim CLAUDE.md into an index; move knowledge to proper homes
/adopt-1password     secrets into 1Password
/adopt-sentry        errors, performance and feedback into Sentry
/schedule-audits     run the audits on a schedule in GitHub Actions
```

Not sure which skill you need? Type `/which-skill`. The flows are drawn out in [docs/WORKFLOWS.md](docs/WORKFLOWS.md).

## Skills

**User-invoked** skills run only when you type them. **Model-invoked** skills can also be pulled in by the agent or by other skills.

### Setup: bring a repo up to the standard

User-invoked:

- [setup-standards](skills/setup/setup-standards/SKILL.md): configure the tracker, labels, doc layout, stack, docs targets, audit settings and coding standards, then file the gaps. ([docs](docs/setup/setup-standards.md))
- [discover-domain](skills/setup/discover-domain/SKILL.md): infer the product, avatars and journeys from the code, grill you, write the product model. ([docs](docs/setup/discover-domain.md))
- [adopt-1password](skills/setup/adopt-1password/SKILL.md): move secrets into 1Password so dev, deploy and CI read `op://` references. ([docs](docs/setup/adopt-1password.md))
- [adopt-sentry](skills/setup/adopt-sentry/SKILL.md): instrument errors, performance and feedback, plus a support-email Worker, after a policy check. ([docs](docs/setup/adopt-sentry.md))
- [schedule-audits](skills/setup/schedule-audits/SKILL.md): install the GitHub Actions workflow that runs the audits on a schedule. ([docs](docs/setup/schedule-audits.md))

### Audits: keep the codebase on track

User-invoked:

- [improve-codebase-architecture](skills/audits/improve-codebase-architecture/SKILL.md): deepening opportunities, impure cores and horizontal smears, as a visual report or as issues. ([docs](docs/audits/improve-codebase-architecture.md))
- [perf-audit](skills/audits/perf-audit/SKILL.md): what breaks the performance budgets, with napkin math. ([docs](docs/audits/perf-audit.md))
- [security-audit](skills/audits/security-audit/SKILL.md): tenant isolation, authorisation, secrets, input handling, headers, dependencies and AI features. ([docs](docs/audits/security-audit.md))
- [test-audit](skills/audits/test-audit/SKILL.md): core journeys and risky modules missing the tests they need. ([docs](docs/audits/test-audit.md))
- [docs-audit](skills/audits/docs-audit/SKILL.md): missing and drifted feature and user docs. ([docs](docs/audits/docs-audit.md))
- [prune-docs](skills/audits/prune-docs/SKILL.md): slim agent docs, rehome their knowledge, delete sediment. ([docs](docs/audits/prune-docs.md))
- [sentry-triage](skills/audits/sentry-triage/SKILL.md): new and regressed Sentry errors, slow transactions and feedback, as triage-ready issues. ([docs](docs/audits/sentry-triage.md))

Model-invoked:

- [product-review](skills/audits/product-review/SKILL.md): does this feature improve the product or detract from it? ([docs](docs/audits/product-review.md))
- [persona-review](skills/audits/persona-review/SKILL.md): walk a feature as each avatar, statically and live, and grill what's confusing or useless. ([docs](docs/audits/persona-review.md))
- [report-findings](skills/audits/report-findings/SKILL.md): audit modes, findings format, and the deduping issue publisher. ([docs](docs/audits/report-findings.md))

### Engineering: daily code work

User-invoked:

- [grill-with-docs](skills/engineering/grill-with-docs/SKILL.md): a relentless interview that also updates the glossary and ADRs. ([docs](docs/engineering/grill-with-docs.md))
- [to-spec](skills/engineering/to-spec/SKILL.md): turn the conversation into a spec, gated by product and persona review. ([docs](docs/engineering/to-spec.md))
- [to-tickets](skills/engineering/to-tickets/SKILL.md): split a spec into tracer-bullet tickets with blocking edges. ([docs](docs/engineering/to-tickets.md))
- [implement](skills/engineering/implement/SKILL.md): implement a spec or ticket, through to tests and docs. ([docs](docs/engineering/implement.md))
- [implement-spec](skills/engineering/implement-spec/SKILL.md): implement a whole ticket graph in parallel on an integration branch. ([docs](docs/engineering/implement-spec.md))
- [wayfinder](skills/engineering/wayfinder/SKILL.md): chart a huge, foggy effort as decision tickets. ([docs](docs/engineering/wayfinder.md))
- [triage](skills/engineering/triage/SKILL.md): move raw issues through triage roles to agent-ready briefs. ([docs](docs/engineering/triage.md))

Model-invoked:

- [house-style](skills/engineering/house-style/SKILL.md): functional core and imperative shell, vertical slices, TigerStyle. ([docs](docs/engineering/house-style.md))
- [codebase-design](skills/engineering/codebase-design/SKILL.md): the deep-module vocabulary. ([docs](docs/engineering/codebase-design.md))
- [domain-modeling](skills/engineering/domain-modeling/SKILL.md): the glossary and ADRs. ([docs](docs/engineering/domain-modeling.md))
- [product-modeling](skills/engineering/product-modeling/SKILL.md): `PRODUCT.md`, avatars and journeys. ([docs](docs/engineering/product-modeling.md))
- [project-docs](skills/engineering/project-docs/SKILL.md): feature, user and agent doc formats, and drift. ([docs](docs/engineering/project-docs.md))
- [tdd](skills/engineering/tdd/SKILL.md): red-green at agreed seams, with house-style test placement. ([docs](docs/engineering/tdd.md))
- [review-changes](skills/engineering/review-changes/SKILL.md): two-axis review of a diff (Standards and Spec). ([docs](docs/engineering/review-changes.md))
- [diagnosing-bugs](skills/engineering/diagnosing-bugs/SKILL.md): a tight feedback loop before any theory. ([docs](docs/engineering/diagnosing-bugs.md))
- [pr](skills/engineering/pr/SKILL.md): PR bodies with the smallest visual that shows the change. ([docs](docs/engineering/pr.md))
- [prototype](skills/engineering/prototype/SKILL.md): throwaway code that answers one design question. ([docs](docs/engineering/prototype.md))
- [research](skills/engineering/research/SKILL.md): a background agent reads primary sources and leaves a cited file. ([docs](docs/engineering/research.md))
- [wizard](skills/engineering/wizard/SKILL.md): an interactive script for steps only a human can do. ([docs](docs/engineering/wizard.md))

### Productivity

User-invoked:

- [which-skill](skills/productivity/which-skill/SKILL.md): a router over every skill and flow. ([docs](docs/productivity/which-skill.md))
- [grill-me](skills/productivity/grill-me/SKILL.md): a relentless interview with no repo needed. ([docs](docs/productivity/grill-me.md))
- [handoff](skills/productivity/handoff/SKILL.md): compact the conversation for another session. ([docs](docs/productivity/handoff.md))

Model-invoked:

- [grilling](skills/productivity/grilling/SKILL.md): the interview primitive. ([docs](docs/productivity/grilling.md))
- [writing-for-agents](skills/productivity/writing-for-agents/SKILL.md): how to write skills and `CLAUDE.md`. ([docs](docs/productivity/writing-for-agents.md))

## What a configured repo contains

| File | Written by | Read by |
|---|---|---|
| `docs/agents/*.md` | setup-standards | Every skill |
| `CODING_STANDARDS.md` | setup-standards, from house-style | review-changes, implement, the audits |
| `PRODUCT.md`, `docs/product/avatars.md`, `docs/product/journeys/*.md` | discover-domain, product-modeling | product-review, persona-review, test-audit, docs-audit, to-spec |
| `GLOSSARY.md`, `docs/adr/*.md` | domain-modeling | Everything that names things |
| `docs/features/*.md` | project-docs, implement, prune-docs | Engineers and agents changing the code |
| `.github/workflows/claude-audits.yml` | schedule-audits | GitHub Actions |

## Scheduled audits

`/schedule-audits` installs a workflow that, on each cron:

1. **Plans**: works out which audits are due, and skips any with no new commits since its last run.
2. **Analyses**: runs `/jrey-skills:<audit> headless` with read-only tools and emits findings as JSON.
3. **Publishes**: a deterministic script files deduped issues, with one tracking issue per run.

Claude authenticates with a subscription token kept in 1Password; the only GitHub secret is the 1Password service account token. See [docs/WORKFLOWS.md](docs/WORKFLOWS.md#3-the-audit-loop).

## Credits and license

MIT. Forked from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT, Copyright (c) 2026 Matt Pocock); see [CREDITS.md](CREDITS.md) for what changed. TigerStyle is TigerBeetle's [TIGER_STYLE.md](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md), adapted to TypeScript.
