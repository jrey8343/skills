# Drift detection

A doc drifts when the code under its `code` globs changes behaviour after its `verified-at` commit.

## Commands

For each doc with `code` globs and a `verified-at` SHA:

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

```bash
# Backticked paths in a doc that no longer exist
grep -oE '`[A-Za-z0-9_./-]+\.[a-z]{1,5}`' <doc> | tr -d '`' | sort -u | while read -r path; do
  git ls-files --error-unmatch "$path" >/dev/null 2>&1 || echo "missing: $path"
done
```

Also check named package scripts (`pnpm <script>`, `npm run <script>`) against `package.json`. For a missing path, look for a rename (`git log --diff-filter=R --name-status -- '*<basename>'`). If exactly one rename explains it, the fix is mechanical.
