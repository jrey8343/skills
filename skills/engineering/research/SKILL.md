---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Spin up a **background agent** to do the research, so you keep working while it reads.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it to the session's scratchpad directory, outside the repo, and report its full path. The notes are readable from there, and the checkout the user is sitting in stays clean.

Once it reports, offer to land the notes in the repo: call the Skill tool with "worktree", write the file where the repo already keeps such notes (match the existing convention; with none, put it somewhere sensible and say where), and finish it as a docs-only PR. Only notes worth keeping become a branch. In a linked worktree already, write it straight into the repo — that branch carries it.
