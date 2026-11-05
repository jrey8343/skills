# Audits that read text others wrote

A scheduled run reads and publishes in one session. An audit that reads text a third party can write (an error event's message, a user's feedback, a record fetched through an MCP server) could be prompt-injected into filing, editing or relabelling issues. So while such a source is in use, the renderer leaves that audit out of the schedule and names it. It runs interactively (`/<audit>`), with someone watching, until scheduled runs split reading from writing.

## Which audits read what

The table lives in `scripts/render-workflow.mjs` (`knownAudits`). Each audit reads the source only when the source is available, so it is left out only when the source is in use.

| Audit | Reads | How |
|---|---|---|
| `perf-audit` | `sentry`, `cloudflare-mcp` | production traces and performance issues; Workers metrics |
| `product-review` | `sentry`, `user-feedback` | post-ship evidence of use |
| `security-audit` | `cloudflare-mcp` | edge settings |
| `test-audit`, `docs-audit`, `prune-docs`, `persona-review` | none | |

An entry in `docs/agents/audits.md` can add to its row with `reads: [<source>]`. Nothing removes a source from a row.

## When a source is in use

The renderer decides from the repo itself, plus what `audits.md` declares:

- **`sentry`**: `.mcp.json` names a Sentry server; or `.sentryclirc` or `sentry.properties` exists; or a dependency manifest (`package.json`, `pyproject.toml`, `requirements*.txt`, `Gemfile`, `go.mod`, `Cargo.toml`, …, up to three directories deep, outside `node_modules`, `dist`, `build` and `vendor`) mentions Sentry.
- **`cloudflare-mcp`**: `.mcp.json` names a Cloudflare server.
- **`user-feedback`**: only when `third_party_text` in `audits.md` lists it, since no file shows it reliably.

Any source can also be declared in `third_party_text`, for a server configured somewhere the scan doesn't look. Detection is deliberately broad: a false positive leaves an audit to run by hand, while a false negative schedules one that can be steered by a stranger.

## What every scheduled run is denied

Issue and PR text is also written by others in an open repo, and no file shows whether outsiders can write it. So rather than leaving audits out, every rendered job denies `gh issue view` and `gh pr` (plus package runners such as `npx` and `wrangler`, which would fetch and run code beside the tokens), whatever an audit's own `allowed-tools` grant. Each job also re-checks, before it loads any token, that its audit reads no source now in use, and fails if it does: run `/schedule-audits` again to take it off the schedule.
