# discover-domain

## What it does

Works out what a product is, who it serves and what they come to do, from the evidence in the code. Then it grills you until that picture is true, and writes it down as `PRODUCT.md`, avatars, journeys and a seed glossary.

It starts from the code rather than a blank page. Roles and guards say who logs in; routes, navigation and e2e test names say what they do; schema and UI copy say what things are called. Your job is to supply the why: purpose, principles, non-goals, and what each avatar fears or needs. It owns no formats of its own: it writes the model in [product-modeling](product-modeling.md)'s formats and the glossary in Matt's `domain-modeling` format.

## When to reach for it

You type `/discover-domain`, optionally with an area or avatar to focus on. Reach for it in a repo with no product model, or when the product has shifted far enough that the model needs rebuilding from the code. To refine one avatar or journey during a design conversation, the agent reaches for [product-modeling](product-modeling.md) on its own; to sharpen a team term or record an ADR, Matt's `domain-modeling` or `grill-with-docs`. This skill reverse-engineers the model; those sharpen it.

## Prerequisites

None strictly. It reads `docs/agents/product.md`, `docs/agents/domain.md` and `docs/agents/docs-targets.md` for where things live, and uses the defaults when they are missing. product-modeling seeds `docs/agents/product.md` on the first write; for `docs/agents/domain.md`, it tells you to run Matt's `/setup-matt-pocock-skills`.

It writes, in the target repo: `PRODUCT.md`, the avatars file, one file per journey, the glossary, and any ADRs you agree to. All in the checkout you ran it from, uncommitted, for you to review.

## The journey is the join key

Each journey gets a stable id and a file whose frontmatter links it to its e2e tests, feature docs, user docs and code. Test coverage, docs coverage and persona review then become simple set differences: which core journeys have no e2e test, which user-visible journeys have no help page. The session ends by showing those gaps and pointing you to `/test-audit` and `/docs-audit`, which own those rules and file them as issues.

## Common questions

**Avatars or personas?**
The same idea. Avatars here are specific people in specific contexts, with the words they actually use and the internal terms they should never see. User docs and UI copy are written in their words.

**What if the code and my answers disagree?**
The skill says so, quoting the code. Either the code is wrong (file it) or the model is (fix the answer).

**Does it commit or open a PR?**
No. It lists the files it wrote; you read the model as one diff and commit it when it reads true.

## It's working if

- The repo ends the session with `PRODUCT.md`, an avatars file, journey files and a glossary, even if it started with none.
- Every avatar and journey traces to a file in the code, or to an answer you gave.
- Product and persona reviews later cite your principles and non-goals back at you.
- Specs name avatars and journey ids without being asked.

## Where it fits

A run-once adoption step, repeated when the product shifts. It drives [product-modeling](product-modeling.md) and Matt's `domain-modeling`; its coverage gaps are filed and tracked by [test-audit](../quality/test-audit.md) and [docs-audit](../quality/docs-audit.md); [prune-docs](../quality/prune-docs.md) can then move domain knowledge out of the agent doc into the model. [product-review](product-review.md) and [persona-review](persona-review.md) judge against what it writes.
