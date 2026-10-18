# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Canonical role | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.

## Trackers

A **tracker** is an issue that only holds sub-issues: a thread `/synthesize-backlog` folded in, or an issue split during triage. It is not a triage role.

| Kind | Label in our tracker |
| --- | --- |
| `tracker` | `tracker` |

A tracker carries the tracker label and a category role, and no state role. Sweeps for untriaged work skip it, as they skip `audit-run`. Close it as completed once every sub-issue is closed.
