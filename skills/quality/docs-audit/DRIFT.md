# Drift detection

A doc drifts when the code under its `code` globs changes behaviour after its `verified-at` commit, or when a path, link or script it names stops existing.

## Commands

For each feature doc and journey with `code` globs and a `verified-at` SHA:

```bash
# 1. Is verified-at still reachable? (A rebase or squash can orphan it.)
git cat-file -e <verified-at>^{commit} && echo reachable

# 2. Do the globs still match files?
git ls-files -- <glob> <glob> | head -1          # empty output = doc-dead-glob

# 3. Which commits touched the code since verification?
git log --oneline --no-merges <verified-at>..HEAD -- <glob> <glob>

# 4. What did they change?
git diff --stat <verified-at>..HEAD -- <glob> <glob>
git show --stat <sha>                             # per commit, when deciding
```

If `verified-at` is unreachable, report `doc-drift` with `confidence: low` and evidence "verified-at <sha> not in history".

Globs are git pathspecs. Quote them so the shell doesn't expand them: `git log -- 'src/features/bookings/**'`.

## Which commits count as behaviour-changing

Read the commit subjects and, when unclear, the diff. A commit counts when it changes what the code does for a caller or user:

| Counts | Doesn't count |
|---|---|
| New or removed routes, handlers, fields, states, errors | Formatting, lint fixes, import reordering |
| Changed validation, limits, permissions or defaults | Renames with no behaviour change (check the diff) |
| Changed copy or UI flow (for user docs) | Test-only changes |
| Schema or migration changes the feature reads or writes | Comment-only or type-only changes with no runtime effect |
| Changed integration with a third party | Dependency bumps with no API change in this code |

When at least one counting commit exists, it is `doc-drift`. List the counting commits (SHA and subject) in `evidence`, newest first, at most 10, with "and N more" if longer.

## Dead paths

Run this over agent docs and feature docs (not ADR bodies), with the granted tools only:

1. Use the Grep tool on the doc for backticked paths, pattern `` `[A-Za-z0-9_./-]+\.[a-z]{1,5}` ``, and drop duplicates.
2. Check each path with `git ls-files --error-unmatch -- <path>`, first as written (relative to the repo root), then joined to the doc's own folder. Report it missing only when both fail.
3. Check relative Markdown links (`[text](path)`) resolve from the doc's folder, with `git ls-files` or the Glob tool.
4. Check named scripts or tasks (`npm run <script>`, `make <target>`, and the like) by reading the repo's script manifest.

For a missing path, look for a rename (`git log --diff-filter=R --name-status -- '*<basename>'`). If exactly one rename explains it, the fix is mechanical.

User docs that live in a separate docs checkout resolve against that checkout, not this repo. Check only their relative links, with the Glob tool rooted at the checkout's content path; backticked repo paths are checked in feature docs and agent docs only. When the checkout is missing, skip user-doc dead paths and say so in the summary.

In agent docs, a link to an absolute path, a home-directory path (`~/…`) or a `../` path that climbs out of the repo is `doc-link-outside-repo`: agent docs never link outside the repo. `prune-docs` doesn't file these or dead paths, so this audit is their only owner.

## ADR links

```bash
# ADR files at the location domain.md names (default docs/adr/)
git ls-files -- '<adr-dir>/*.md'
```

Read the leading number off each file name in that list. Two files with the same number are an `adr-number-clash`.

Resolve each feature doc's `adrs` entry, each ADR link in an agent doc, and each `superseded by ADR-NNNN` status against that list.
