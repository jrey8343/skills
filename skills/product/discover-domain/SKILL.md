---
name: discover-domain
description: Infer what this product is, who it serves and what they come to do from the code, grill you on the gaps, then write PRODUCT.md, avatars, journeys and a seed glossary.
disable-model-invocation: true
argument-hint: "[area or avatar to focus on]"
---

# Discover Domain

Reverse-engineer the product model from the evidence in the repo, then make it true by grilling the user. The code knows who logs in, what they can touch and what the screens say; only the user knows why. This skill turns both into `PRODUCT.md`, avatars, journeys and a seed glossary (`GLOSSARY.md` by default), the files every other skill reads for domain context.

It builds the model; it doesn't own the formats. `product-modeling` owns the product, avatar and journey formats and where they live; `domain-modeling` owns the glossary and ADRs. This skill writes through both.

## 0. Find where things live

- Read `docs/agents/product.md` for where `PRODUCT.md`, the avatars file and the journeys directory live. If it is missing, product-modeling seeds it at the first write (step 4); until then assume its defaults (`PRODUCT.md`, `docs/product/avatars.md`, `docs/product/journeys/<id>.md`).
- Read `docs/agents/domain.md` for where the glossary and ADRs live. If it is missing, assume `GLOSSARY.md` and `docs/adr/` at the repo root, and at the end tell the user to run `/setup-matt-pocock-skills` to record the layout. ADRs follow `docs/agents/domain.md`, which domain-modeling reads; any ADR entry in `docs/agents/docs-targets.md` is ignored here.
- Read `docs/agents/docs-targets.md` for where feature docs and user docs live; steps 4 and 5 look for docs there. If it is missing, assume feature docs at `docs/features/<feature>.md` and no user docs site, and say so in the summary.

If the product model already exists, this skill sharpens it: start from the existing files, and treat evidence that contradicts them as the questions to ask.

## 1. Gather evidence

Spawn sub-agents in parallel, one per evidence family, each returning **hypotheses with file citations** and no prose. Facts only; they don't decide anything. Bound each to the most relevant 40 files or so.

| Sub-agent | Looks at | Returns |
|---|---|---|
| **Who** | Auth config, roles and permission guards, user and tenant tables, route groups and subdomains, sign-up and invite flows | Candidate user types: how each authenticates, what each can reach |
| **What** | Pages and routes, navigation, primary actions (forms, buttons), e2e test names, scheduled jobs | Candidate journeys per user type, with entry points |
| **Words** | Database schema and type names, UI copy, README, marketing site copy, docs, app store listings | Domain nouns (team-facing) and user-facing words, noting where they differ |
| **Why** | README, docs and plans, ADRs, policy docs (privacy, compliance, threat models), pricing pages, recent commit topics | Purpose, business model, constraints (regulatory, residency, platform), evident principles |

If the user named an area or avatar, focus every sub-agent there. A repo with no docs at all still has auth, routes, schema and copy; say which families came back thin.

## 2. Present the hypotheses

Show the user, in one compact view:

- **The product** in two sentences, as you understand it.
- **Candidate avatars**: one line each, with the evidence (for example "staff console + `role=practitioner`").
- **Candidate journeys** per avatar, with `core` marked where breaking it would fail the avatar.
- **Words**: team terms vs user words, where they differ.
- **Constraints** you found, with sources.
- **Open questions**: what the evidence can't settle.

## 3. Grill

Call the Skill tool with `grilling` to walk the open questions as a design tree: purpose, then avatars, then journeys, then principles and non-goals. Rules for this session:

- Look facts up yourself; only decisions go to the user.
- Push for specific avatars (context, device, tech comfort, words, fears), not job titles. Merge avatars that share context and journeys.
- Test each candidate journey against product-modeling's journey grain; screens and endpoints are steps, not journeys.
- Ask for **non-goals** explicitly. Users rarely volunteer them, and product review leans on them most.
- When the user's answer contradicts the code, say so ("the code lets editors delete projects; you said only owners can").

## 4. Write the model

Write in the checkout you are in, as decisions settle, without batching:

- Call the Skill tool with `product-modeling`, and write `PRODUCT.md`, the avatars file and one journey file per journey in its formats, at the locations `docs/agents/product.md` names (product-modeling seeds that file when it is missing). Link existing e2e specs, feature docs and code globs you have verified. Leave `verified-at` unset.
- Call the Skill tool with `domain-modeling`, and **seed** the glossary with the team terms that were confirmed, in its format and at the place `docs/agents/domain.md` names. Record user-facing words in the avatars file, not the glossary. Seeding is this skill's job; challenging terms later, and every ADR, is domain-modeling's.
- When a constraint or a hard-to-reverse choice surfaces (a data-residency rule, say), offer an ADR and let domain-modeling write it, by its own criteria.

## 5. Close with coverage

Show a gap table, one row per journey, using the locations from step 0:

- **No e2e test**: only for `core: true` journeys (product-modeling requires e2e for core journeys only).
- **No feature doc**: any journey whose `features` links are empty or resolve to nothing.
- **No user doc**: only for user-visible journeys, meaning at least one avatar is not internal staff.

Don't file these yourself. `test-audit` owns `journey-without-e2e` and `docs-audit` owns the doc rules; their fingerprints are what dedupe and suppression key on, so a copy filed from here would come back as a duplicate. Tell the user to run `/test-audit` and `/docs-audit` to file the gaps. If `docs/agents/audits.md` is missing, say they need `/schedule-audits` first, and if `docs/agents/issue-tracker.md` is missing, `/setup-matt-pocock-skills` too.

Then list every file written and suggest the user reads the whole model as one diff and commits it when it reads true; don't commit or open a pull request yourself. Suggest the next command: usually `/test-audit` and `/docs-audit` for the gaps, or `/prune-docs` when the agent doc carries domain knowledge that now has a proper home.
