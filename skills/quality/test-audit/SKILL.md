---
name: test-audit
description: Find journeys and risky modules that lack the tests they need, then file prioritised gaps.
disable-model-invocation: true
argument-hint: "[headless] [dry-run] [full] [area]"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git ls-files:*), Bash(git grep:*), Bash(grep:*), Bash(sort:*), Bash(uniq:*), Bash(head:*), Bash(wc:*)
---

# Test Audit

Find where the test suite leaves users or risky code unprotected. Not coverage percentage: **coverage of what matters**. Every core journey proven end to end, every functional core tested through its interface, every slice tested at its seam, and the code that changes most tested best.

## 1. Mode and configuration

Call the Skill tool with `report-findings` to resolve the mode and scope. Read `docs/agents/audits.md` for thresholds and caps. If it is missing: interactively, tell the user to run `/schedule-audits` and stop; headless, emit one `audit-not-configured` finding as report-findings describes, and stop.

Then gather the inputs. Each one is optional; a missing one skips the checks that need it (step 3 says which), and the report `summary` names every skipped check.

- **Placement**: `CODING_STANDARDS.md` at the repo root. Read it as [PLACEMENT.md](PLACEMENT.md) describes, for the seams the repo tests at, which kind of test each gets, where those tests live, and how the repo marks functional cores and slices.
- **Product model**: `docs/agents/product.md` for where journeys live and the journey tag form (defaults `docs/product/journeys/<id>.md` and `[journey:<id>]`). When journey files exist, call the Skill tool with `product-modeling` for the journey format.
- **Test tooling**: the test runners, their configs and commands, found from the repo itself: the package manifest's test scripts, runner configs (`vitest.config.*`, `playwright.config.*`, `jest.config.*`, `pytest.ini`, …) and the CI workflows (`.github/workflows/*.yml`).
- **Test vocabulary**: call the Skill tool with `tdd` for the vocabulary of good and bad tests (seams, implementation-coupled tests, mocking internals, verifying through a side channel) and use its terms in findings; don't run its loop.
- **Stack**: if the repo runs on a stack with its own reference file here, read it too: [CLOUDFLARE.md](CLOUDFLARE.md) for Cloudflare Workers.

## 2. Build the coverage map

Follow [COVERAGE-MAP.md](COVERAGE-MAP.md) to build, deterministically, from files and git:

- **journey → e2e specs**: from journey frontmatter, confirmed by journey tags in spec titles;
- **core module → unit tests**: the repo's functional-core modules and the test files that import them;
- **slice → integration tests**: slice interfaces and the tests that exercise them;
- **hot spots**: the most-changed files in the scope, with the size of their tests.

With incremental scope, build the full journey map (it is cheap) but limit the module, placement and hot-spot passes to paths changed since the last run. Use no more than `subagents_max` sub-agents, split by area. An `area` (a path or journey id) limits every pass to it and makes an interactive run **targeted** (publish with `scope: targeted` and `target: <area>`, as report-findings says); a headless run is always a sweep and ignores it.

## 3. Find the gaps

| Rule | Gap | Severity | Needs |
|---|---|---|---|
| `journey-without-e2e` | A `core: true` journey with no `e2e` spec | high | product model |
| `journey-e2e-untagged` | A listed spec that covers its journey but lacks the journey tag (fix: mechanical) | low | product model |
| `journey-e2e-unlisted` | A spec carrying a journey tag that the journey doesn't list under `e2e` (fix: mechanical) | low | product model |
| `journey-tag-unknown` | A spec carrying a tag for a journey id that doesn't exist | low | product model |
| `journey-e2e-shallow` | A tagged spec that skips journey steps, or never asserts the **Done when** state | medium | product model |
| `core-untested` | A functional-core module with no tests through its interface | medium | placement |
| `slice-untested` | A slice interface with no integration test | medium | placement |
| `test-misplaced` | A test of the wrong kind for its seam, or outside the location the placement table gives | low | placement |
| `hot-spot-thin-tests` | A top-10 churn file whose tests are thin or absent | medium | git |
| `test-skipped` | `.skip`, `.only`, `test.fixme`, `xit`, or a disabled suite | low (medium if it skips a journey) | tests |
| `ci-missing-suite` | A suite that exists but CI doesn't run | high | CI workflows |
| `test-past-interface` | Tests that mock internal collaborators or assert on internals (the anti-patterns `tdd` names) | low | tests |

Run every rule whose input exists. When one is missing:

- **No `CODING_STANDARDS.md`, or no placement in it**: skip `core-untested`, `slice-untested` and `test-misplaced`. Recommendations then name the seam without a house location. Say in the `summary` that placement checks were skipped because the repo states no test placement; interactively, offer the shape in [PLACEMENT.md](PLACEMENT.md) for the user to add to `CODING_STANDARDS.md`.
- **No journey files**: skip every `journey-*` rule and the journey branch of `test-skipped`. Say so in the `summary`; interactively, tell the user to run `/discover-domain` to build the first product model.
- **No CI workflows the run can read**: skip `ci-missing-suite` and say so.

Score risk with the rubric in [COVERAGE-MAP.md](COVERAGE-MAP.md). Severity in the table is the default, and only the rubric moves it.

## 4. Recommend at the right seam

Every finding's `recommendation` names:

- **the seam**: the journey, slice interface or core function;
- **the test kind**: e2e for journeys, integration for slice interfaces, unit for functional cores, at the location the repo's placement gives;
- **the behaviour to assert**, in the glossary's terms (`docs/agents/domain.md` says where it lives), as a test name ("cancelling within the notice window refunds nothing"); for a journey, in the avatar's words;
- **prior art**: an existing test in the repo to model it on.

A good test verifies behaviour through a public interface and survives a refactor. Never recommend testing a shell through mocks of its own internals. If the code can only be tested that way, recommend extracting the core instead, and say so.

## 5. Mechanical fixes

Two gaps are mechanical (`fix: mechanical`):

- adding the journey tag to the title of a listed spec that clearly walks the journey (`journey-e2e-untagged`);
- adding a spec that carries the tag to the journey's `e2e` frontmatter (`journey-e2e-unlisted`).

Everything else is `fix: judgement`.

## 6. Publish

Call the Skill tool with `report-findings` to publish. Headless runs stop there: they file issues and never edit, commit or push. Interactively, after publishing, offer to write the top missing test now: call the Skill tool with `tdd`, at the seam the finding names.
