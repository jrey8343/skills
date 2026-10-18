---
name: to-spec
description: "Turn the current conversation into a spec and publish it to the project issue tracker: no interview, just synthesis of what you've already discussed."
disable-model-invocation: true
---

This skill takes the current conversation context and codebase understanding and produces a spec. Do NOT interview the user; just synthesize what you already know.

The issue tracker and triage label vocabulary should have been provided to you. If not, tell the user to run `/setup-standards`.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the spec, and respect any ADRs in the area you're touching. Read the product model if it exists (`docs/agents/product.md` says where): `PRODUCT.md`, the avatars, and the journeys this work touches.

2. Sketch out the seams at which you're going to test the feature. Existing seams should be preferred to new ones. Use the highest seam possible. If new seams are needed, propose them at the highest point you can. The fewer seams across the codebase, the better - the ideal number is one.

Check with the user that these seams match their expectations.

3. Draft the spec using the template below.

4. Review the draft before publishing. Call the Skill tool with "product-review" on the draft spec, then call the Skill tool with "persona-review" on it (pre-build: a static walk of the described journeys, no live app). Put their verdicts and the changes they asked for in the spec's `## Product review` section. If product-review's verdict is "don't build" or "rethink", stop and put it to the user before publishing; publish only once they decide to go ahead, and record their reason in the section.

5. Publish the spec to the project issue tracker. Apply the `ready-for-agent` triage label - no need for additional triage.

<spec-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

Where the repo has avatars (`docs/product/avatars.md`), the actor is an avatar by name, and each story names the journey it serves by id, e.g. `(journey: check-balance)`. A story that serves no existing journey either proposes a new one or is a sign of scope creep; say which.

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts, not a working demo, just the important bits.

## Model changes

Every **pending** model change the conversation produced: a glossary term, an ADR, an avatar, a journey. The spec is their **carrier** — the worktree that implements it applies them, so they land in the same PR as the code that uses them. Omit the section when there are none, and each subsection when it is empty.

Each entry names the file it lands in, gives its full text, and quotes the text it replaces, so a merge conflict with a parallel spec resolves with both definitions in view. Verbatim, never paraphrased: the agent that applies it was not in the conversation that settled it.

<model-changes-example>

### Glossary terms

- **Encounter** → `GLOSSARY.md`. A single attended appointment, from check-in to discharge.
  Replaces: "Encounter: any visit record."

### ADRs

- `docs/adr/0007-encounters-not-visits.md` — <the full ADR body, in ADR-FORMAT.md's shape>

### Product model

- `docs/product/journeys/book-followup.md` — new journey, <the full file>

</model-changes-example>

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Product review

- **Product review verdict**: build / build-with-changes / rethink / don't-build, with the one-line reason and what to measure.
- **Persona review**: per avatar, the friction or confusion it predicts, and what the spec changed in response.
- **Decision** (only when the user overrode a negative verdict): who decided and why.

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>
