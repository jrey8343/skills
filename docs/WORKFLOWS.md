# Workflows

How the skills chain together. For a quick "which one do I need?", type `/which-skill`.

## 1. Adopting the standard in a repo

Run once per repo. Each step leaves files the next one reads.

```mermaid
flowchart LR
  A["/setup-standards<br/>docs/agents/*, CODING_STANDARDS.md,<br/>labels, gap roadmap"] --> B["/discover-domain<br/>PRODUCT.md, avatars,<br/>journeys, GLOSSARY.md"]
  B --> C["/prune-docs<br/>lean CLAUDE.md,<br/>docs/features, ADRs"]
  C --> D["/adopt-1password"]
  D --> E["/adopt-sentry<br/>(policy gate first)"]
  E --> F["/schedule-audits<br/>claude-audits.yml"]
```

The order matters a little: the product model gives the audits something to judge against, a lean `CLAUDE.md` makes every later run cheaper, and the scheduled workflow needs the 1Password service account.

## 2. Idea to shipped feature

```mermaid
flowchart TD
  G["/grill-with-docs"] --> P{"Need a runnable answer?"}
  P -- yes --> PR["/prototype"] --> G
  P -- no --> S{"Multi-session?"}
  S -- no --> I["/implement"]
  S -- yes --> SP["/to-spec"]
  SP --> GATE["product-review + persona-review<br/>(gate on the draft spec)"]
  GATE -- "rethink / don't build" --> G
  GATE -- "build" --> T["/to-tickets"]
  T --> I
  T --> IS["/implement-spec"]
  I --> R["review-changes"]
  IS --> R
```

Building means tdd at agreed seams, in the house style. Done means tests at those seams, a feature doc, a user doc if the change is user-visible, journey links updated, and an ADR if the decision was hard to reverse.

Each build runs in its own git worktree, so sessions can work in parallel. `implement` sweeps away worktrees whose work has merged, starts a fresh one, and ends with a pushed branch and a PR. The next sweep removes that worktree once the PR merges (proven by git or the forge, never by the issue closing). Type `/worktree` to sweep at any time.

## 3. The audit loop

```mermaid
flowchart LR
  CRON["claude-audits.yml<br/>(cron or dispatch)"] --> PLAN["plan job<br/>which audits are due,<br/>skip if no new commits"]
  PLAN --> AN["analyse job (read-only)<br/>/jrey-skills:&lt;audit&gt; headless<br/>emits findings JSON"]
  AN --> PUB["publish job (issues: write)<br/>publish-findings.mjs<br/>dedupe, tracking issue"]
  PUB --> TR["/triage<br/>human promotes to<br/>ready-for-agent"]
  TR --> IMP["/implement"]
```

- **Read and write are separated.** The model that reads Sentry events, feedback or code holds no write access; a deterministic script publishes.
- **Dedupe across runs.** Each finding has a fingerprint. Open issues are left alone, issues closed as completed reopen as regressions, and issues closed as not planned stay closed.
- **Untrusted sources never skip a human.** Issues derived from Sentry, feedback or email are labelled `source:*` and `needs-triage`. Only a human makes them agent-ready.

Run any audit interactively to pick which findings to file and to grill the top one.

## 4. The journey join

```mermaid
flowchart LR
  AV["Avatar<br/>docs/product/avatars.md"] --> J["Journey<br/>docs/product/journeys/&lt;id&gt;.md"]
  J --> E2E["e2e spec<br/>titled [journey:&lt;id&gt;]"]
  J --> FD["Feature doc<br/>docs/features/*.md"]
  J --> UD["User doc<br/>marketing site /help"]
  J --> CODE["code: globs<br/>+ verified-at"]
```

| Audit | Uses the join to find |
|---|---|
| test-audit | Core journeys with no e2e spec |
| docs-audit | Journeys with no feature or user doc; docs whose code changed after `verified-at` |
| persona-review | The steps to walk, and as which avatar |
| product-review | Which avatar job a feature serves |
| sentry-triage | Which journey an error breaks (stack frames against `code:` globs) |

## 5. Errors and feedback

```mermaid
flowchart LR
  APP["App errors and<br/>slow transactions"] --> SEN["Sentry"]
  FB["Feedback widget"] --> SEN
  MAIL["support@ email"] --> EW["Email Worker<br/>captureFeedback"] --> SEN
  SEN --> ST["/sentry-triage<br/>(daily)"] --> GH["GitHub issues<br/>needs-triage, source:*"]
  GH --> TRI["/triage"] --> FIX["/implement<br/>commit says Fixes SHORT-ID"]
  FIX --> SEN
```

## 6. A backlog that has piled up

When audits and agent runs file issues faster than anyone can triage them, synthesize first, then triage what's left.

```mermaid
flowchart LR
  BL["Open issues<br/>(every one, with comments)"] --> SB["/synthesize-backlog<br/>digest, six lenses, merge,<br/>skeptic + fit-checker"]
  SB --> REP["Report: ranked threads,<br/>landing order, triage plan"]
  REP --> TRK["Thread trackers for the<br/>threads you pick, members attached"]
  TRK --> ENTRY["/implement, /to-spec<br/>or /wayfinder"]
  REP --> TRI["/triage<br/>the issues no thread covers"]
```

- **Threads, not topics.** A thread is one cause in the code and one change that removes it; grouping by product area doesn't count.
- **Verified against what is live.** Agents read a detached checkout of the default branch's tip, never a local checkout that may be behind.
- **Read-only until you pick.** The run writes only to a temp directory and a temporary detached checkout; thread trackers appear only for the threads you choose, and the next run extends them.
