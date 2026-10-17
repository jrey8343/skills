# improve-codebase-architecture

## What it does

`improve-codebase-architecture` surveys a codebase for **deepening opportunities**: places where a shallow module (an interface nearly as complex as the thing it hides) could become a deep one. It also applies the house-style lenses: decision logic tangled with I/O (**impure core**), one capability smeared across layers that wants to be a vertical slice (**horizontal smear**), rules nobody asserts (**missing invariants**), loops and fan-out with no stated bound (**unbounded operations**), and functions hiding their seams past 70 lines. It writes the candidates up as a self-contained HTML report, then grills you through the one you pick.

It never changes the code. An interactive run produces a conversation and one HTML file in your temp directory; you do the refactor later, through the normal build flow. In a scheduled CI run it skips the grilling entirely and files the candidates as deduplicated GitHub issues instead.

Two filters stop the report from becoming generic cleanup advice. Every candidate must pass the **deletion test** (would removing this module concentrate its complexity behind a smaller interface, or spread it across callers?). And unless you point it at an area, it reads recent commit history first and focuses on paths that change often, because a deepening in code nobody touches never pays back.

## When to reach for it

You invoke this by typing `/improve-codebase-architecture`, optionally with an area; the agent won't reach for it on its own. CI runs it monthly as `/jrey-skills:improve-codebase-architecture headless`.

| Situation | How it is used |
| --- | --- |
| Routine upkeep | Run it every few weeks so the structure doesn't decay between features. |
| Before a big build | Point it at the spec and ask "how can we make this change easy?" The most effective prompt for it. |
| Brownfield audit | Run it on a large layered or unstructured repo to find where slices and pure cores want to be. |
| Legacy test work | Find the missing seams before writing tests against untestable code. |

Where it is confusable with siblings:

- To design one module you have already chosen, use [codebase-design](../engineering/codebase-design.md). This skill finds the module; that one designs it.
- To check one diff against the house rules, use [review-changes](../engineering/review-changes.md).
- For "this specific thing is broken," use [diagnosing-bugs](../engineering/diagnosing-bugs.md).

## Prerequisites

None to run it interactively. If `GLOSSARY.md` and ADRs exist, it uses your domain's nouns ("deepen the Booking cancellation module", not "refactor the FooHandler") and won't re-litigate recorded decisions. If `docs/agents/audits.md` exists (written by [setup-standards](../setup/setup-standards.md)), it respects the scope settings there.

It writes the report to your temp directory (or `$RUNNER_TEMP` in CI). During the grilling loop it adds or sharpens terms in `GLOSSARY.md` and offers ADRs for rejected candidates. Headless runs need the issue tracker configured, because findings go through [report-findings](report-findings.md).

## Depth, and the lenses that hunt for it

The skill rests on one idea: **depth**. A deep module puts a lot of behaviour behind a small, stable interface. The house style says where those interfaces should sit: a functional core with a data-in, decision-out interface, an imperative shell of thin adapters, and vertical slices as tier-spanning modules. Every lens is a way that ideal breaks down, named in the same vocabulary, so candidates read as "the Booking module is shallow: its interface needs the database", not as style nitpicks.

| Badge | What it means for you |
| --- | --- |
| `Strong` | The deletion test passes clearly and the friction is real. Filed as `medium` in headless runs. |
| `Worth exploring` | Plausible, but the payoff depends on where the code goes next. Filed as `low`. |
| `Speculative` | Included for completeness. Mostly ignorable. |

## Common questions

**It grilled me for ages about one idea instead of showing options.**

Say so when you invoke it ("just show the report"). The intent is report first, grilling only on the candidate you choose. If you want no grilling at all, run it with `headless dry-run`: you get the report and the findings it would file, with no questions.

**It gave me twelve candidates. One session or several?**

One candidate per session. Pick one, grill it, take the decision into [to-spec](../engineering/to-spec.md). In interactive mode it offers to file the rest as issues so they aren't lost.

**The report opened as unstyled HTML with no diagrams.**

It loads Tailwind and Mermaid from CDNs, so it needs network access when you open it. Offline or under strict script policies, ask for inline CSS and hand-built SVG instead.

**Will it ever say the codebase is fine?**

Rarely; it exists to produce candidates. Use the badges to correct for that. A report of nothing but `Speculative` cards means it found nothing.

**Does it rewrite my layered codebase into slices?**

No. It proposes one deepening at a time, and the house style is explicit about incremental adoption: new work lands as slices, and existing code moves when a change already touches it.

## It's working if

- Candidates use your domain's nouns, and sit in files you changed recently.
- Each card explains the payoff as locality or leverage and says which tests get simpler.
- No code changed during the run.
- Interactive runs stop after the report and ask which candidate to explore.
- Scheduled runs file a handful of issues per month, and a rerun doesn't duplicate them.

## Where it fits

**Periodic audit**, outside the build chain: it queues up work rather than doing it. Its neighbours are [codebase-design](../engineering/codebase-design.md) (the vocabulary), [house-style](../engineering/house-style.md) (the stance on seams), [grilling](../productivity/grilling.md) (the decision tree after you pick) and [domain-modeling](../engineering/domain-modeling.md) (glossary and ADRs). A chosen candidate re-enters the main flow at [grill-with-docs](../engineering/grill-with-docs.md) or [to-spec](../engineering/to-spec.md). For the whole map, see [which-skill](../productivity/which-skill.md).
