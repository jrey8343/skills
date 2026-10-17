# Functional Core, Imperative Shell

The core decides; the shell does. The seam between them is the core's interface: plain data in, a decision out. Because nothing sits behind that seam, the core needs no adapter at all, and its tests are fast, exhaustive and immune to infrastructure.

## Before: decision logic smeared through the shell

```ts
app.post("/bookings/:id/cancel", async (c) => {
  const booking = await c.env.DB
    .prepare("SELECT * FROM booking WHERE id = ?")
    .bind(c.req.param("id"))
    .first<BookingRow>();
  if (!booking) return c.json({ error: "not-found" }, 404);
  if (booking.status === "cancelled") return c.json({ error: "already-cancelled" }, 409);

  const hours = (new Date(booking.starts_at).getTime() - Date.now()) / 3_600_000;
  let refund = 0;
  if (hours > 48 && booking.status !== "completed") {
    refund = booking.price_paid_cents;
    await stripe.refunds.create({ payment_intent: booking.payment_intent, amount: refund });
  }
  await c.env.DB.prepare("UPDATE booking SET status = 'cancelled' WHERE id = ?").bind(booking.id).run();
  return c.json({ refund });
});
```

What hurts:

- The refund rule can only be tested by standing up D1 and mocking Stripe.
- `Date.now()` makes the 48-hour boundary untestable without fake timers.
- The `completed` check runs after the money moves; it is in the wrong place and nothing would catch it.
- No tenant predicate on the query, and no bound on the Stripe call.

## After: the core

```ts
// features/bookings/core/cancellation.ts
import { assert } from "../../../shared/assert";

export const refundNoticeHoursMin = 48;

export type Booking = {
  id: string;
  status: "confirmed" | "cancelled" | "completed";
  startsAt: Date;
  pricePaidCents: number;
};

export type CancellationDecision =
  | { kind: "rejected"; reason: "already-cancelled" | "already-completed" }
  | { kind: "cancelled"; refundCents: number };

export function decideCancellation(booking: Booking, now: Date): CancellationDecision {
  assert(booking.pricePaidCents >= 0, "price paid is never negative");

  switch (booking.status) {
    case "cancelled":
      return { kind: "rejected", reason: "already-cancelled" };
    case "completed":
      return { kind: "rejected", reason: "already-completed" };
    case "confirmed":
      break;
    default:
      booking.status satisfies never;
  }

  const noticeHours = (booking.startsAt.getTime() - now.getTime()) / 3_600_000;
  const refundCents = noticeHours >= refundNoticeHoursMin ? booking.pricePaidCents : 0;

  assert(refundCents <= booking.pricePaidCents, "refund never exceeds price paid");
  return { kind: "cancelled", refundCents };
}
```

## After: the shell

```ts
// features/bookings/shell/cancel-route.ts
app.post("/bookings/:id/cancel", async (c) => {
  const bookings = bookingRepo(c.env.DB, tenantIdOf(c));
  const booking = await bookings.find(c.req.param("id"));
  if (!booking) return c.json({ error: "not-found" }, 404);

  const decision = decideCancellation(booking, new Date());
  if (decision.kind === "rejected") return c.json({ error: decision.reason }, 409);

  await bookings.markCancelled(booking.id);
  if (decision.refundCents > 0) {
    await payments(c.env).refund(booking.id, decision.refundCents); // bounded timeout inside the adapter
  }
  return c.json({ refundCents: decision.refundCents });
});
```

The shell now reads top to bottom: gather, decide, act. It has one domain-free branch per decision variant.

## Testing at each seam

| Seam | Test | Stand-in |
|---|---|---|
| Core interface (`decideCancellation`) | Unit, table-driven: every status, the boundary at exactly 48 hours, zero price. | None needed. |
| Slice interface (the route) | Integration: real request in, response and database state out. | The platform's local stand-in (for Workers: `@cloudflare/vitest-pool-workers` with local D1). Third parties get a mock adapter at their seam. |
| Journey | e2e, tagged `[journey:<id>]`. | The running app with seeded data. |

Do not unit-test the shell: it has no logic of its own to test. If it does, the core is leaking.

## Smells this shape removes

- **Leaking core**: domain conditionals in a handler, a repo, or a component.
- **Impure core**: a "pure" module that reads the clock, the environment, or the network.
- **Effect before decision**: money, email or writes happening before every rule has been checked.
