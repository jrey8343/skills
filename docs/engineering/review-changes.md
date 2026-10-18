# review-changes

## What it does

`review-changes` reviews the diff between `HEAD` and a fixed point you name (a commit, a branch, a tag, `main`, `HEAD~5`) along two axes. **Standards** asks whether the code follows how this repo writes code: `CODING_STANDARDS.md` with its **[hard]**/**[judgement]** tags, any other documented standards, and a baseline of Fowler code smells. **Spec** asks whether the code does what the originating issue or spec asked for. Each axis runs in its own sub-agent so neither sees the other's reasoning.

It never merges or re-ranks the two axes. A change can pass one and fail the other, and a blended verdict lets the passing axis hide the failing one. It's named `review-changes` rather than `code-review` so it doesn't collide with Claude Code's built-in `/code-review`, which hunts bugs instead.

## When to reach for it

Type `/review-changes`, or the agent reaches for it when you ask to review a branch, a PR, work in progress, or anything "since X". [implement](implement.md) and [implement-spec](implement-spec.md) call it as their closing review.

| Your situation | Reach for |
| --- | --- |
| A diff exists: is it built right, and is it the right thing? | `review-changes` |
| Hunt bugs in the diff (null paths, races, off-by-one) | Claude Code's built-in `/code-review` |
| A security pass on the diff | Claude Code's built-in `/security-review`; for the whole repo, [security-audit](../audits/security-audit.md) |
| The whole codebase has drifted, not one diff | [improve-codebase-architecture](../audits/improve-codebase-architecture.md) |

## Prerequisites

The Standards axis needs nothing: with no `CODING_STANDARDS.md` it uses the [house-style](house-style.md) rules, then the smell baseline. [setup-standards](../setup/setup-standards.md) writes `CODING_STANDARDS.md` for you. The Spec axis needs a findable spec: issue references in commits (via the tracker config), a path you pass, a spec file, or it asks you.

## The two axes

| | Standards | Spec |
| --- | --- | --- |
| Question | Is it built right? | Is it the right thing? |
| Reads | `CODING_STANDARDS.md`, other documented standards, house style if no standards file, the smell baseline | The originating issue or spec |
| Reports | [hard] breaks as violations citing the rule; [judgement] rules and smells as "possible …" | Missing or partial requirements, scope creep, wrong implementations, unapplied model changes |

The repo always overrides: a documented standard beats the house rules, which beat the baseline. Anything tooling already enforces is skipped.

## Common questions

**Should I run it in the session that wrote the code?**

Prefer a fresh one. A reviewer carrying every assumption that shaped the code is confirming, not reviewing.

**It finds new things every time I run it.**

Each fix adds code to review, and judgement calls vary between runs. Act on findings backed by a cited rule, then stop; it won't converge to clean.

**Does it review uncommitted work?**

No. It diffs `<fixed-point>...HEAD`. Commit first, then review.

**Can I trust the findings?**

Check each citation before acting. Every finding must cite a rule, a smell plus its hunk, or a spec line; that's what makes them checkable.

## It's working if

- It refuses a bad ref or an empty diff before spawning anything.
- The report has separate `## Standards` and `## Spec` blocks.
- Violations cite a `CODING_STANDARDS.md` rule; judgement calls read "possible …".
- With no spec, the Spec block says so instead of inventing requirements.
- A glossary term the spec carried but the diff never wrote is reported as a Spec finding, not quietly passed.

## Where it fits

The review step at the tail of the build chain: [to-spec](to-spec.md) → [to-tickets](to-tickets.md) → [implement](implement.md) → `review-changes`. [pr](pr.md) writes the PR body afterwards; [improve-codebase-architecture](../audits/improve-codebase-architecture.md) is the whole-codebase counterpart. For the whole map, see [which-skill](../productivity/which-skill.md).
