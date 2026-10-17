# persona-review

## What it does

Walks a feature or journey as each relevant avatar from `docs/product/avatars.md`, and logs every point where they would hesitate, misread, get stuck or give up. The output is a **friction log** written in the avatar's own voice, plus a verdict per avatar: would they use it, or what would they do instead.

It always does a static pass, reading the routes, components and copy behind the journey as the avatar would meet them. When it is safe, it also does a live pass: it drives the running app in a browser on the avatar's device, but only against non-production URLs with test data.

## When to reach for it

Type `/persona-review <journey or feature>`, or the agent reaches for it on its own when you ask whether something is confusing or useful for a kind of user. `to-spec` runs it automatically (static only) against a draft spec's user stories.

- **Reach for it** when the question is "will *these people* get this done?"
- **For** "should this exist at all?", use [product-review](product-review.md).

## Prerequisites

- Avatars and journeys (from [discover-domain](../setup/discover-domain.md)).
- For the live pass, one of these:
  - a non-production URL in `docs/agents/audits.md` under `live_targets`;
  - the app running locally and named in the session.
- A browser tool: the Playwright MCP (works in CI) or Claude in Chrome (local only).

## Their words

The check that catches the most is vocabulary. Each avatar has a "Their words" list and a "Never show them" list. Internal terms that are perfectly precise in `GLOSSARY.md` can be gibberish on a user's screen. Persona review flags every one it finds in the avatar's path.

## Common questions

**Is the live pass safe to run against my app?**
Only against targets you have listed or started yourself. It refuses production, logs in with seeded test accounts, and stops before payments, real messages or deleting anything it didn't create.

**Why "in the avatar's voice"?**
"I tapped Save and nothing happened. Did it save?" is harder to dismiss than "missing loading state", and it says what the fix has to achieve.

## It's working if

- Friction logs name specific copy and steps, not generic UX advice.
- Some reviews end with "would not use it", and that changes the plan.
- Jargon findings shrink over time as the UI adopts the avatars' words.

## Where it fits

A gate in the plan-to-ship chain beside [product-review](product-review.md), a monthly scheduled audit (static unless live targets are configured), and a standalone check whenever a flow feels off. See [which-skill](../productivity/which-skill.md) for the full map.
