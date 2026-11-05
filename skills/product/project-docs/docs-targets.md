# Docs Targets

Where each kind of doc for this product lives, and how to change it. Seeded by `project-docs`; read by `project-docs`, `docs-audit` and `prune-docs`. Edit the paths to match this repo; skills take them from here.

## Feature docs (internal)

- **Path**: `docs/features/<feature>.md` in this repo. {Or a pattern per bounded context, e.g. `src/<context>/docs/<feature>.md`, and list the contexts.}
- **ADRs**: `docs/adr/NNNN-<slug>.md` in this repo. {Mirrors `docs/agents/domain.md`, which decides the ADR location. If they differ, `domain.md` wins and project-docs reports the mismatch.}
- **Runbooks**: `docs/runbooks/` in this repo.

## User docs (public)

- **Site**: {e.g. https://example.com/help/}
- **Repo**: {e.g. github.com/owner/marketing}
- **Local checkout**: {e.g. ../marketing (relative to this repo)}
- **Content path**: {e.g. src/content/help/}
- **Format**: {e.g. MDX in a content collection; schema defined in the site's content config}
- **Frontmatter mapping**: {map the user-doc keys to the site's schema, e.g. `audience` -> `audience`, `journey` -> `journey`, `updated` -> `updatedDate`}
- **Navigation**: {how a new page appears in navigation, e.g. "sidebar is generated from the collection, ordered by `order`"}
- **Preview / check**: {e.g. the build command in the docs repo}
- **Change flow**: {e.g. branch `docs/<journey-id>` in the docs repo, referencing the product issue as `owner/repo#N`}

{If there is no public docs site yet: write "None yet", and docs-audit will file the gap once.}

## In-product help

- {e.g. "In-app help pages link to the public help pages; they don't duplicate them", or "None"}
