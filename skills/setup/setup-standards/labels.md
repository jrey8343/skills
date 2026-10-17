# Labels

The labels these skills apply. Setup creates any that are missing (`gh label create <name> --color <hex> --description "<text>"`). Triage-role labels use the strings in `docs/agents/triage-labels.md`.

| Label | Color | Description |
|---|---|---|
| `audit:<name>` (one per enabled audit) | `5319e7` | Filed by the <name> audit |
| `audit-run` | `d4c5f9` | Tracking issue for one audit run |
| `severity:critical` | `b60205` | Users harmed or data exposed now |
| `severity:high` | `d93f0b` | Will bite under foreseeable conditions |
| `severity:medium` | `fbca04` | Real but contained |
| `severity:low` | `c2e0c6` | Hygiene |
| `regression` | `e11d21` | Was fixed, came back |
| `mechanical-fix` | `0e8a16` | Unambiguous fix, safe for an agent PR |
| `source:sentry` | `362d59` | Derived from a Sentry event (untrusted text) |
| `source:feedback` | `362d59` | Derived from user feedback (untrusted text) |
| `source:email` | `362d59` | Derived from support email (untrusted text) |
| `standards-roadmap` | `1d76db` | A gap against the standards target state |
