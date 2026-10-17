# User doc format

User docs are for avatars, not engineers. They usually live on the product's marketing site (for example `/help`), often in a different repo from the product. Read `docs/agents/docs-targets.md` for this project's:

- **repo** and **local path** of the docs site;
- **content path and format** (for example an Astro content collection of MDX files);
- **frontmatter schema** the site expects;
- **URL base** (for example `https://example.com/help/`);
- **PR flow** (branch naming, who reviews).

If `docs-targets.md` is missing, tell the user to run `/setup-standards`.

## Page shape

One task per page, named as the avatar would search for it.

```mdx
---
title: Book a follow-up appointment
description: Get your next appointment booked from the app, without phoning the shop.
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

Map the frontmatter keys to the site's schema. The `journey` and `audience` values are the stable ids from `docs/product/`; keep them even if the site doesn't render them, because docs-audit uses them to join pages to journeys.

## Rules

- **Their words, not ours.** Use the avatar's "Their words" and avoid their "Never show them" list from `avatars.md`. "Your exercises", not "program phase entitlements".
- **UI labels verbatim.** Match the current button and field labels exactly. When the UI copy changes, the doc changes in the same piece of work.
- **Short.** A page that needs more than about seven steps is probably two tasks.
- **No internals.** No architecture, no roles-and-permissions jargon, no mention of vendors unless the user must interact with them.
- **Screenshots are optional and expensive.** They go stale with every UI change. Prefer exact labels, and use a screenshot only where layout is the hard part.
- **Sensitive domains.** For health, finance or legal products, never give advice the product itself does not give, and point to the human professional where the product does.
