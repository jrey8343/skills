# setup-standards

## What it does

Configures a repo so every other skill knows where things live. It records the issue tracker and labels, where the domain and product docs go, what the stack is, where feature and user docs live, and which audits run how often. It also writes `CODING_STANDARDS.md` from the house style. Then it measures the repo against the target state and offers a roadmap of gaps as issues.

It writes configuration and docs, never application code. Every file is shown to you as a draft before it lands.

## When to reach for it

You invoke this by typing `/setup-standards`; the agent won't reach for it on its own. Run it once when you start using the skills in a repo, and again whenever you want a fresh gap list. To change a single setting, edit `docs/agents/*.md` by hand instead.

## What it leaves behind

| File | Read by |
|---|---|
| `docs/agents/issue-tracker.md`, `triage-labels.md` | Everything that files or reads issues |
| `docs/agents/domain.md`, `product.md` | Every skill that needs domain or product context |
| `docs/agents/stack.md` | Audits, adopt-* skills, house-style |
| `docs/agents/docs-targets.md` | project-docs, docs-audit, implement |
| `docs/agents/audits.md` | Every audit, and `/schedule-audits` |
| `CODING_STANDARDS.md` | review-changes, implement, the audits |
| `## Agent skills` block in `CLAUDE.md` | Every session (the pointers to all of the above) |

Plus labels on the tracker, and optional `.mcp.json` entries for Cloudflare and Sentry (OAuth, no stored tokens).

## The gap pass

The target state is a checklist of observable facts: a lean agent doc, a product model, e2e tests for every core journey, Sentry in every runtime, secrets in 1Password, security headers, performance budgets, docs coverage, scheduled audits. Each unmet row becomes a finding that names the skill that fixes it. Re-running the skill re-checks the rows without duplicating issues.

## Common questions

**It found a policy that conflicts with a target (for example "no third-party error vendor"). Now what?**
The gap is still filed, with the conflict noted. The skill that fixes it (`/adopt-sentry` here) stops and grills you before changing anything, and records the decision as an ADR.

**Do I need GitHub?**
For the audits to file issues, yes. Other trackers work for specs and tickets; audits then show findings in the session only.

## It's working if

- Skills stop asking you where things are.
- The gap list shrinks every time you re-run it.

## Where it fits

The run-once precondition for everything else. Next comes [discover-domain](discover-domain.md), then [prune-docs](../audits/prune-docs.md). See [which-skill](../productivity/which-skill.md) for the full map.
