# User doc format

User docs are for avatars, not engineers. They usually live on the product's marketing site (for example `/help`), often in a different repo from the product. Read `docs/agents/docs-targets.md` for this project's:

- **repo** and **local checkout** of the docs site;
- **content path and format** (for example a content collection of MDX files);
- **frontmatter mapping** to the schema the site expects;
- **URL base** (for example `https://example.com/help/`);
- **change flow** (branch naming, who reviews, how to reference the product issue).

If `docs-targets.md` is missing, seed it as SKILL.md's Locations section says (interactive only; a headless caller skips and says so). If its user-docs section says "None yet", there is no target: say so and leave the page unwritten.

## Page shape

One task per page, named as the avatar would search for it.

```mdx
---
title: Book a follow-up appointment
description: Get your next appointment booked from the app, without phoning in.
audience: [returning-customer]
journey: book-follow-up
updated: 2026-10-17
---

{One sentence: what you'll be able to do after this page.}

## Before you start

- {Only what they genuinely need: an account, an invite link, the app installed.}

## Steps

1. {Imperative, one action per step, naming the button or label exactly as it appears in the UI.}
2. ...

## If something goes wrong

- **{What they see}**: {what it means and what to do}.

## Related

- [{Other task}]({url})
```

Map the frontmatter keys to the site's schema. The `journey` and `audience` values are the stable ids from the product model (journeys and avatars); keep them even if the site doesn't render them, because docs-audit uses them to join pages to journeys.

## Rules

- **Their words, not ours.** Use the avatar's "Their words" and avoid their "Never show them" list from the avatars file. "Your exercises", not "program phase entitlements".
- **UI labels verbatim.** Match the current button and field labels exactly. When the UI copy changes, the doc changes in the same piece of work.
- **Short.** A page that needs more than about seven steps is probably two tasks.
- **No internals.** No architecture, no roles-and-permissions jargon, no mention of vendors unless the user must interact with them.
- **Screenshots are optional and expensive.** They go stale with every UI change. Prefer exact labels, and use a screenshot only where layout is the hard part.
- **Sensitive domains.** For health, finance or legal products, never give advice the product itself does not give, and point to the human professional where the product does.
