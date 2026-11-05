# Stickies

The things a storm places on the timeline, and how each is named. Every name uses a glossary term, or proposes one through `domain-modeling`.

| Sticky | What it is | Named as | Example |
|---|---|---|---|
| **Domain event** | Something that happened that the business cares about, decided by this system. | Past tense, in glossary words. A domain verb, never a CRUD verb where one exists. | `OrderPlaced`, not `OrderCreated` |
| **Observed event** | What an external system of record did, arriving through an anti-corruption layer. | Past tense, with a suffix the conventions round agrees (for example `…Observed`). | `PaymentSettledObserved` |
| **Command** | An intention to change something, which a Decider accepts or refuses. | Imperative. | `PlaceOrder` |
| **Actor** | Who issues a command: a role, never a named person. | A glossary role. | Customer, Operator |
| **Policy** | A reaction: "whenever this event, then that command". | "Whenever X, then Y." | Whenever `OrderPlaced`, then `ReserveStock` |
| **Read model** | What an actor or policy looks at to decide. | A noun phrase for what it shows. | Open orders |
| **External system** | Something outside the system that sends or receives. | Its role, not its vendor, unless the repo's ADRs name the vendor. | Payment provider |
| **Hot spot** | A question, dispute, risk or assumption. | A question. | Can an order be part-cancelled? |
| **Pivotal event** | A domain event where the story changes hands; contexts form around them. | Bold in the timeline. | **`OrderShipped`** |

## Event origins

Agree in the conventions round which origins the system has. Most have two:

- **Decision**: this system decided it (a domain event).
- **Observed**: an external system did it, arriving through an anti-corruption layer.

Some systems need a third, such as a fact a device or person reports that the system records without deciding (a reading, a check-in). Name it in the conventions round if it appears, and keep it apart in the timeline.

## Errors are not events

A refused command decides nothing and leaves no event, unless the business cares that it was refused (a declined payment it must act on). Refusals go under the workflow's **Errors**.
