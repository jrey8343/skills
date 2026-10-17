# Policy gate

Sentry receives stack traces, breadcrumbs, URLs, request metadata, user context, optional Session Replay and feedback text. Any of these can carry personal or regulated data. Before installing anything, find out whether the project has already decided against that.

## Where to look

| Source | Look for |
|---|---|
| `docs/adr/**` | Decisions about observability, logging, vendors, data residency |
| `PRODUCT.md` (Constraints) | Regulatory regimes, residency, "no third parties" |
| Privacy material: `**/*privacy*`, `**/*consent*`, `**/*subprocessor*`, `**/*dpa*`, `**/*gdpr*` | Lists of approved subprocessors; promises made to users |
| Security material: `**/*threat*`, `**/*security*`, `**/*breach*` | Data-flow restrictions, incident commitments |
| Config and code comments: wrangler/Vercel/Fly configs, `**/log*.ts`, `**/error*.ts` | Comments stating a policy, e.g. "no third-party error vendor" |
| `CLAUDE.md`, `AGENTS.md`, `README.md` | Rules stated for contributors |

Search terms: `third-party`, `third party`, `vendor`, `subprocessor`, `sub-processor`, `residency`, `overseas`, `cross-border`, `transfer`, `region`, `sovereign`, `PII`, `PHI`, `personal information`, `health`, `clinical`, `financial`, `children`, `GDPR`, `HIPAA`, `Privacy Act`, `telemetry`, `Sentry`, `Datadog`, `error tracking`.

Report everything you found with paths and quotes, including "searched X, Y, Z; found nothing".

## Questions to grill (when something is found)

Ask in rounds. Each has a recommended answer.

1. **Does the policy still hold?** Is it a deliberate constraint (regulatory, contractual, a promise to users) or a default from an earlier stage?
2. **What would reach Sentry?** Walk the surfaces: server errors (request URLs, headers, bodies), client errors (URLs, breadcrumbs, user context), Replay, feedback text. Which can contain the regulated data?
3. **Can scrubbing make it acceptable?** With `sendDefaultPii: false`, `beforeSend` scrubbing, no IP storage, no Replay on sensitive screens and server-side data scrubbing, what residual risk remains?
4. **Is the region acceptable?** Sentry offers US or EU (Frankfurt) only, chosen once. Does either satisfy the residency constraint?
5. **What must change elsewhere?** The subprocessor register, privacy policy, consent copy, DPA with Sentry, any regulator notifications.
6. **Scope.** All surfaces, or only those that never touch regulated data (for example the marketing site and server errors with scrubbed payloads)?
7. **Alternatives.** Keep the first-party approach? Self-host? What would change the decision later?

The decisions are the user's. Never resolve a legal or compliance question on their behalf; record what they decided and flag the drafts for legal review.

## ADR additions

Use the domain-modeling ADR format, plus these sections, which are not optional here:

```md
# Adopt Sentry for error tracking (supersedes ADR-NNNN)

{Context: the earlier policy and why it is being revisited. Decision: what is adopted, for which surfaces, in which region.}

## Mitigations

- Data region: {US | EU}, chosen {date}; cannot be changed.
- `sendDefaultPii: false`; `beforeSend` scrubbing of {fields}; IP storage disabled.
- Session Replay: {off | masked, excluded from {screens}}.
- Server-side data scrubbing enabled in project settings.
- Surfaces excluded: {list, or none}.

## Obligations

- Subprocessor register and privacy policy updated ({paths}); legal review: {pending | done by whom}.
- DPA with Sentry: {status}.

## Review trigger

Revisit if {the regulated data scope changes, a residency requirement tightens, Sentry's region options change}.
```

If the decision is not to adopt, record a short ADR saying so and why, so future runs don't re-ask.
