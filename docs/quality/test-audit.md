# test-audit

## What it does

Finds where the test suite leaves users or risky code unprotected and files each gap as an issue, ranked by risk. It measures coverage of what matters, not a coverage percentage: every core journey proven end to end, every functional core tested through its interface, every slice tested at its seam, and the most-changed code tested best. Every recommendation names the seam to test at, the kind of test, the behaviour to assert as a test name, and an existing test to model it on.

## When to reach for it

You type it (`/test-audit`), or CI runs it on a schedule (`/test-audit headless`). The agent never starts it on its own. Use it to find which tests are missing. To write a test, use Matt's `tdd`; an interactive run offers to start one for the top gap. For uncovered docs rather than tests, use [docs-audit](docs-audit.md).

## Prerequisites

- `docs/agents/audits.md`, seeded by [schedule-audits](schedule-audits.md). Without it, an interactive run tells you to run `/schedule-audits`, and a headless run files one `audit-not-configured` issue and stops.
- Optional, and each one unlocks a set of checks:
  - `CODING_STANDARDS.md` with a test placement section (which seam gets which kind of test, and where it lives). Without it, the core, slice and placement checks are skipped and the summary says so; an interactive run offers a placement table you can adapt.
  - A product model from [product-modeling](../product/product-modeling.md) (journey files, located through `docs/agents/product.md`). Without it, the journey checks are skipped; an interactive run points you at [discover-domain](../product/discover-domain.md).
  - CI workflows the run can read, for the check that every suite actually runs in CI.

It writes nothing in the repo on its own. Findings go to the issue tracker through [report-findings](report-findings.md).

## What it looks for

- **Journeys**: core journeys with no e2e spec, specs that walk a journey without carrying its `[journey:<id>]` tag, tagged specs the journey doesn't list, tags for journeys that don't exist, and specs that never reach the journey's **Done when** state.
- **Seams**: functional cores with no unit tests through their interface, slices with no integration test, and tests of the wrong kind or in the wrong place for their seam, all judged against the repo's own placement.
- **Risk**: the most-changed files with thin tests, skipped or focused tests left in, suites CI never runs, and tests that mock internals. Severity rises for code that handles money, auth, tenancy or personal data, and for journeys that are an avatar's only path to their goal.

Stack detail lives beside the skill (Cloudflare Workers' test pool and bindings, for example), so the main checks stay stack-neutral.

## Common questions

**Does it fix anything?** Headless runs never edit, commit or push. Two gaps are mechanical (adding a journey tag to a spec title, adding a spec to a journey's `e2e` list) and are labelled `fix: mechanical` so Triage can route them. An interactive run files them the same way, then offers to write the top missing test with Matt's `tdd`.

**Why did it skip half its checks?** A missing input skips the checks that depend on it rather than guessing. The run's summary names each skipped check and the file that would enable it.

## It's working if

- Every core journey either has a tagged e2e spec or an open `audit:test-audit` issue saying it doesn't.
- A grep for `[journey:` in the tests matches the `e2e` lists in the journey files.
- Recommendations read as test names in the product's vocabulary and point at a real test to copy.
- Re-running it files nothing new until the code or tests change.

## Where it fits

A periodic audit, scheduled by [schedule-audits](schedule-audits.md) and published through [report-findings](report-findings.md); Matt's `triage` decides what happens to its issues and Matt's `tdd` writes the missing tests. It reads journeys from [product-modeling](../product/product-modeling.md), which [discover-domain](../product/discover-domain.md) builds first. Its siblings are [security-audit](security-audit.md), [perf-audit](perf-audit.md) and [docs-audit](docs-audit.md).
