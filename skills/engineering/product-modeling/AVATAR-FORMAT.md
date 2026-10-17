# Avatar format

All avatars live in one file, `docs/product/avatars.md`, one `##` section each. Most products have three to six avatars; more than eight usually means some should merge.

```markdown
# Avatars

The people this product serves. Persona review walks journeys as these people; user docs are written in their words.

## {Name}: {role in a few words}

{Two or three sentences in the third person: who they are, where they are when they use the product, what they care about.}

- **Context**: {device; setting; time pressure; how often they use it; who else is around}
- **Tech comfort**: {low / medium / high, with one concrete example}
- **Jobs to be done**:
  - When {situation}, they want to {motivation}, so they can {outcome}.
- **Core journeys**: `{journey-id}`, `{journey-id}`
- **Other journeys**: `{journey-id}`
- **Their words**: {terms they actually use} (for example, "my bookings", "my stylist")
- **Never show them**: {internal terms that would confuse them}. Use {their word} instead.
- **Frustrations and fears**: {what makes them abandon or distrust the product}
- **Accessibility**: {vision, motor, cognitive or situational needs; language; literacy}
- **Trust**: {what they need to see before they rely on it}
- **Success looks like**: {observable outcome, ideally tied to a PRODUCT.md metric}
```

## Rules

- **Grounded in evidence.** Each avatar should trace to something real: a role in the auth model, a route group, interviews, support emails, analytics. Note the source in a comment if it is not obvious.
- **Specific beats representative.** "Sam, 52, a salon owner who works the floor all day and does admin at 9 pm on their phone" drives better decisions than "business owner".
- **One avatar per distinct context, not per job title.** Two roles with the same context, words and journeys are one avatar.
- **Their words are mandatory.** It is the field persona review and user docs lean on most.
- Avatars are not a team directory. Internal staff (support, the platform owner) are avatars only if the product has journeys built for them.
