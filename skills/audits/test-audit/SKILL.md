---
name: test-audit
description: Find journeys and risky modules that lack the tests they need, then file prioritised gaps.
disable-model-invocation: true
argument-hint: "[headless] [dry-run] [full] [area]"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git ls-files:*)
---

# Test Audit

Find where the test suite leaves users or risky code unprotected. Not coverage percentage: **coverage of what matters**. Every core journey proven end to end, every functional core tested through its interface, every slice tested at its seam, and the code that changes most tested best.

## 1. Mode and configuration

Call the Skill tool with "report-findings" to resolve the mode and scope. Read `docs/agents/audits.md` for thresholds and caps. If it is missing: interactively, tell the user to run `/setup-standards`; headless, emit one finding (`rule: audit-not-configured`, `locator: docs/agents/audits.md`) and stop.

Read `docs/agents/stack.md` for the test frameworks, locations and commands, and `CODING_STANDARDS.md` for where each kind of test belongs. Call the Skill tool with "tdd" for the test vocabulary (seams, good and bad tests) used in recommendations.

## 2. Build the coverage map

Follow [COVERAGE-MAP.md](COVERAGE-MAP.md) to build, deterministically:

- **journey → e2e specs**: from journey frontmatter, confirmed by `[journey:<id>]` tags in spec titles;
- **core module → unit tests**: functional-core modules (house-style) and the test files that import them;
- **slice → integration tests**: slice interfaces and the tests that exercise them;
- **hot spots**: the most-changed files in the scope, with the size of their tests.

With incremental scope, build the full journey map (it is cheap) but limit the module and hot-spot passes to paths changed since the last run. Use no more than `subagents_max` sub-agents, split by area.

## 3. Find the gaps

| Rule | Gap | Severity |
|---|---|---|
| `journey-without-e2e` | A `core: true` journey with no `e2e` spec | high |
| `journey-e2e-untagged` | A spec that covers a journey but lacks `[journey:<id>]` (fix: mechanical) | low |
| `journey-e2e-shallow` | A tagged spec that skips journey steps, or never asserts the "Done when" state | medium |
| `core-untested` | A functional-core module with no tests through its interface | medium |
| `slice-untested` | A slice interface with no integration test | medium |
| `hot-spot-thin-tests` | A top-10 churn file whose tests are thin or absent | medium (high if it handles money, auth or personal data) |
| `test-skipped` | `.skip`, `.only`, `test.fixme`, `xit`, or a disabled suite | low (medium if it skips a journey) |
| `ci-missing-suite` | A suite that exists but CI doesn't run | high |
| `test-past-interface` | Tests that mock internal collaborators or assert on internals (tdd's anti-patterns) | low |

Score risk with the rubric in [COVERAGE-MAP.md](COVERAGE-MAP.md). Severity in the table is the default; the rubric can raise it.

## 4. Recommend at the right seam

Every finding's `recommendation` names:

- **the seam**: the journey, slice interface or core function;
- **the test kind**: e2e for journeys, integration for slice interfaces, unit for functional cores (house-style placement);
- **the behaviour to assert**, in `GLOSSARY.md` terms, as a test name ("cancelling within the notice window refunds nothing");
- **prior art**: an existing test in the repo to model it on.

Never recommend testing a shell through mocks of its own internals. If the code can only be tested that way, recommend extracting the core instead, and say so.

## 5. Mechanical fixes

Two gaps are mechanical (`fix: mechanical`):

- adding the `[journey:<id>]` tag to a spec title that clearly covers the journey;
- adding a missing `e2e` link to journey frontmatter (call the Skill tool with "product-modeling" for the format).

Everything else is `fix: judgement`.

## 6. Publish

Call the Skill tool with "report-findings" to publish. Interactively, after publishing, offer to write the top missing test now with tdd, at the seam the finding names.
