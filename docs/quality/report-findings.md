# report-findings

## What it does

The shared back half of every audit: it defines the two modes (interactive and headless), incremental and targeted scope and the findings format, and publishes findings as GitHub issues through a deterministic script. Every finding goes to the repo's Triage: it's filed with an `audit:<audit-name>` fingerprint label and no state label, never as `ready-for-agent` and never as a pull request, even when the fix is mechanical.

## When to reach for it

The agent reaches for it whenever an audit starts (to resolve the mode, settings and scope) and when it hands over findings; you can also type `/report-findings` to file findings from a conversation. You rarely call it directly. It files findings; deciding what to do with them is Matt's `triage`. Scheduling audits in CI is [schedule-audits](schedule-audits.md).

## Prerequisites

- `docs/agents/audits.md` in the target repo, seeded by [schedule-audits](schedule-audits.md). It supplies the severity threshold, the per-run cap on new issues and the sub-agent limit. When it's missing, an interactive audit tells you to run `/schedule-audits`; a headless audit files one `audit-not-configured` finding and stops. A skill that only files findings through it, without being an audit, falls back to the publisher's defaults instead.
- `docs/agents/issue-tracker.md`, from Matt's `setup-matt-pocock-skills`. The publisher writes to GitHub only; on any other tracker you get the findings table (or, headless, the report JSON in the log) and nothing is filed.
- An authenticated `gh` and Node 22 or later where the publisher runs.

## How publishing behaves

A zero-dependency script fingerprints every finding (audit, rule and a line-number-free locator) and matches it against every existing issue for that audit:

- an open match is left alone, or relabelled if its severity changed;
- a match closed as completed is reopened with a `regression` label, and any state label it kept is removed so it goes back through Triage;
- a match closed as not planned stays suppressed for good;
- new findings are capped per run, highest severity first, and the rest are listed in the run's tracking issue.

Each sweep (a scheduled run, or an interactive one over the whole incremental or full scope) gets one tracking issue holding the audited SHA, which the next incremental run starts from, and supersedes the last one. A mechanical finding is labelled `fix: mechanical`, so Triage can send it straight to an agent. Untrusted text is fenced and has its @mentions neutralised.

## Sweeps, targeted runs and the two modes

When you point an audit at one thing (a PR, a journey, a feature, an `area`), the run is **targeted**. Its findings are filed and deduped exactly like a sweep's, and each says which target it came from, but it opens no tracking issue. So it never moves the point the next scheduled run starts from, and it never closes the last sweep's tracking issue: reviewing one PR can't make the next scheduled run skip everything else that shipped. You get the target and anything over the cap in the publisher's output instead. Scheduled runs are always sweeps; the publisher refuses a targeted report from a headless run.

Headless runs (CI's `claude -p "/<audit> headless"`) never ask, never edit, commit or push, and publish on their own. Interactive runs show you a table, let you pick what to file (what you pick is filed whatever its severity), and can make a mechanical fix in your working tree with you watching. Committing it is up to you. In both modes, a missing input such as `CODING_STANDARDS.md` or the product model skips the checks that need it and the summary names them.

## Why a script does the writing

An audit that reads error events, user feedback or email is reading text anyone can write. The model reading it only builds a JSON report; the script does the writing, refuses to run anything but `gh issue` and `gh label`, and refuses to apply a state label. Externally sourced findings carry a `source:*` label and are never marked mechanical, so a human stands between untrusted text and an agent that writes code.

## It's working if

- Running the same audit twice creates no new issues.
- Closing an issue as "not planned" makes it stay closed.
- Fixed problems that come back reopen with a `regression` label.
- No audit issue arrives with `ready-for-agent` or any other state label, and no audit ever opens a pull request.
- Reviewing a single PR or journey files its findings but leaves the last scheduled run's tracking issue open, and the next scheduled run still covers everything since that run.
- A repo without `docs/agents/audits.md` gets one `audit-not-configured` issue per scheduled audit (titled with the audit's name), filed once and not duplicated by later runs, not a failed job. Each of those runs still opens a tracking issue that supersedes the previous one. Once the file exists, the next sweep of that audit is a full one and closes the issue.

## Where it fits

The plumbing under every audit: [security-audit](security-audit.md), [test-audit](test-audit.md), [perf-audit](perf-audit.md), [docs-audit](docs-audit.md), [prune-docs](prune-docs.md), [product-review](../product/product-review.md) and [persona-review](../product/persona-review.md). [schedule-audits](schedule-audits.md) runs them on a schedule; Matt's `triage` takes the issues from there.
