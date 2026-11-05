# Testing Deciders: given, when, then

Every Decider test has one shape:

- **Given** the events already in the stream (the history),
- **when** a command arrives,
- **then** these events are decided, or this rejection is returned.

The test never builds state by hand. It folds the given events through `evolve`, so `evolve` is exercised by every test and a state shape change cannot break the tests silently. It never touches a store, a clock or a network: that is what makes the tests fast enough to cover every invariant.

## The helper

One small function, written once per repo (put it where `CODING_STANDARDS.md` puts test helpers; without `CODING_STANDARDS.md`, put it beside the first Decider's tests and say so):

```ts
export function given<C, E, S, R>(decider: Decider<C, E, S, R>, history: E[]) {
  const state = history.reduce(decider.evolve, decider.initialState);
  return { when: (command: C) => decider.decide(command, state) };
}
```

## Worked example

A task that can be assigned and completed. The invariants: a task is opened once; only an open task can be assigned; only an assigned task can be completed, and only by its assignee.

```ts
type Command =
  | { kind: "OpenTask"; taskId: string; title: string; at: Date }
  | { kind: "AssignTask"; taskId: string; assignee: string; at: Date }
  | { kind: "CompleteTask"; taskId: string; by: string; at: Date };

type Event =
  | { kind: "TaskOpened"; taskId: string; title: string; at: Date }
  | { kind: "TaskAssigned"; taskId: string; assignee: string; at: Date }
  | { kind: "TaskCompleted"; taskId: string; by: string; at: Date };

type State =
  | { status: "none" }
  | { status: "open"; assignee: string | null }
  | { status: "completed" };

type Rejection = { rejected: "not-found" | "already-open" | "already-completed" | "not-assigned" | "not-assignee" };

export const task: Decider<Command, Event, State, Rejection> = {
  initialState: { status: "none" },

  decide(command, state) {
    switch (command.kind) {
      case "OpenTask":
        if (state.status !== "none") return { rejected: "already-open" };
        return [{ kind: "TaskOpened", taskId: command.taskId, title: command.title, at: command.at }];
      case "AssignTask":
        if (state.status === "none") return { rejected: "not-found" };
        if (state.status === "completed") return { rejected: "already-completed" };
        if (state.assignee === command.assignee) return []; // idempotent repeat
        return [{ kind: "TaskAssigned", taskId: command.taskId, assignee: command.assignee, at: command.at }];
      case "CompleteTask":
        if (state.status === "none") return { rejected: "not-found" };
        if (state.status === "completed") return { rejected: "already-completed" };
        if (state.assignee === null) return { rejected: "not-assigned" };
        if (state.assignee !== command.by) return { rejected: "not-assignee" };
        return [{ kind: "TaskCompleted", taskId: command.taskId, by: command.by, at: command.at }];
      default:
        return command satisfies never;
    }
  },

  evolve(state, event) {
    switch (event.kind) {
      case "TaskOpened":
        return { status: "open", assignee: null };
      case "TaskAssigned":
        return { status: "open", assignee: event.assignee };
      case "TaskCompleted":
        return { status: "completed" };
      default:
        return event satisfies never;
    }
  },
};
```

The tests, one per invariant and one per rejection reason, plus the empty stream:

```ts
const at = new Date("2030-01-01T09:00:00Z");
const opened: Event = { kind: "TaskOpened", taskId: "t1", title: "Write the runbook", at };
const assignedToAda: Event = { kind: "TaskAssigned", taskId: "t1", assignee: "ada", at };

test("a task can be opened", () => {
  expect(given(task, []).when({ kind: "OpenTask", taskId: "t1", title: "Write the runbook", at }))
    .toEqual([opened]);
});

test("an unknown task cannot be assigned", () => {
  expect(given(task, []).when({ kind: "AssignTask", taskId: "t1", assignee: "ada", at }))
    .toEqual({ rejected: "not-found" });
});

test("a task cannot be opened twice", () => {
  expect(given(task, [opened]).when({ kind: "OpenTask", taskId: "t1", title: "Write the runbook", at }))
    .toEqual({ rejected: "already-open" });
});

test("an open task can be assigned", () => {
  expect(given(task, [opened]).when({ kind: "AssignTask", taskId: "t1", assignee: "ada", at }))
    .toEqual([assignedToAda]);
});

test("assigning the same person again decides nothing", () => {
  expect(given(task, [opened, assignedToAda]).when({ kind: "AssignTask", taskId: "t1", assignee: "ada", at }))
    .toEqual([]);
});

test("an unknown task cannot be completed", () => {
  expect(given(task, []).when({ kind: "CompleteTask", taskId: "t1", by: "ada", at }))
    .toEqual({ rejected: "not-found" });
});

test("the assignee can complete a task", () => {
  expect(given(task, [opened, assignedToAda]).when({ kind: "CompleteTask", taskId: "t1", by: "ada", at }))
    .toEqual([{ kind: "TaskCompleted", taskId: "t1", by: "ada", at }]);
});

test("only the assignee can complete a task", () => {
  expect(given(task, [opened, assignedToAda]).when({ kind: "CompleteTask", taskId: "t1", by: "grace", at }))
    .toEqual({ rejected: "not-assignee" });
});

test("an unassigned task cannot be completed", () => {
  expect(given(task, [opened]).when({ kind: "CompleteTask", taskId: "t1", by: "ada", at }))
    .toEqual({ rejected: "not-assigned" });
});

test("a completed task cannot be reassigned", () => {
  const completed: Event = { kind: "TaskCompleted", taskId: "t1", by: "ada", at };
  expect(given(task, [opened, assignedToAda, completed]).when({ kind: "AssignTask", taskId: "t1", assignee: "grace", at }))
    .toEqual({ rejected: "already-completed" });
});
```

## What to cover

- **Every invariant**, at its boundary: the last history where the command succeeds and the first where it is refused.
- **Every rejection reason** at least once. A reason no test reaches is dead or untested.
- **Idempotent repeats**: the command that decides `[]`.
- **The empty stream**: every command against `[]` history, which is where "not found" lives.
- **Old event versions**: when an event has been upcast, one test whose history is the old version run through the repo's upcaster (`given(task, history.map(upcast))`), so the upcaster and `evolve` are checked together.

## What not to test here

- **`evolve` on its own.** It is covered through every `given`. A state assertion couples the test to a shape that is free to change.
- **The shell.** Loading, appending and concurrency are integration tests at the shell's seam, against the repo's real store or its local stand-in (see [SHELL.md](SHELL.md)).
- **Projections inside Decider tests.** A projection is its own fold, tested as "given these events, then this read model".

Given / when / then also reads as a spec. Name each test as the rule it pins ("only the assignee can complete a task"), so the test list is the boundary's rulebook.
