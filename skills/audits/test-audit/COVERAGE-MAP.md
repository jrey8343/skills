# Coverage map

Build the map from files and git, not from impressions. Adjust globs to the test locations in `docs/agents/stack.md`.

## Journey → e2e

```bash
# Every journey file and its declared specs
ls docs/product/journeys/*.md
# For each journey: read frontmatter fields id, core, e2e

# Every spec that carries a journey tag
grep -rnoE "\[journey:[a-z0-9-]+\]" <e2e dir> | sort -u
```

For each journey:

| Declared `e2e` | Tag found in that spec | Result |
|---|---|---|
| empty | n/a | `journey-without-e2e` if `core: true` |
| set | yes | covered: check depth (below) |
| set | no | `journey-e2e-untagged` if the spec clearly covers the journey; otherwise treat as uncovered |
| empty | a spec carries the tag | mechanical: add the spec to frontmatter |

**Depth check** for covered journeys: read the spec. It should walk the journey's steps in order and assert the journey's "Done when" state. A spec that only loads the first page is `journey-e2e-shallow`.

Specs with no journey tag at all: list them. Each either covers a journey (tag it) or covers something that should be a journey (note it for product-modeling), or is a technical check (fine).

## Core module → unit tests

```bash
# Functional-core modules: by convention (house-style) and by content
git ls-files '**/core/**' | grep -vE '\.(test|spec)\.'
# Modules declaring purity in a header comment, if the repo uses that convention
grep -rlE "^(//|\*).*\b(pure|no I/O|functional core)\b" <src dirs>

# Which tests import a given module
grep -rlE "from ['\"].*<module basename>['\"]" <test dirs>
```

A core module is untested when no test file imports it (directly or through its slice interface) and asserts on its outputs.

## Slice → integration tests

```bash
git ls-files '**/features/*/index.ts'
```

For each slice, look for a test that drives it through its interface (an HTTP request to its routes, or a call to its exported functions with a local stand-in for storage). Tests that only cover the core don't count.

Repos without slices yet: treat each route group or top-level feature module as a slice candidate, and record findings with `confidence: medium`.

## Hot spots

```bash
# Most-changed source files in scope (exclude tests, lockfiles, generated files)
git log --since="90 days ago" --name-only --pretty=format: -- <src dirs> \
  | grep -vE '\.(test|spec)\.|lock|\.snap$' | sort | uniq -c | sort -rn | head -20

# Size of a file and of its tests
wc -l <file>
grep -rlE "<module basename>" <test dirs> | xargs wc -l
```

With incremental scope, replace `--since` with `<last-sha>..HEAD`.

## Skipped and missing suites

```bash
grep -rnE "\b(describe|it|test)\.(skip|only|fixme)\b|\bx(it|describe)\(" <test dirs>
```

Compare the test commands in `docs/agents/stack.md` and the `test` scripts in `package.json` against the commands the CI workflows run (`.github/workflows/*.yml`). A suite that exists but CI never runs is `ci-missing-suite`.

## Risk scoring

Raise severity one step (to at most `critical` only for journeys) when any applies:

- the code handles **money, authentication, authorisation, tenancy or personal data**;
- the module is in the **top 5 by churn**;
- **error tracking** shows recurring issues in the module (Sentry issues mapped to its path, if available);
- the journey is the **only path** to an avatar's core job.

Lower one step when the module is scheduled for deletion or behind a disabled flag.
