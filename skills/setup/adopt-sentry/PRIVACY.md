# Privacy defaults

Treat every event as if it could be read by someone outside the company, because it can: Sentry is a third party. Scrub at the source, then scrub again server-side.

## SDK options (every runtime)

| Option | Value | Why |
|---|---|---|
| `sendDefaultPii` | `false` | No IPs, cookies or user headers attached automatically |
| `beforeSend` | `scrubEvent` (below) | Strip what slips through |
| `beforeBreadcrumb` | drop or redact URL query strings, and console breadcrumbs that log payloads | Breadcrumbs leak more than errors do |
| `tracePropagationTargets` | own API origins only | Don't send trace headers to third parties |
| `ignoreErrors` / `denyUrls` | browser-extension noise | Less noise, less data |
| `initialScope.user` | `{ id: <opaque id> }` only | Never email, name or phone |

## A scrubber shape

```ts
const redactedKeysPattern = /pass(word)?|secret|token|authorization|cookie|session|api[-_]?key|email|phone|dob|address/i;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const bearerPattern = /bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const scrubDepthMax = 8;

export function scrubEvent<T extends { request?: { url?: string; query_string?: unknown; data?: unknown; cookies?: unknown; headers?: Record<string, string> }; extra?: Record<string, unknown> }>(event: T): T {
  if (event.request) {
    event.request.url = event.request.url?.split("?")[0];
    delete event.request.query_string;
    delete event.request.data;
    delete event.request.cookies;
    event.request.headers = pick(event.request.headers, ["user-agent", "content-type", "accept"]);
  }
  if (event.extra) event.extra = scrubValue(event.extra, 0) as Record<string, unknown>;
  return event;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (depth >= scrubDepthMax) return "[depth limit]";
  if (typeof value === "string") return value.replace(emailPattern, "[email]").replace(bearerPattern, "[token]");
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, redactedKeysPattern.test(key) ? "[redacted]" : scrubValue(inner, depth + 1)]),
    );
  }
  return value;
}

function pick(headers: Record<string, string> | undefined, allowed: string[]) {
  if (!headers) return undefined;
  return Object.fromEntries(Object.entries(headers).filter(([key]) => allowed.includes(key.toLowerCase())));
}
```

Adapt the key list to the domain. Put it in the shell's shared kernel and unit-test it with realistic payloads, including a nested one past the depth limit.

## Session Replay

- Default: **off**.
- If enabled: `maskAllText: true`, `blockAllMedia: true`, `maskAllInputs: true`. Add `replaysSessionSampleRate: 0` and a small `replaysOnErrorSampleRate`.
- Never on screens that show regulated or sensitive data. If the product has such screens, either exclude those routes (stop the replay on navigation) or keep Replay off entirely. Ask; recommend off.

## Feedback

- Feedback text is user-written and may contain anything. Don't pre-fill it with user data. Ask for an email only when the user wants a reply.
- Support-email feedback necessarily carries the sender's address. Say so in the privacy docs.

## Server-side (project settings, human step)

- Data Scrubber on, with "Use Default Scrubbers" on.
- "Prevent Storing of IP Addresses" on.
- Add sensitive field names to "Additional Sensitive Fields".
- Set data retention to the shortest period that still covers triage.
