---
name: adopt-sentry
description: "Instrument this repo with Sentry for errors, performance and user feedback, including a support-email Worker that turns emails into feedback, after checking that no policy forbids it."
disable-model-invocation: true
---

# Adopt Sentry

Wire every runtime in the repo to Sentry (errors, traces, releases with source maps, user feedback) and route support email into Sentry User Feedback. Every report then lands in one place, ready for `/sentry-triage`.

**The policy gate comes first.** Sending error data to a third party is a data-sharing decision before it is a technical one. If anything in the repo restricts it, nothing gets installed until the user has decided, with the decision written down.

Work on a branch. Read `docs/agents/stack.md` for the runtimes; if it's missing, detect them from the configs and suggest `/setup-standards` afterwards.

## 1. Policy gate

Search the repo as [POLICY-GATE.md](POLICY-GATE.md) describes: ADRs, `PRODUCT.md` constraints, privacy and subprocessor docs, threat models, consent copy, and code or config comments.

- **Nothing found**: say what you searched, and continue.
- **Anything found** (a ban on third-party error vendors, data-residency rules, cross-border transfer limits, regulated-data handling): stop. Quote it, then call the Skill tool with "grilling" and work through the questions in POLICY-GATE.md. Continue only on an explicit decision to proceed. Then:
  - call the Skill tool with "domain-modeling" and record a superseding ADR with the additions POLICY-GATE.md lists (what changes, the mitigations, the review trigger);
  - draft updates to any subprocessor register, privacy policy or consent copy, and mark them **for legal review** in your summary. Don't present them as final.
- **Decision is no**: record that as an ADR too (so future runs don't re-ask), and stop.

## 2. Decide the shape

Ask, recommended answer first:

- **Data region**: US or EU (Frankfurt). It's set when the organization is created and **cannot be changed**. Recommend the region closest to the strictest constraint found in step 1.
- **Projects**: one per deployable surface (API Worker, web client, native app), so alerts and quotas separate cleanly.
- **Environments**: production, preview and development, with names matching the deploy setup.
- **Sampling**: errors 100%; traces start at about 10% in production, 100% elsewhere.
- **Session Replay**: off by default. If wanted, fully masked, and never on screens the product marks sensitive (see [PRIVACY.md](PRIVACY.md)).

## 3. Resolve versions and current setup

Don't trust remembered snippets. For each runtime:

- `npm view <package> version peerDependencies` for the SDK packages you plan to use;
- the current guide, via the sentry MCP (`search_docs`, `get_doc`) or by fetching docs.sentry.io;
- the constraints in [RUNTIMES.md](RUNTIMES.md): the Capacitor SDK's exact-pinned companion version, Astro adapter support, the Workers compatibility flags.

State which versions you chose and why, especially where a shared bundle forces an older line.

## 4. Instrument

Following RUNTIMES.md and the docs you just read, per runtime:

- initialise the SDK with the privacy defaults from PRIVACY.md (`sendDefaultPii: false`, `beforeSend` scrubbing, no IP storage);
- set `release` and `environment` from the deploy (on Workers, the version metadata binding);
- upload source maps in the build or deploy step, using an auth token loaded from 1Password in CI (with `/adopt-1password` already done, add the token to the CI vault; otherwise list it as a manual step);
- add the **feedback widget** (`feedbackIntegration`) to user-facing clients, with copy in the avatars' words if `docs/product/avatars.md` exists;
- capture handled errors at the seams where the code already catches and logs them. Assertion failures (`AssertionError`) must reach Sentry unfiltered.

Follow `CODING_STANDARDS.md`: initialisation lives in the shell, and core modules stay free of Sentry imports.

## 5. Support email → feedback

Build the support-email Worker from [EMAIL-WORKER.md](EMAIL-WORKER.md): a pure core that bounds size, extracts plain text and drops auto-replies; a shell that calls `Sentry.captureFeedback` and always forwards to the human inbox. Add it to the existing Worker's `email()` handler, or create a small standalone Worker. Ask which, and recommend standalone when the main Worker serves user traffic.

## 6. Human steps

Call the Skill tool with "wizard" for the dashboard work:

- create the organization (in the chosen region) and projects, and copy the DSNs (public, so they go into config, not secrets);
- create an auth token with release-upload scope (into 1Password);
- create the Email Routing rule sending the support address to the email Worker;
- optionally, install Sentry's GitHub integration so `Fixes <SHORT-ID>` in a commit resolves issues on release;
- suggest (don't create) starter alert rules: new issue in production, regression, and an error-rate spike.

## 7. Verify (human-run where it needs credentials)

Ask the user to deploy to a non-production environment and confirm:

- a thrown test error appears with a source-mapped stack, the right release and the right environment;
- a test feedback submission appears;
- a test email to the support address appears as feedback and still reaches the inbox;
- no PII appears in the test event (check the event JSON).

## 8. Coexist, then document

- If the repo has a home-grown error log or alerting, keep it running alongside for a parallel period. Publish an issue to remove it after a set date. Never delete it in this skill.
- Update the error-tracking section of `docs/agents/stack.md`.
- Call the Skill tool with "project-docs" and write `docs/features/error-tracking.md`: what reports where, the scrubbing rules, sampling, the email path, and how to tell it's healthy.
- Offer the sentry MCP entry for `.mcp.json`: `{"type": "http", "url": "https://mcp.sentry.dev/mcp"}`, which authenticates by OAuth with no token in the repo.
- Tell the user that `/sentry-triage` now works, and that `/schedule-audits` can run it daily once a read-only Sentry token is in the CI vault.

Leave the changes uncommitted for review unless the user asks you to commit.
