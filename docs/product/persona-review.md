# persona-review

## What it does

It walks a journey, a feature or a spec as each avatar it serves, and writes a friction log: every point where that person hesitates, misreads, gets stuck or gives up, in their own voice, ending in a verdict on whether they'd use it at all. It judges the experience for a specific person on a specific device in their own words, not the code and not whether the feature should exist. By default it reads the code and copy. It drives the running app only when you ask and the run is safe.

## When to reach for it

You type it: `/persona-review <journey-id | feature | #spec>`, optionally with `avatar=<id>` or `live`. It's an audit, so the agent never starts it by surprise, and CI can run it on a schedule. Reach for it when the question is "would *this* person get it done?". When the question is "should we build this at all?", run [product-review](product-review.md) instead. For code quality, use Matt's `code-review`.

## Prerequisites

- `docs/agents/audits.md`, seeded by [schedule-audits](../quality/schedule-audits.md). Without it, an interactive run tells you to run `/schedule-audits` and a scheduled run files one `audit-not-configured` issue.
- Avatars and journeys, where `docs/agents/product.md` says (from [product-modeling](product-modeling.md); [discover-domain](discover-domain.md) builds the first set). Without them there's no one to walk as: you're pointed at `/discover-domain`, and a scheduled run files a `persona-model-missing` finding.
- For the live pass: a running app that isn't production, a browser tool in the session (Playwright MCP or Claude in Chrome) and test accounts from the repo's seed or fixtures. List any non-production URLs under `persona-review.live_targets` in `docs/agents/audits.md`.

A scheduled run writes nothing to the repo. An interactive run only offers to update the journey or avatar files (through product-modeling) when the walk shows they've drifted. Screenshots from a live pass go to the OS temp directory.

## Static and live

The **static pass** always runs. It traces each journey step through the routes, components and copy behind the journey's `code` globs, as the avatar would meet them, and checks their words, the path, the error states, accessibility, trust, and drift from the journey file. On a spec, it walks the user stories before anything is built.

The **live pass** drives the app in a browser at the avatar's viewport, tries the obvious mistakes, and stops before anything irreversible: payments, real messages, deleting data it didn't create. It runs only in an interactive session, only against a non-production URL, and only when a browser tool is present. If any of those is missing, it says which and falls back to the static pass. Scheduled runs are always static, so they never read text rendered by a running app.

## Their words

The check that catches the most is vocabulary. Each avatar has a "Their words" list and a "Never show them" list. Internal terms that are perfectly precise in the glossary can be gibberish on a user's screen, so persona review flags every one it finds in the avatar's path.

## The friction log

One table per journey and avatar: the step, what they see, the friction in their voice, its kind (hesitation, misread, jargon, dead end, hidden step, trust gap, access barrier, pointless) and its severity. Then what worked, and a verdict: would use it, reluctantly, or would not, and what they'd do instead. A "would not use it" is the most important thing the review can tell you. Interactive runs then have the avatar question you about the worst points.

Each problem becomes a finding filed through [report-findings](../quality/report-findings.md) (`persona-dead-end`, `persona-jargon`, `persona-not-useful`, …). Swapping a "Never show them" term for the replacement the avatars file names counts as mechanical. Everything else is a judgement call for Triage.

## Common questions

**Can I make it a gate before a spec is built?** Yes, without forking anything: run `/persona-review #<spec>` after Matt's `to-spec` publishes the spec. Since it's user-invoked, an agent can't run it for you; to make it a standing step, write "stop and tell the user to run `/persona-review`" into the repo's `AGENTS.md` or `CLAUDE.md`.

**Why in the avatar's voice?** "I tapped Save and nothing happened. Did it save?" is harder to dismiss than "missing loading state", and it says what the fix has to achieve.

**What does a scheduled run walk?** The core journeys whose code changed since the last run. If none changed, it picks the core journey reviewed least recently. With `full`, it walks every core journey. A repo that marks no journey as core has every journey treated as core. A walk you run by hand on one journey or spec files its findings but opens no tracking issue, so it doesn't change what the next scheduled run walks.

## It's working if

- Friction is quoted in the avatar's words ("Did it save?"), not as generic UX advice.
- Every journey and avatar pair ends with a verdict and what the avatar would do instead.
- A run without a browser tool or a running app says so and still delivers the static pass.
- Scheduled runs file `audit:persona-review` issues with no state label, open no PRs, and the tracking issue names which journeys were walked as whom.
- No live pass ever touches a production URL.
- Jargon findings shrink over time as the UI adopts the avatars' words.

## Where it fits

A periodic audit, also run by hand on a journey or a spec. It reads the model that [product-modeling](product-modeling.md) keeps, sits beside [product-review](product-review.md) (the bet) as the experience check, publishes through [report-findings](../quality/report-findings.md), and runs on a schedule via [schedule-audits](../quality/schedule-audits.md). Matt's `triage` takes the issues from there.
