# Support-email Worker

Cloudflare Email Routing sends mail for the support address to a Worker's `email()` handler. The Worker turns the email into Sentry User Feedback, so support email is triaged alongside errors, and then forwards it to the human inbox unchanged.

> **Verify against current docs**: the Email Workers runtime API (`ForwardableEmailMessage`: `from`, `to`, `headers`, `raw`, `rawSize`, `forward`, `setReject`), whether `forward()` still works after `raw` has been read, the `@sentry/cloudflare` email-handler instrumentation and flushing, and `captureFeedback`'s signature. These were checked in October 2026.

## Design

- **The human inbox always gets the email.** Sentry is a copy for triage. If parsing or Sentry fails, the email is still forwarded.
- **The core decides; the shell acts.** Parsing the MIME is the shell's job (`postal-mime`, a justified dependency: MIME is a protocol you don't want to hand-roll). Deciding what becomes feedback is pure.
- **Bounded.** Raw size is checked before parsing; HTML input, text output and subject are capped.
- **Loop-safe.** Auto-replies, bounces and bulk mail are forwarded but never captured.
- **The content is untrusted.** It becomes feedback text that a triage agent will read. `/sentry-triage` treats it strictly as data, and nothing here interprets it.

## Core (pure)

```ts
// features/support-email/core/decide.ts
import { assert } from "../../../shared/assert";

export const rawBytesMax = 512 * 1024;
export const htmlCharsMax = 200_000;
export const messageCharsMax = 4_000;
export const subjectCharsMax = 200;

export type InboundEmail = {
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
  text: string | null;
  html: string | null;
  autoSubmitted: string | null; // Auto-Submitted header
  precedence: string | null; // Precedence header
};

export type SupportEmailDecision =
  | { kind: "capture"; feedback: { message: string; email: string; name?: string }; truncated: boolean }
  | { kind: "skip"; reason: "auto-reply" | "empty" };

export function isParseable(rawBytes: number): boolean {
  assert(Number.isInteger(rawBytes) && rawBytes >= 0, "raw size is a non-negative integer");
  return rawBytes <= rawBytesMax;
}

export function decideSupportEmail(email: InboundEmail): SupportEmailDecision {
  assert(email.fromAddress.includes("@"), "sender address was validated by the shell");

  const isAutoSubmitted = email.autoSubmitted !== null && email.autoSubmitted.toLowerCase() !== "no";
  const isBulk = ["bulk", "list", "junk", "auto_reply"].includes((email.precedence ?? "").toLowerCase());
  const isNoReply = /^(no-?reply|mailer-daemon|postmaster)@/i.test(email.fromAddress);
  if (isAutoSubmitted || isBulk || isNoReply) return { kind: "skip", reason: "auto-reply" };

  const body = (email.text?.trim() || htmlToText(email.html ?? "")).trim();
  if (body.length === 0) return { kind: "skip", reason: "empty" };

  const subject = (email.subject ?? "").trim().slice(0, subjectCharsMax);
  const combined = subject ? `${subject}\n\n${body}` : body;
  const truncated = combined.length > messageCharsMax;
  const message = truncated ? `${combined.slice(0, messageCharsMax - 12)}\n[truncated]` : combined;

  assert(message.length <= messageCharsMax, "feedback message is bounded");
  const name = email.fromName?.trim().slice(0, 100) || undefined;
  return { kind: "capture", feedback: { message, email: email.fromAddress, ...(name ? { name } : {}) }, truncated };
}

export function htmlToText(html: string): string {
  const bounded = html.slice(0, htmlCharsMax);
  return bounded
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}
```

## Shell

```ts
// features/support-email/shell/email-handler.ts
import PostalMime from "postal-mime";
import * as Sentry from "@sentry/cloudflare";
import { decideSupportEmail, isParseable } from "../core/decide";

export async function handleSupportEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  try {
    if (!isParseable(message.rawSize)) {
      Sentry.captureMessage("support email over size limit; forwarded without feedback", "warning");
      return;
    }
    const parsed = await PostalMime.parse(message.raw);
    const decision = decideSupportEmail({
      fromAddress: parsed.from?.address ?? message.from,
      fromName: parsed.from?.name ?? null,
      subject: parsed.subject ?? null,
      text: parsed.text ?? null,
      html: parsed.html ?? null,
      autoSubmitted: message.headers.get("auto-submitted"),
      precedence: message.headers.get("precedence"),
    });
    if (decision.kind === "capture") {
      Sentry.captureFeedback(decision.feedback, { captureContext: { tags: { source: "email", truncated: String(decision.truncated) } } });
    }
  } catch (error) {
    Sentry.captureException(error);
  } finally {
    await message.forward(env.SUPPORT_INBOX_ADDRESS); // must be a verified destination address
  }
}
```

Wire it into the Worker's exported handler (`email: (message, env, ctx) => handleSupportEmail(message, env)`), inside the `withSentry` wrapper so events are flushed. Check the SDK guide for whether email handlers are instrumented in the installed version; if not, call `ctx.waitUntil(Sentry.flush(2000))`.

Config: `SUPPORT_INBOX_ADDRESS` (config, not secret) and `SENTRY_DSN` (public). Point an Email Routing rule for the support address at this Worker (a wizard stage). The destination inbox must be verified in Email Routing first.

## Tests (core, unit)

```ts
import { describe, expect, test } from "vitest";
import { decideSupportEmail, htmlToText, isParseable, messageCharsMax, rawBytesMax } from "./decide";

const email = (overrides = {}) => ({
  fromAddress: "pat@example.com",
  fromName: "Pat",
  subject: "Can't reschedule",
  text: "The reschedule button does nothing.",
  html: null,
  autoSubmitted: null,
  precedence: null,
  ...overrides,
});

describe("decideSupportEmail", () => {
  test("captures a normal email with subject and body", () => {
    const decision = decideSupportEmail(email());
    expect(decision).toEqual({
      kind: "capture",
      feedback: { message: "Can't reschedule\n\nThe reschedule button does nothing.", email: "pat@example.com", name: "Pat" },
      truncated: false,
    });
  });

  test("skips auto-replies, bulk mail and no-reply senders", () => {
    expect(decideSupportEmail(email({ autoSubmitted: "auto-replied" })).kind).toBe("skip");
    expect(decideSupportEmail(email({ precedence: "bulk" })).kind).toBe("skip");
    expect(decideSupportEmail(email({ fromAddress: "no-reply@vendor.example" })).kind).toBe("skip");
    expect(decideSupportEmail(email({ autoSubmitted: "no" })).kind).toBe("capture");
  });

  test("falls back to HTML when there is no text part", () => {
    const decision = decideSupportEmail(email({ text: null, html: "<p>Hello<br>there</p><script>x()</script>" }));
    expect(decision.kind === "capture" && decision.feedback.message).toBe("Can't reschedule\n\nHello\nthere");
  });

  test("skips empty emails", () => {
    expect(decideSupportEmail(email({ text: "  ", html: "<div></div>" }))).toEqual({ kind: "skip", reason: "empty" });
  });

  test("truncates long bodies to the bound", () => {
    const decision = decideSupportEmail(email({ text: "x".repeat(messageCharsMax * 2) }));
    expect(decision.kind === "capture" && decision.truncated).toBe(true);
    expect(decision.kind === "capture" && decision.feedback.message.length).toBeLessThanOrEqual(messageCharsMax);
  });
});

test("size gate", () => {
  expect(isParseable(rawBytesMax)).toBe(true);
  expect(isParseable(rawBytesMax + 1)).toBe(false);
});

test("htmlToText decodes entities and drops tags", () => {
  expect(htmlToText("<b>a&amp;b</b>&nbsp;&lt;c&gt;")).toBe("a&b <c>");
});
```

An integration test at the handler seam (with `@cloudflare/vitest-pool-workers`, a constructed `ForwardableEmailMessage` stand-in, and Sentry's transport mocked) should assert two things: `forward` is called on every path, including when parsing throws, and feedback is captured only for the capture decision.
