# jrey8343/skills

Product-engineering skills that Matt Pocock's skills don't cover: audits and code quality, event storming and Deciders, and product modeling. A project pins this repo at a commit next to [mattpocock/skills](https://github.com/mattpocock/skills) and picks the skills it needs. In a [Fabrik](https://github.com/jrey8343/fabrik) Product repo, the Kit config names them per role ([fabrik#71](https://github.com/jrey8343/fabrik/issues/71)).

## Using it

Pin a commit, not a branch. In a Fabrik Product repo, list the skills per role in the Kit config. Anywhere else, install it as a Claude Code plugin next to Matt's:

```sh
claude plugin marketplace add jrey8343/skills
claude plugin install jrey-skills@jrey8343
```

Audits are user-invoked (`/security-audit`, …); run `/schedule-audits` once to put them on a schedule in the repo's CI.

The product and persona reviews are user-invoked too, so a pre-spec review is a step a person takes. In a Fabrik Product repo, until per-role extra skills land ([fabrik#71](https://github.com/jrey8343/fabrik/issues/71)), the Operator runs `/product-review <issue>` (and `/persona-review #<spec>` when wanted) during its Design session, before ending the session with a spec or brief outcome.

## Scope

Each candidate skill goes to the first home that fits:

1. **Removed**, if it works against the strategy: a skill that acts on the backlog or the code outside the delivery loop.
2. **Matt's set**, if he covers it. Use his directly, unforked. A skill here calls his by name and never reuses one of his names, because both install into the same `.claude/skills/`.
3. **Fabrik**, only if it's about running the Loop (labels, PRs, worktrees, Dispatch).
4. **This repo**, if it's reusable practice Matt doesn't cover.
5. **The codebase's own docs** (`CODING_STANDARDS.md`, ADRs, `.fabrik/<role>.md`), if it's bespoke to one product, stack layout or company. It becomes a skill here only once a second project needs it.

**Audits** run in the repo's own CI, set up by `schedule-audits`, not by Fabrik. They file issues with an `audit:*` label and no state label, so the repo's Triage decides what's ready; headless runs never edit code or open PRs.

## Skills

**`quality/`**
- [`report-findings`](docs/quality/report-findings.md): The shared back half of every audit. It sets the headless and interactive modes, the `docs/agents/audits.md` settings and the incremental or targeted scope, then publishes findings as deduplicated GitHub issues for Triage through a guarded script. Each issue gets an `audit:*` label and never a state label or a PR, a fixed problem that returns is reopened as a regression, and each sweep gets one tracking issue.
- [`schedule-audits`](docs/quality/schedule-audits.md): Sets a repo up to run its audits on a schedule in its own GitHub Actions by seeding `docs/agents/audits.md` and rendering `.github/workflows/audits.yml` from it (one headless `claude -p` job per audit, refusing metered models and leaving out audits that read third-party text), and walks you through the 1Password and GitHub token setup with a script you run yourself.
- [`security-audit`](docs/quality/security-audit.md): Audits the whole attack surface (routes and the queries they reach, tenant isolation, secrets, input handling, headers and cookies, webhooks and CSRF, dependencies, telemetry and AI features, plus Cloudflare Workers checks when a wrangler config is present). It files ranked findings, always marked judgement fixes, through report-findings and never prints a secret value.
- [`test-audit`](docs/quality/test-audit.md): Finds core journeys without tagged e2e specs, functional cores and slices untested at their seam (when `CODING_STANDARDS.md` gives test placement), thinly tested hot spots, skipped tests and suites CI never runs, then files them as risk-ranked findings through report-findings, each naming the seam, test kind, behaviour to assert and an existing test to copy.
- [`perf-audit`](docs/quality/perf-audit.md): Audits routes, queries and bundles against the numeric budgets in `docs/agents/perf-budgets.md` (drafting that file with you on the first interactive run), backs every broken or near-broken budget with a napkin-math line, and publishes them as findings through report-findings, with Sentry, Cloudflare observability and Core Web Vitals read only in interactive runs.
- [`docs-audit`](docs/quality/docs-audit.md): You type it (or CI runs it headless). It checks agent docs and ADRs, plus feature docs, user docs and journeys where the repo has set them up, for missing pages, drift since `verified-at`, dead paths and globs, and broken ADR links. It publishes the findings through report-findings, and in interactive runs it offers to fix them with you watching.
- [`prune-docs`](docs/quality/prune-docs.md): Slims the root and nested `CLAUDE.md` / `AGENTS.md` into an index by classifying each section, moving still-true content into feature docs, ADRs, the glossary, `CODING_STANDARDS.md` or approved issues and deleting stale facts and history once you approve the plan; headless, it only reports over-budget, stale-fact, misplaced-content and duplicate-doc findings through `report-findings`.

**`architecture/`**
- [`deciders`](docs/architecture/deciders.md): Writes event-sourced domain logic as Deciders, meaning pure `decide` and `evolve` functions plus an initial state for each consistency boundary, tested as given events / when command / then events. Loading, appending, projections and the outbox stay in a thin shell that holds no domain rules.
- [`event-storming`](docs/architecture/event-storming.md): Facilitates an event-storming session in small rounds you accept or correct, from domain events on a timeline to bounded contexts and candidate Deciders, writing a storm doc in the repo after each round and settling glossary terms through `domain-modeling`.

**`product/`**
- [`product-modeling`](docs/product/product-modeling.md): Keeps the product's model of itself (PRODUCT.md, avatars and journeys) in the locations `docs/agents/product.md` records, writes each agreed decision to its file straight away, and keeps each journey's links to its `[journey:<id>]`-tagged e2e tests, feature docs, user docs and code up to date.
- [`discover-domain`](docs/product/discover-domain.md): Infers the product, its avatars and their journeys from the code. It grills you on the gaps, then writes `PRODUCT.md`, the avatars, one file per journey and a seed glossary as uncommitted files, and shows a coverage gap table that it leaves to `/test-audit` and `/docs-audit` to file.
- [`project-docs`](docs/product/project-docs.md): Defines the formats and the drift rules (code globs plus a `verified-at` SHA) for a project's feature docs, user docs and agent docs. It reads where each kind of doc lives from `docs/agents/docs-targets.md` and seeds that file when it is missing. When behaviour changes, it updates the matching docs in the same piece of work; headless callers get findings instead of edits.
- [`product-review`](docs/product/product-review.md): Gives a product designer and manager verdict (build, build-with-changes, rethink, don't-build) on a plan, spec, issue, PR, branch or shipped feature, weighing the avatar job it serves against its counted complexity cost per PRODUCT.md, and files rethink and don't-build verdicts as findings through report-findings (scheduled runs sweep what shipped since the last run).
- [`persona-review`](docs/product/persona-review.md): Walks a journey, feature or spec as each avatar it serves, through the code and copy (or, interactively, a live click-through of a non-production app), writes a friction log with a would-they-use-it verdict per avatar, and publishes `persona-*` findings through report-findings.

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
