---
name: discover-domain
description: Infer what this product is, who it serves and what they come to do from the code, grill you on the gaps, then write PRODUCT.md, avatars, journeys and a seed glossary.
disable-model-invocation: true
argument-hint: "[area or avatar to focus on]"
---

# Discover Domain

Reverse-engineer the product model from the evidence in the repo, then make it true by grilling the user. The code knows who logs in, what they can touch and what the screens say; only the user knows why. This skill turns both into `PRODUCT.md`, avatars, journeys and a first `GLOSSARY.md`, the files every other skill reads for domain context.

Read `docs/agents/product.md` and `docs/agents/domain.md` if they exist, for where these files live. If they don't, use the defaults (`PRODUCT.md`, `docs/product/`, `GLOSSARY.md`) and suggest `/setup-standards` at the end.

If the product model already exists, this skill sharpens it: start from the existing files, and treat evidence that contradicts them as the questions to ask.

## 1. Gather evidence

Spawn sub-agents in parallel, one per evidence family, each returning **hypotheses with file citations** and no prose. Facts only; they don't decide anything. Bound each to the most relevant 40 files or so.

| Sub-agent | Looks at | Returns |
|---|---|---|
| **Who** | Auth config, roles and permission guards, user and tenant tables, route groups and subdomains, sign-up and invite flows | Candidate user types: how each authenticates, what each can reach |
| **What** | Pages and routes, navigation, primary actions (forms, buttons), e2e test names, scheduled jobs | Candidate journeys per user type, with entry points |
| **Words** | Database schema and type names, UI copy, README, marketing site copy, docs, app store listings | Domain nouns (team-facing) and user-facing words, noting where they differ |
| **Why** | README, docs and plans, ADRs, policy docs (privacy, compliance, threat models), pricing pages, recent commit topics | Purpose, business model, constraints (regulatory, residency, platform), evident principles |

If the user named an area or avatar, focus every sub-agent there.

## 2. Present the hypotheses

Show the user, in one compact view:

- **The product** in two sentences, as you understand it.
- **Candidate avatars**: one line each, with the evidence (for example "staff console + `role=practitioner`").
- **Candidate journeys** per avatar, with `core` marked where breaking it would fail the avatar.
- **Words**: team terms vs user words, where they differ.
- **Constraints** you found, with sources.
- **Open questions**: what the evidence can't settle.

## 3. Grill

Call the Skill tool with "grilling" to walk the open questions as a design tree: purpose, then avatars, then journeys, then principles and non-goals. Rules for this session:

- Look facts up yourself; only decisions go to the user.
- Push for specific avatars (context, device, tech comfort, words, fears), not job titles. Merge avatars that share context and journeys.
- Ask for **non-goals** explicitly. Users rarely volunteer them, and product review leans on them most.
- When the user's answer contradicts the code, say so ("the code lets editors delete projects; you said only owners can").

## 4. Write the model

As decisions settle, write them down without batching:

- Call the Skill tool with "product-modeling" and write `PRODUCT.md`, `docs/product/avatars.md` and one `docs/product/journeys/<id>.md` per journey. Link existing e2e specs, feature docs and code globs you have verified. Leave `verified-at` unset.
- Call the Skill tool with "domain-modeling" and seed `GLOSSARY.md` with the team terms that were confirmed. Record user-facing words in `avatars.md`, not the glossary.
- When a constraint or a hard-to-reverse choice surfaces (a data-residency rule, say), offer an ADR, using domain-modeling's criteria.

## 5. Close with coverage

Show which journeys have no e2e test, no feature doc and no user doc. Offer to file them: call the Skill tool with "report-findings" (interactive mode) with one finding per gap, using `audit: discover-domain` and rules `journey-without-e2e`, `journey-without-feature-doc` and `journey-without-user-doc`. Then suggest the next command, usually `/prune-docs` (when the agent doc carries domain knowledge that now has a proper home) or `/test-audit`.

Don't commit. Leave the files for the user to review.
