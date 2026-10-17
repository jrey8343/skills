# Docs Targets

Where each kind of doc for this product lives, and how to change it. Read by `project-docs`, `docs-audit`, `prune-docs`, `implement` and `implement-spec`.

## Feature docs (internal)

- **Path**: `docs/features/<feature>.md` in this repo.
- **ADRs**: `docs/adr/NNNN-<slug>.md` in this repo.
- **Runbooks**: `docs/runbooks/` in this repo.

## User docs (public)

- **Site**: {e.g. https://example.com/help/}
- **Repo**: {e.g. github.com/owner/marketing}
- **Local checkout**: {e.g. ../marketing (relative to this repo)}
- **Content path**: {e.g. src/content/help/}
- **Format**: {e.g. MDX in an Astro content collection; schema defined in src/content.config.ts}
- **Frontmatter mapping**: {map USER-DOC-FORMAT keys to the site's schema, e.g. `audience` -> `audience`, `journey` -> `journey`, `updated` -> `updatedDate`}
- **Navigation**: {how a new page appears in navigation, e.g. "sidebar is generated from the collection, ordered by `order`"}
- **Preview / check**: {e.g. `pnpm build` in the marketing repo}
- **PR flow**: {e.g. branch `docs/<journey-id>` in the marketing repo, PR referencing the product issue as `owner/repo#N`}

{If there is no public docs site yet: write "None yet", and docs-audit will file the gap once.}

## In-product help

- {e.g. "/admin/help pages link to the public help pages; they don't duplicate them", or "None"}
