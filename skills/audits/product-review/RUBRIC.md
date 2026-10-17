# Product review rubric

Answer each question with evidence. "Probably fine" is not an answer: quote a principle, name an avatar job, count the screens.

## Job

- Which avatar does this serve? Name them from `avatars.md`.
- Which of their jobs to be done does it advance? Quote it.
- How often does that avatar hit this situation? (Every session, weekly, once.)
- What do they do today without it? A workaround that works well weakens the case.
- **Red flag**: no avatar job fits. "Users might want…" with no named avatar is a feature looking for a user.

## Cost

Count, don't estimate:

| Cost | Count |
|---|---|
| New concepts the avatar must learn | |
| New settings or toggles | |
| New screens, tabs, modals | |
| New states (empty, error, pending, partial) the UI must handle | |
| New copy (labels, help text, emails, notifications) | |
| New support burden (questions it will generate) | |

- Who pays the cost? Every avatar who sees the UI, not just the ones who use the feature.
- Does it add a choice where a good default would do?
- **Red flag**: a setting added to avoid deciding.

## Fit

- Does it follow the patterns the product already uses for similar things (navigation, naming, interaction)?
- Can the avatar who needs it find it at the moment they need it, without being told?
- Does it use the avatar's words ("Their words" in `avatars.md`) or internal jargon?

## Conflict

- Does it break a principle in `PRODUCT.md`? Quote the principle.
- Does it drift toward a non-goal? Quote the non-goal.
- Does it strain a constraint (regulatory, residency, platform, business model)? Link it.
- **Red flag**: any direct conflict. Conflicts are resolved by changing the feature or, deliberately, the principle (with an ADR), never by ignoring them.

## Overlap

- Which existing features or journeys does it duplicate, partially or wholly?
- Does it split users between two ways of doing the same job?
- Would extending an existing feature serve the job with less cost?

## Proof

- **Metric**: which `PRODUCT.md` success metric should move, and in which direction? If none applies, what new measure would show it working?
- **Kill criteria**: the observable result, by a stated time, that means remove it.
- **Smallest test**: the cheapest version that tests the bet (a manual process, a single avatar, a flag, a copy change).

## Scoring guidance

| Situation | Leans toward |
|---|---|
| Real, frequent job; low cost; no conflict | build |
| Real job; cost cut by removing named parts | build-with-changes |
| Real job; shape conflicts or costs too much; a smaller test exists | rethink |
| No avatar job, or a direct principle or non-goal conflict | don't-build |
| No PRODUCT.md or avatars | any verdict, all with `confidence: low` |

Post-ship reviews also weigh evidence of use: error rates, feedback, support questions, whether the journey's metric moved. A shipped feature with no use and ongoing cost is a removal candidate; say so.

## Verdict block

```markdown
### Product review: {target}

**Verdict**: {build | build-with-changes | rethink | don't-build} (confidence: {high | medium | low})

- **Serves**: {avatar}: "{job}" ({frequency})
- **Costs**: {counts from the cost table, one line}
- **Conflicts**: {quoted principle or non-goal, or "none"}
- **Overlaps**: {feature or journey, or "none"}
- **Measure**: {metric and direction}. **Kill if**: {criterion by when}.
- **Smallest test**: {cheapest version}

**Why**: {the two or three reasons that decided the verdict}
**Changes** (build-with-changes or rethink only): {numbered list of cuts or reshapes}
```
