# report-findings

## What it does

The shared back half of every audit. It defines the two modes (interactive and headless) and incremental scope, the findings format, and the publisher that turns findings into GitHub issues.

Publishing is deterministic and idempotent. A zero-dependency script fingerprints every finding and matches it against every existing issue for that audit:

- an open match is left alone;
- a match closed as completed is reopened as a regression;
- a match closed as not planned stays suppressed forever;
- new findings are capped per run.

Each run gets one tracking issue and supersedes the last. Untrusted text is fenced and has its @mentions neutralised.

## When to reach for it

The agent reaches for it whenever an audit hands over findings; you can also type `/report-findings` to file findings from a conversation. You rarely call it directly.

## Why a script does the writing

In CI, the model that reads Sentry events, user feedback or support email (text anyone can write) holds no write access. It emits findings as JSON; a separate job runs the publisher with `issues: write`. Externally sourced issues are labelled for triage, never as agent-ready, so a human always stands between untrusted text and an agent that writes code.

## It's working if

- Running the same audit twice creates no new issues.
- Closing an issue as "not planned" makes it stay closed.
- Fixed problems that come back reopen with a `regression` label.

## Where it fits

The plumbing under every audit and the [setup-standards](../setup/setup-standards.md) gap pass. See [which-skill](../productivity/which-skill.md).
