# test-audit

## What it does

Finds where the test suite leaves users or risky code unprotected, and files the gaps as prioritised issues. It measures **coverage of what matters** rather than a percentage:

- every core journey proven end to end;
- every functional core tested through its interface;
- every slice tested at its seam;
- the most-changed code tested best.

The map is built deterministically. Journey files declare their e2e specs, and specs carry a `[journey:<id>]` tag in their titles. So "which core journeys have no e2e test" is a set difference, not a guess.

## When to reach for it

You invoke this by typing `/test-audit`, and the agent won't reach for it on its own. It also runs weekly when scheduled.

- **Reach for it** before a release, after a burst of feature work, or when bugs keep escaping in the same area.
- **To write a test now**, use [tdd](../engineering/tdd.md); test-audit offers to hand over to it for the top gap.

## Prerequisites

- [setup-standards](../setup/setup-standards.md) (for `docs/agents/audits.md` and `stack.md`).
- Journeys from [discover-domain](../setup/discover-domain.md), for the journey-to-e2e map. Without journeys it still audits modules and hot spots.

## Recommendations at the right seam

Every gap names the seam (journey, slice interface or core function) and the test kind that belongs there: e2e, integration or unit, following the house style. It also gives a test name in domain terms and an existing test to model it on. It never recommends mocking a module's own internals. When code can only be tested that way, it recommends extracting the core instead.

## It's working if

- Core journeys without e2e tests trend to zero.
- Bugs that reach Sentry land in code the audit had already flagged, or in code it now flags.
- New specs arrive already tagged with their journey id.

## Where it fits

A weekly scheduled audit, and a standalone check before releases. Neighbours: [tdd](../engineering/tdd.md) writes the tests it asks for; [docs-audit](docs-audit.md) does the same journey-based coverage check for documentation. See [which-skill](../productivity/which-skill.md) for the full map.
