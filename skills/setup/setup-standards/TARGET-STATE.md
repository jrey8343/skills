# Target State

What a production-grade repo looks like once it meets these standards. The gap pass checks each row, and each gap becomes a finding (`audit: setup-standards`, `rule:` the row id) that names the skill to run. Checks are cheap and observable; when one needs judgement, record the gap with `confidence: low` rather than guessing.

| Id | Target | How to check | Fixed by |
|---|---|---|---|
| `agent-config` | `docs/agents/*.md` exist and `CLAUDE.md`/`AGENTS.md` has an `## Agent skills` block | Files exist | `/setup-standards` |
| `agent-docs-lean` | Root agent doc is 300 lines or fewer, links nothing outside the repo, and states no stale facts | `wc -l`; grep for `~/`, absolute paths, "not yet" | `/prune-docs` |
| `coding-standards` | `CODING_STANDARDS.md` exists and matches the house style | File exists | `/setup-standards` (writes it) |
| `glossary` | `GLOSSARY.md` (or `GLOSSARY-MAP.md`) exists | File exists | `/discover-domain` or `/grill-with-docs` |
| `product-model` | `PRODUCT.md`, avatars, and at least one journey per avatar | Files exist; count journeys | `/discover-domain` |
| `core-journeys-e2e` | Every `core: true` journey has an e2e spec tagged `[journey:<id>]` | Journey frontmatter plus grep of e2e specs | `/test-audit` |
| `ci-runs-tests` | CI runs unit, integration and e2e on every PR | Read `.github/workflows/` | `/test-audit` |
| `feature-docs` | Every journey's features have a `docs/features/` page with `code:` globs | Journey frontmatter; files exist | `/docs-audit` |
| `user-docs` | Every user-visible core journey has a user doc in the docs target | Journey `user-docs`; target exists | `/docs-audit` |
| `adrs` | `docs/adr/` exists if the repo has made hard-to-reverse choices (deploy target, datastore, auth vendor) | Directory exists | `/grill-with-docs` |
| `assert-helper` | An `assert` helper exists and core modules use it | grep | `/improve-codebase-architecture` |
| `error-tracking` | Every runtime reports errors to Sentry with releases and source maps, plus the feedback widget | Dependencies and init code per runtime | `/adopt-sentry` |
| `secrets-managed` | No plaintext secrets outside gitignored, generated files; `op://` templates committed; CI loads secrets from 1Password | `git ls-files` for secret-looking files; templates exist; workflow uses load-secrets-action | `/adopt-1password` |
| `security-baseline` | Security headers and CSP on every HTML response; dependency audit in CI; tenant-isolation tests if multi-tenant | Headers config; workflow; tests | `/security-audit` |
| `perf-budgets` | `docs/agents/perf-budgets.md` exists, and budget tests pin round trips on hot endpoints | File exists; grep tests | `/perf-audit` |
| `tracker-labels` | The labels in `labels.md` exist | `gh label list` | `/setup-standards` |
| `scheduled-audits` | `.github/workflows/claude-audits.yml` exists and has run successfully | File exists; `gh run list --workflow claude-audits.yml` | `/schedule-audits` |

## Building the finding for a gap

- `rule`: the row id, e.g. `error-tracking`.
- `locator`: `standards#<row id>`.
- `title`: `Standards gap: <target, shortened>`.
- `severity`: `high` for `secrets-managed`, `error-tracking`, `security-baseline` and `core-journeys-e2e`; `medium` otherwise.
- `recommendation`: "Run `/<skill>`." plus one sentence on what you saw.
- `fix`: `judgement`. `source`: `internal`.
- If a policy or ADR conflicts with a target (for example, a written rule against third-party error vendors), say so in the evidence. The skill that fixes it must resolve the conflict with the user first.
