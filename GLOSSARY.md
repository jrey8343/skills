# Glossary

The words this collection uses about itself. Skills are project-agnostic, so nothing here describes a product or a domain: these are the terms a maintainer needs to read the skills consistently.

## Design session

A session that sharpens a plan or a model without writing code: a grilling round, a domain-modeling pass, a product-modeling discussion. Run from the main checkout it writes nothing there, leaving its model changes pending for a carrier; run inside a worktree, or ending in a docs-only PR, it writes them itself.

_Avoid_: "planning session" (a plan is one of several things a design session produces).

## Build session

A session that writes code, always in its own worktree, ending as a pushed branch with a PR. The counterpart to a design session, and where a carrier's model changes are usually applied.

## Model change

A resolved change to a project's domain or product model: a glossary term, an ADR, an avatar, a journey. Produced by a design session, applied in a worktree. It travels verbatim, never paraphrased, because the agent that applies it was not in the conversation that settled it.

_Avoid_: "doc change" (a feature doc or a help page is not a model change; it describes behaviour rather than defining a concept).

## Pending

Said of a model change that has been stated but not yet written to its file. A model change deferred from the main checkout stays pending until a worktree applies it.

## Carrier

The artifact that moves a pending model change from the design session to the worktree that applies it: a spec's `## Model changes` section, a ticket, the conversation itself, or a handoff document. A design session whose decisions have no work to follow has no carrier, and opens a docs-only PR instead.

## Docs-only PR

A pull request that changes documentation and nothing else, opened from a worktree when the model change or the document _is_ the deliverable. What `setup-standards`, `discover-domain`, a kept `research` file, and a grilling session that ends in an ADR all produce.

## Sweep

The pass that removes worktrees whose work has merged, proven by git or the forge. Owned by the `worktree` skill.
