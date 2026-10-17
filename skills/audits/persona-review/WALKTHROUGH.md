# Walkthrough

How to walk a journey as an avatar, statically, and how to write the friction log. The live pass (LIVE.md) follows the same script with a browser.

## Before the walk

Write a four-line brief and keep it in view for the whole walk:

```
I am {avatar name}. I am {context: where, device, time pressure}.
I came here to {job, in their words}.
I know {what they already know}; I don't know {what they don't}.
I give up when {their frustration trigger}.
```

Then list the journey's steps from its file. If the journey file has no steps, derive them from its title and the code, and note `persona-journey-drift`.

## Tracing a step through the code

For each step:

1. **Find the entry point.** The route or page the avatar lands on (from the journey's `code` globs, the router, or links from the previous step).
2. **Read what renders.** Components, their copy (including i18n strings), their states: loading, empty, error, success. Read the copy exactly as the avatar would see it.
3. **Find the next action.** The button, link or gesture that moves them on. Is it visible without scrolling on their device? Is its label in their words?
4. **Follow the action.** The handler, the request, the response, and what the UI does with each outcome, failure included.
5. **Check the exits.** Can they go back? What happens if they leave halfway and return?

Stay in character. The avatar doesn't read code: what matters is only what reaches the screen, the notification or the email.

## What counts as friction

| Kind | Example in the avatar's voice |
|---|---|
| Hesitation | "Which of these two buttons do I want?" |
| Misread | "'Archive' sounds like it deletes it." |
| Jargon | "What's an 'entitlement'?" |
| Dead end | "It says 'Something went wrong' and there's no button." |
| Hidden step | "I had to know to swipe left." |
| Trust gap | "Will this charge me now?" |
| Access barrier | "The text is tiny and I can't zoom." |
| Pointless | "I could just phone them; it's quicker." |

## Friction log format

```markdown
### {Journey title} (`{journey-id}`) as {Avatar}

**Verdict**: {would use it | reluctantly | would not use it}. Instead they would: {alternative}.

| Step | What they see | Friction (in their voice) | Kind | Severity |
|---|---|---|---|---|
| 2 | "Select entitlement tier" dropdown | "I don't know what tier I am." | jargon | medium |
| 4 | Spinner, then blank screen on a slow connection | "Did it work? Should I tap again?" | no recovery | high |

**What worked**: {steps that were smooth; keep these}
```

## Severity guide

- **high**: the avatar abandons, makes a costly mistake, or a core journey fails.
- **medium**: they get through, but slowly, unsure, or by guessing.
- **low**: a rough edge they would notice but shrug off.
