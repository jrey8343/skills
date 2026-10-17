# discover-domain

## What it does

Works out what a product is, who it serves and what they come to do, from the evidence in the code. Then it grills you until that picture is true, and writes it down as `PRODUCT.md`, avatars, journeys and a seed `GLOSSARY.md`.

It starts from the code rather than a blank page. Roles and guards say who logs in; routes, navigation and e2e test names say what they do; schema and UI copy say what things are called. Your job is to supply the why: purpose, principles, non-goals, and what each avatar fears or needs.

## When to reach for it

You invoke this by typing `/discover-domain`, optionally with an area or avatar to focus on. Reach for it in a repo with no product model, or when the product has shifted. To refine a single term or decision during design work, use [grill-with-docs](../engineering/grill-with-docs.md) instead.

## Prerequisites

Works best after [setup-standards](setup-standards.md), which records where product docs live. Without it, the defaults are used.

## The journey is the join key

Each journey gets a stable id and a file whose frontmatter links it to its e2e tests, feature docs, user docs and code. Test coverage, docs coverage and persona review then become simple set differences: which core journeys have no e2e test, which user-visible journeys have no help page.

## Common questions

**Avatars or personas?**
The same idea. Avatars here are specific people in specific contexts, with the words they actually use and the internal terms they should never see. User docs and UI copy are written in their words.

**What if the code and my answers disagree?**
The skill says so, quoting the code. Either the code is wrong (file it) or the model is (fix the answer).

## It's working if

- Product and persona reviews cite your principles and non-goals back at you.
- Specs name avatars and journey ids without being asked.

## Where it fits

A run-once adoption step after [setup-standards](setup-standards.md). It feeds [product-modeling](../engineering/product-modeling.md) and [domain-modeling](../engineering/domain-modeling.md), and its coverage gaps feed [test-audit](../audits/test-audit.md) and [docs-audit](../audits/docs-audit.md). See [which-skill](../productivity/which-skill.md).
