---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities and house-style friction, present them as a visual HTML report, then grill through whichever one you pick.
disable-model-invocation: true
argument-hint: "[headless] [dry-run] [full] [area]"
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities**: refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

This command is _informed_ by the project's domain model and built on a shared design vocabulary:

- Call the Skill tool with "codebase-design" for the architecture vocabulary (**module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**) and its principles (the deletion test, "the interface is the test surface", "one adapter = hypothetical seam, two = real"). Use these terms exactly in every suggestion, and don't drift into "component," "service," "API," or "boundary."
- Call the Skill tool with "house-style" for the stance on where seams go: functional core behind a data-in, decision-out interface; imperative shell as thin adapters; vertical slices as tier-spanning modules; TigerStyle assertions, limits and short functions. It adds no nouns; it maps onto the codebase-design vocabulary.
- The domain language in `GLOSSARY.md` gives names to good seams; ADRs in `docs/adr/` record decisions this command should not re-litigate.

## Process

### 0. Mode and scope

Call the Skill tool with "report-findings" to resolve the mode (**headless** or **interactive**) and the scope. Read `docs/agents/audits.md` if it exists for `scope_ignore`, `subagents_max` and the severity threshold; if it doesn't, use the defaults and carry on (this command predates setup, so the dependency is soft).

An `area` in the arguments is the user naming a direction (step 1). `full` widens the scan to the whole codebase instead of recent hot spots.

### 1. Explore

**Scope before you scan: YAGNI.** Deepening a module pays off by making future changes to it easier, so put extra weight on the parts of the codebase that have recently changed. Decide *where* to look before you look:

- If the user named a direction (a module, a subsystem, a pain point), take it, and skip the inference below.
- Otherwise, walk back a good stretch of the commit history (`git log --oneline`) to find the codebase's hot spots, the files and areas that keep coming up, and let those paths pull your attention first. If the changes are scattered with no clear hot spot, widen the net. In an incremental headless run, start from the commits since the last audited SHA.

Read the project's domain glossary (`GLOSSARY.md`) and any ADRs in the area you're touching first.

Then spawn a sub-agent to walk the codebase. Don't follow rigid heuristics; explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow**, with an interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Then the house-style lenses, each a kind of candidate in the same vocabulary:

- **Impure core**: decision logic tangled with I/O, the clock or the environment, so the module's interface can't be exercised without adapters. The deepening pulls the decisions behind a data-in, decision-out interface and leaves a thin shell.
- **Horizontal smear**: one domain capability spread across `routes/`, `lib/`, `components/` and friends, so a change to it touches every layer. The deepening is a vertical slice: one tier-spanning module, named with a `GLOSSARY.md` term, with locality as the win.
- **Missing invariants**: rules the module relies on that live only in prose, comments or callers' heads, not asserted at its interface.
- **Unbounded operations**: loops, retries, fan-out, pagination, payloads or timeouts with no named bound, so the interface has no stated performance characteristics.
- **Over-long functions**: implementations past 70 lines, where the internal seams are hiding.

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" is the signal you want.

### 2. Present candidates as an HTML report

Write a self-contained HTML file to the OS temp directory so nothing lands in the repo. Resolve the temp dir from `$RUNNER_TEMP`, then `$TMPDIR`, falling back to `/tmp` (or `%TEMP%` on Windows), and write to `<tmpdir>/architecture-review-<timestamp>.html` so each run gets a fresh file. In interactive mode, open it for the user (`xdg-open <path>` on Linux, `open <path>` on macOS, `start <path>` on Windows) and tell them the absolute path. In headless mode, don't open it; CI uploads it as an artifact.

The report uses **Tailwind via CDN** for layout and styling, and **Mermaid via CDN** for diagrams where a graph/flow/sequence reliably communicates the structure. Mix Mermaid with hand-crafted CSS/SVG visuals: use Mermaid when relationships are graph-shaped (call graphs, dependencies, sequences), and hand-built divs/SVG when you want something more editorial (mass diagrams, cross-sections, collapse animations). Each candidate gets a **before/after visualisation**. Be visual.

For each candidate, render a card with:

- **Files**: which files/modules are involved
- **Problem**: why the current architecture is causing friction
- **Solution**: plain English description of what would change
- **Benefits**: explained in terms of locality and leverage, and how tests would improve
- **Before / After diagram**: side-by-side, custom-drawn, illustrating the shallowness and the deepening
- **Recommendation strength**: one of `Strong`, `Worth exploring`, `Speculative`, rendered as a badge

End the report with a **Top recommendation** section: which candidate you'd tackle first and why.

**Use GLOSSARY.md vocabulary for the domain, and the `/codebase-design` vocabulary for the architecture.** If `GLOSSARY.md` defines "Order," talk about "the Order intake module," not "the FooBarHandler," and not "the Order service."

**ADR conflicts**: if a candidate contradicts an existing ADR, only surface it when the friction is real enough to warrant revisiting the ADR. Mark it clearly in the card (e.g. a warning callout: _"contradicts ADR-0007, but worth reopening because…"_). Don't list every theoretical refactor an ADR forbids.

See [HTML-REPORT.md](HTML-REPORT.md) for the full HTML scaffold, diagram patterns, and styling guidance.

Do NOT propose interfaces yet.

**Headless:** convert every candidate into a finding, then call the Skill tool with "report-findings" to publish, and stop. No grilling, no questions.

| Field | Value |
|---|---|
| `rule` | `deepening-candidate`, `impure-core`, `horizontal-smear`, `missing-invariant`, `unbounded-operation` or `over-long-function` |
| `severity` | `Strong` → `medium`; `Worth exploring` and `Speculative` → `low` |
| `confidence` | `Strong` → `high`; `Worth exploring` → `medium`; `Speculative` → `low` |
| `locator` | The primary module as `path#symbol` |
| `evidence` | Problem plus the files involved |
| `recommendation` | Solution plus benefits, in glossary terms |
| `fix` | `judgement` |
| `source` | `internal` |

**Interactive:** after the file is written, ask the user: "Which of these would you like to explore?" Once a pick is made, offer to publish the rest as findings (call the Skill tool with "report-findings") so they aren't lost.

### 3. Grilling loop

Once the user picks a candidate, call the Skill tool with "grilling" to walk the decision tree with them: constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Side effects happen inline as decisions crystallize; call the Skill tool with "domain-modeling" to keep the domain model current as you go:

- **Naming a deepened module after a concept not in `GLOSSARY.md`?** Add the term to `GLOSSARY.md`. Create the file lazily if it doesn't exist.
- **Sharpening a fuzzy term during the conversation?** Update `GLOSSARY.md` right there.
- **User rejects the candidate with a load-bearing reason?** Offer an ADR, framed as: _"Want me to record this as an ADR so future architecture reviews don't re-suggest it?"_ Only offer when the reason would actually be needed by a future explorer to avoid re-suggesting the same thing; skip ephemeral reasons ("not worth it right now") and self-evident ones.
- **Want to explore alternative interfaces for the deepened module?** Call the Skill tool with "codebase-design" and use its design-it-twice parallel sub-agent pattern.
