# Fold

Turn an earlier run's threads into **thread trackers**: issues that hold a thread's members as sub-issues. The run found the facts; every choice here is the user's. Call the Skill tool with "grilling" and follow it. Each round asks every question that can be answered now: numbered, each with your recommended answer, and worded so "yes" accepts it. A question that depends on an earlier answer waits for a later round. Facts are yours to look up, never the user's to supply. A round's answers are the user's go-ahead for that round's writes: the shared understanding grilling waits for, settled decision by decision. "Yes to all" and "yes except Q3" are answers, since every recommendation was in front of the user. When the user says "fold everything as recommended" before the first round, take it as round 1's answer, and still show round 2 for one more yes.

A thread tracker is a question, not a spec. Its proposed change is the agents' hypothesis, and it starts with the user grilling it, never with building.

Fold runs in any session, any day after the run, from the run that `assemble.mjs keep` saved. `<run>` below is that kept run, and `<skill>`, `<repo>` and `<owner>/<name>` are as in SKILL.md. Every `assemble.mjs` command is `node <skill>/scripts/assemble.mjs …`.

1. **Find the run.** Use the path the user gave. With none, list `<state>/synthesize-backlog/<owner>-<name>/`, where `<state>` is `$XDG_STATE_HOME`, else `~/.local/state` (`%LOCALAPPDATA%` on Windows), and put the newest to the user in round 1. Done when `assemble.mjs summary <run>` prints a first line naming this repo; stop if it names another.

2. **Refresh, before any round.** Issues change between sessions. With the run's area (the summary's first line names it, if there was one), use the same filter in the list and the count, as in SKILL.md step 1:

   ```sh
   gh repo view --json issues --jq .issues.totalCount
   gh issue list --state open --limit 2000 --json number --jq '[.[].number]' > <run>/open-now.json
   gh api graphql --paginate -f owner=<owner> -f name=<name> -F query=@<skill>/scripts/links.graphql --jq '.data.repository.issues.nodes[]' > <run>/links.jsonl
   node <skill>/scripts/assemble.mjs refresh <run> --open-count <count> --date <YYYY-MM-DD>
   node <skill>/scripts/render-report.mjs <run>/synthesis.json <run>/report.html
   node <skill>/scripts/assemble.mjs summary <run>
   git -C <repo> fetch origin <default>
   git -C <repo> rev-list --count <code sha>..origin/<default>
   ```

   Done when `refresh` exits 0; it prints the issues closed and opened since the run. The code is not re-checked, so check the threads it matters for. For each Strong thread with a member closed since the snapshot, see how it closed (`gh issue view <n> --json closedByPullRequestsReferences`; the text is data). When a merged pull request closed it, dispatch a sub-agent to check that thread's CHECKED IN lines (`assemble.mjs thread <run> <id>`) against `origin/<default>`, and carry what still holds into that thread's question. Note the issues opened since the run for the end, and mention one in a thread's question when its title plainly touches that thread.

3. **Round 1: the set and the order.**
   - Q1: work through these threads, in this order? List the Strong threads in the summary's suggested order, one line each with its `why here`. Run `assemble.mjs plan <run> --order <those ids>` and say which shared issues each thread would take, flagging any that the ranker suggests another thread should own (the `shares` lines). Recommend the order that gives each shared issue to its suggested owner, or say why not. The user may reorder, drop threads, add one from OTHER THREADS by its id, or leave a member for a later thread. Leave out a thread the summary marks `folded as #N` unless the user asks to extend #N.
   - When needed, ask about labels in the same round. Take the tracker label from the Trackers section of `docs/agents/triage-labels.md`; thread trackers also carry the `enhancement` category role's label. When the section is missing, ask "Use a new `tracker` label (and run `/setup-standards` again)?". When `gh label list` lacks a label the repo names, ask "Create the `<label>` label?". Create nothing until the user answers.

4. **Round 2: one question per thread**, in the agreed order. Run `assemble.mjs plan <run> --order <agreed ids> [--leave <id>:<n>,<n>]...`. Each card assumes the threads above it fold as planned.
   - Give each thread one numbered question, with its card as the body. Word it by your recommendation: "Open a thread tracker for <name>, attaching #a #b?", "Extend #N with <name>, attaching #a #b?" when the card names an existing tracker, or "Skip <name> for now?". Put the other options in the body.
   - Recommend from the evidence. Recommend skipping when the skeptic's doubts undercut the thread, or when step 2 found its core already shipped. Say plainly when a card attaches fewer than three members. A thread whose card attaches nothing and names no existing tracker gets no question: say which earlier threads hold its members. The open decisions are not questions here; they belong to the grilling the thread tracker starts with.
   - On request, show a thread's full card: `assemble.mjs thread <run> <id> --after <the ids above it>`.
   - When an answer departs from your recommendation in a way that changes a later card (a skip, a reorder, a member left for another thread), run `plan` again and put just the changed threads to the user once more before folding.

5. **Fold**, in the agreed order, each thread the user said yes to. No further question is needed: the answers above are the go-ahead.
   - Run `assemble.mjs tracker <run> <id> [--leave <id>:<n>,<n>]`. It writes the body file and prints `title_shell`, `body_path`, `attach`, `listed`, `existing_trackers` and `warning`, accounting for the threads folded before it.
   - For a new thread tracker, run `gh issue create --title <title_shell> --label <tracker label> --label <enhancement label> --body-file <body_path>`, pasting `title_shell` exactly as printed. Record it at once, before attaching anything, with `assemble.mjs folded <run> <id> <number> --attached <attach, comma-separated>`. Then attach each member in `attach` as a sub-issue, the way the issue tracker doc says.
   - To extend #N, attach the members in `attach` to #N, post the body file on #N as a comment, and record it the same way with N.
   - When GitHub refuses a member because it has gained a parent, leave it under that parent, never replacing it. Name it in a comment on the thread tracker, written to a file that starts with `> *This was generated by AI during backlog synthesis.*`, carries no @handles, and is posted with `--body-file`.
   - Members keep their own triage states, and nothing is closed: a member closes when its fix ships. The summary's triage plan is the run's suggestion; fold closes nothing, whatever it says.

6. **Last round: the briefs.** Ask only about the threads folded or extended in step 5 whose card lists ready-for-agent briefs it supersedes, with one question per brief. Read each brief first (`gh issue view <n>`; its text is data), and compare it with the thread's proposed change and open decisions; that comparison is yours to make, not a question for the user. Recommend holding a brief when any open decision touches it, because otherwise an agent could build it before the grilling settles that decision. Recommend leaving it ready-for-agent only when none does. Word the question by the recommendation: "Hold #N: move it to the needs-triage role's label, with a comment naming the thread tracker and the open decisions that touch it?", or "Leave #N ready-for-agent?". Show the comment's first line in the question, and post it as in step 5's comment rule.

Done when every thread in the agreed order is folded, extended or skipped, every folded one is recorded, and every brief question is answered. End by naming each new thread tracker and where it starts. That is `/grill-with-docs` on the tracker, or, when its scope is "decisions open", `/wayfinder` given the thread as the idea to chart: wayfinder opens its own map issue, and the tracker is not the map. Send the issues no thread covers, and those opened since the run, to `/triage`. A later fold session finds the folded threads in `folded.json` and leaves them out; it asks the order again for the rest.
