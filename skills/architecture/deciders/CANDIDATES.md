# Candidate Deciders

A candidate Decider is a consistency boundary someone has named but nobody has coded yet. Whatever its source, fill this shape before writing types:

| Field | What it holds |
|---|---|
| **Name** | A glossary term for the boundary (one instance of it is one event stream). |
| **Stream key** | What identifies one instance: a task id, an account id, a pair of ids. |
| **Commands** | Imperative requests it accepts, each with the actor who sends it. |
| **Events** | The past-tense facts it records. Every command maps to one or more of these, or to a rejection. |
| **Invariants** | The rules that must hold atomically inside this boundary. Each becomes a `decide` branch and a test. |
| **Policies out** | "Whenever *event*, then *command* on another boundary." These stay in the shell. |
| **Open questions** | Hot spots nobody has settled. Each blocks the branch it touches. |

## From an event storm

An `event-storming` session hands over candidates in this shape, in its storm doc. Look for that doc where `CODING_STANDARDS.md` or `docs/agents/docs-targets.md` puts storm docs, otherwise under `docs/storms/`. Read its **Candidate Deciders** section, including any per-context doc it links from **Bounded contexts**. Take them as given, with three checks before coding:

1. **Every invariant has an owner.** A rule written against two candidates is either a policy (eventually consistent) or a sign the two are one boundary. Ask which.
2. **Every command reaches an event or a rejection.** A command with no outcome on the board is a missing event.
3. **Open questions stay open.** Do not code a guess for a hot spot. Ask the user, or leave that command out and say so.

## Without a storm

No storm doc is needed. Derive the candidate from the spec, issue or conversation:

1. List the things the user or another system asks for. Those are commands.
2. For each, ask "what is true afterwards?" in the past tense. Those are events.
3. For each command, ask "when must this be refused?" Those are invariants. If the only answer is "never", the boundary may not need a Decider.
4. Group commands that share an invariant. Each group is one candidate; its stream key is what the invariant is about.
5. Write the filled table into the conversation and confirm it with the user before writing the types (SKILL.md workflow step 3). For a boundary that is new or contested, suggest the user runs `/event-storming` first.
