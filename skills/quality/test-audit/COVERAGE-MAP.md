# Coverage map

Build the map from files and git, not from impressions. The recipes use only Glob and read-only `git`, `grep`, `sort`, `uniq`, `head` and `wc`, which the skill's allowed-tools grant, so a headless run needs no further permission. Adjust the globs to the test locations the repo's placement gives (`CODING_STANDARDS.md`) or, without one, to where the runner configs and test scripts point.

## Journey → e2e

Skip this section when there are no journey files.

Glob every journey file in the journeys directory `docs/agents/product.md` names (default `docs/product/journeys/*.md`) and read each one's frontmatter fields `id`, `core` and `e2e`.

```bash
# Every spec that carries a journey tag (use the tag form in docs/agents/product.md if it names one)
git grep -noE "\[journey:[a-z0-9-]+\]" -- <e2e dir> | sort -u
```

For each journey:

| Declared `e2e` | Tag found in that spec | Result |
|---|---|---|
| empty | no spec carries the tag | `journey-without-e2e` if `core: true` |
| empty or partial | a spec carries the tag but isn't listed | `journey-e2e-unlisted` (mechanical: add the spec to frontmatter) |
| set | yes | covered: check depth (below) |
| set | no | `journey-e2e-untagged` if the spec clearly walks the journey; otherwise `journey-without-e2e` if `core: true` (no listed spec walks the journey), else none |

A listed `e2e` path that doesn't exist counts as untagged and uncovered: `journey-without-e2e` if `core: true`, recommending the spec be written or the entry removed.

A tag whose id matches no journey file is `journey-tag-unknown`: either the journey was never named (note it for product-modeling) or the tag has a typo.

**Depth check** for covered journeys: read the spec. It should walk the journey's steps in order and assert the journey's **Done when** state. A spec that only loads the first page is `journey-e2e-shallow`.

Specs with no journey tag at all: list them. Each either covers a journey (tag it), covers something that should be a journey (note it for product-modeling), or is a technical check (fine).

## Core module → unit tests

Skip this section without placement. Find the functional cores the way `CODING_STANDARDS.md` says the repo marks them: a folder name, a file suffix, a header comment.

```bash
# By folder convention, if the repo uses one
git ls-files '**/core/**' | grep -vE '\.(test|spec)\.'
# By a purity header comment, if the repo uses that convention
git grep -lE "^(//|#|\*).*\b(pure|no I/O|functional core)\b" -- <src dirs>

# Which tests import a given module
git grep -lE "from ['\"].*<module basename>['\"]" -- <test dirs>
```

A core module is untested when no test file imports it (directly or through its slice interface) and asserts on its outputs.

## Slice → integration tests

Skip this section without placement. Find slice interfaces the way `CODING_STANDARDS.md` names them (for example, an `index.ts` per folder under a features root).

```bash
git ls-files '<slice root>/*/index.*'
```

For each slice, look for a test that drives it through its interface (a request to its routes, or a call to its exported functions with the platform's local stand-in for storage). Tests that only cover the core don't count.

When the standards name a slice root but no slices exist there yet, treat each route group or top-level feature module as a slice candidate, and record findings with `confidence: medium`.

## Placement

Skip this section without placement. For each test file, find the seam it tests and compare its kind and location with the placement table: a unit test of a shell, an integration test reaching into a core's internals, or a test outside its kind's location is `test-misplaced`.

## Hot spots

```bash
# Most-changed source files in scope (exclude tests, lockfiles, generated files)
git log --since="90 days ago" --name-only --pretty=format: -- <src dirs> \
  | grep -vE '\.(test|spec)\.|(^|/)[^/]*\.lock$|(^|/)(package-lock\.json|pnpm-lock\.yaml|lockfile)$|\.snap$' \
  | sort | uniq -c | sort -rn | head -20

# Size of a file and of its tests
wc -l <file>
git grep -lE "<module basename>" -- <test dirs>
wc -l <each test file listed>
```

With incremental scope, replace `--since` with `<last-sha>..HEAD`.

## Skipped and missing suites

```bash
git grep -nE "\b(describe|it|test)\.(skip|only|fixme)\b|\bx(it|describe)\(" -- <test dirs>
```

That pattern covers JS runners. Match the skip and focus markers of every runner found in step 1, for example pytest `@pytest.mark.skip` / `skipif` / `xfail`, Go `t.Skip(`, RSpec `xit` / `xdescribe` / `pending` / `fit`, JUnit `@Disabled` / `@Ignore`.

Compare the test suites the repo has (runner configs, the package manifest's test scripts, the commands `CODING_STANDARDS.md` names) against the commands the CI workflows run (`.github/workflows/*.yml`). A suite that exists but CI never runs is `ci-missing-suite`.

## Risk scoring

Raise severity one step (to `critical` only for journeys) when any applies. Raise once however many apply; the table's severities are defaults that count none of these signals.

- the code handles **money, authentication, authorisation, tenancy or personal data**;
- the module is in the **top 5 by churn**;
- **error tracking** shows recurring issues in the module (issues mapped to its path): interactive runs only, when the run can read the error tracker. Headless runs skip this signal and say so in the `summary`, as does a run without access. A finding whose evidence quotes error-event text is `source: external` with `source:errors`;
- the journey is the **only path** to an avatar's core job.

Lower one step when the module is scheduled for deletion or behind a disabled flag.
