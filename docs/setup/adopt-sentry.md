# adopt-sentry

## What it does

Instruments every runtime in a repo with Sentry (errors, traces, releases with source maps, and the user-feedback widget) and routes support email into Sentry User Feedback through a small Cloudflare Email Worker, so all signals from real users land in one place. It runs a **policy gate** first: if the repo has written down a rule against third-party error vendors, data leaving a region, or similar, nothing gets installed until you've decided, and the decision is recorded as an ADR.

## When to reach for it

You invoke this by typing `/adopt-sentry`, and the agent won't reach for it on its own. Reach for it when a repo has no error tracking, or a home-grown error log you want to outgrow. It's usually the `error-tracking` gap from [setup-standards](setup-standards.md). For turning Sentry issues into GitHub issues once it's running, use [sentry-triage](../audits/sentry-triage.md).

## Prerequisites

- `docs/agents/stack.md` (from [setup-standards](setup-standards.md)) helps; without it the skill detects the runtimes itself.
- Ideally [adopt-1password](adopt-1password.md) first, so the source-map upload token has a home.
- Writes: SDK setup per runtime, the support-email Worker, `docs/features/error-tracking.md`, stack.md updates, possibly an ADR and draft privacy-doc changes.

## The policy gate

Sending stack traces, URLs and user context to a third party is a data-sharing decision. The skill searches ADRs, `PRODUCT.md` constraints, privacy and subprocessor docs, threat models and code comments. If something conflicts, it quotes it and grills you on what would reach Sentry, whether scrubbing makes that acceptable, which region (US or EU, permanent), and what else must change. It never resolves a legal question for you: draft privacy-doc changes are flagged for legal review.

## Privacy by default

`sendDefaultPii: false`, a `beforeSend` scrubber, no IP storage, Session Replay off (or fully masked and kept off sensitive screens), and server-side scrubbing. SDK versions and setup are resolved from current docs at run time, never from remembered snippets, because they change often. For example, the Capacitor SDK pins its companion browser SDK to an exact version, which can hold back a shared web bundle.

## Common questions

**What happens to my existing error log?**
It keeps running alongside Sentry for a parallel period, and the skill files an issue to remove it later. It never deletes it.

**Why route support email through Sentry?**
So `/sentry-triage` sees feedback, errors and emails in one queue, deduped and linked to journeys. The email still reaches your inbox unchanged; Sentry gets a copy. Auto-replies are forwarded but not captured.

## It's working if

- A test error in a non-production deploy shows up with a readable, source-mapped stack, a release and an environment.
- A test email to the support address appears as feedback and still arrives in the inbox.
- The event JSON for a test error contains no emails, tokens or request bodies.

## Where it fits

A run-once adoption skill. Before it: [setup-standards](setup-standards.md) (flags the gap) and ideally [adopt-1password](adopt-1password.md). After it: [sentry-triage](../audits/sentry-triage.md), on demand or daily through [schedule-audits](schedule-audits.md). See [which-skill](../productivity/which-skill.md) for the full map.
