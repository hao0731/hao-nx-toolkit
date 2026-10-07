---
name: atomic-implementation-loop
description: Implement agreed work through delegated increments, immediate atomic commits, and independent policy and goal reviews.
---

# Atomic Implementation Loop

The main agent orchestrates, verifies, and commits; `implementer` makes all implementation changes.

## Prepare

- Require subagent delegation and the `implementer`, `policy-reviewer`, and `goal-reviewer` agents. Stop before editing if unavailable; do not substitute a single-agent workflow.
- Read the work source and applicable repository instructions. Record repository/worktree path, branch, `BASE_SHA = HEAD`, and existing staged, unstaged, and untracked changes.
- Preserve unrelated user changes and their staging. Stop and ask before editing overlapping paths or depending on uncommitted user work. Never stash, discard, or overwrite it automatically.
- Normalize the ticket, conversation, or file into a compact Work Contract: goal, numbered requirements/acceptance criteria, constraints, non-goals, and source references. Resolve material ambiguity or unsettled architecture decisions with the user; do not invent requirements.
- Locate and read the `tdd` skill. If available, use it. If missing or unreadable after checking available skill locations, ask whether to use TDD and wait before editing. If yes, observe a behavior test fail for the intended reason, implement the minimum to pass, then refactor with tests passing. If no, retain relevant tests and required checks. Mandatory repository TDD rules still apply. Record the testing approach and skill path, when available.
- Outline ordered increments by behavior or engineering purpose, not files or layers. Each leaves a valid, reviewable state and includes coupled tests. Justify genuinely indivisible work before implementation.
- Locate the `handoff` skill before implementation; stop if unavailable. Load it when preparing a session switch.
- Briefly show the contract, testing approach, and queue, then proceed without an additional approval gate. Keep contract, base/expected HEAD, increment status, commits, checks, review count, session handles, and selected handoff paths in the main agent's working context and recovery summaries; no extra planning files beyond required handoffs. Replan execution, not agreed scope.

## Implementer session selection

- Plan a tentative reuse/new choice for each increment and confirm it before dispatch. Default to reuse within the same Work Contract and worktree, especially for rework; start fresh for substantially different context, unavailable continuation, unrecoverable context loss, or a user-requested reset. Record one concrete reason, not invented context metrics or predicted savings. A completed commit, failed test, or compaction alone is not a reset reason.
- Assign each increment a positive execution number when first dispatched. Keep it for retries; allocate increasing numbers for subsequent increments, including remediation. Session changes do not reset this sequence.
- Record the tool-returned continuation handle; never invent it. Resume through the tool's continuation argument, not merely the agent name. An unexpected new session identity is a reset: inspect resulting changes and complete recovery before further implementation.
- Keep one writer at a time. Normally switch after verification and commit; first-time implementation needs no handoff. If a previous implementer is being replaced, follow the handoff step below before dispatching its successor.

## Execute one increment

1. Start or resume the selected implementer. For a new session, supply the Work Contract/source references, worktree path, expected HEAD, increment number/objective, relevant requirements, scope/non-goals, policy/context references, protected user changes, testing approach, `tdd` skill path when available, required checks, and the selected handoff path when replacing a session. For reuse, supply the latest expected HEAD, current increment, relevant requirements/AC, scope, checks, and changed context; unchanged constraints still apply. Run only one assignment at a time.
2. Wait for completion and confirm the implementer has stopped editing. Check the returned session identity and inspect all changed files, including new files, and actual verification evidence. Run relevant repository checks in check-only mode; return scope violations or failures to the same implementer for rework when resumable. Missing required checks or stalled progress are blockers, not passes.
3. Confirm HEAD and unrelated user changes/staging are unchanged. Stage only increment-owned paths and inspect their staged diff; exclude `.handoff/`. Commit immediately using repository conventions. When unrelated changes are already staged, use a path-limited commit (`git commit --only -- <paths>`) to exclude them. Recheck hook-produced changes and verification before continuing.
4. Confirm the commit contains only the accepted increment and no increment-owned changes remain. Record its SHA and update the remaining queue. Keep the implementer session available but idle until the next assignment; completing an increment does not end its session. Never create WIP/catch-all commits, rewrite history, bypass hooks, or push.

Reuse prior repository discoveries, but refresh changed files, dependencies, and applicable rules. Current repository state and the latest assignment take precedence over stale recollections; avoid broad rediscovery unless needed to fill a specific context gap.

Do not claim a committed snapshot passes checks that depend on unrelated dirty files; verify it separately when necessary.

## Handoff before switching

1. After accepting the outgoing increment, resume its implementer for a handoff-only assignment. Supply its actual session ID, increment number, accepted HEAD, worktree root, source references, next scope, and the `handoff` skill. It may write only the designated handoff file, not implementation files. Do not generate a handoff for every reused increment.
2. Inspect the draft against the accepted commit and verification evidence. Confirm HEAD, product files, and protected changes remain unchanged; then mark the document `accepted` and record its exact path. Pass that path explicitly to the new implementer, not a directory to search for the newest file.
3. If the old session is unavailable, confirm it has stopped writing and reconstruct the document with the same skill from verified records, identifying the main agent as the recovery author. Use the known outgoing session ID; do not fabricate missing identity. For interrupted work, use the attempted increment number, record the last accepted HEAD and every outstanding change, and mark `interrupted`, not completed. Stop if safe recovery cannot be established.

Handoffs are local workflow metadata, never product commits or substitutes for the original requirements. Preserve existing files; do not automatically modify ignore rules or delete handoffs. Only explicitly validated handoff files are exempt from the final uncommitted-work check.

## Review and remediate

- Use `max_review_rounds = 3` unless the user specifies another positive limit. One round is one pair of reviews, including the initial pair.
- After all increments, run final relevant checks and freeze `REVIEW_SHA = HEAD`. No writes or commits while reviewers run.
- Start fresh `policy-reviewer` and `goal-reviewer` agents, in parallel when available. Give both `BASE_SHA`, `REVIEW_SHA`, repository path, and verification evidence. Give policy review the applicable rules/decisions; give goal review the original contract and source references. Keep handoffs focused; do not forward another reviewer's findings or earlier verdicts.
- Review the complete committed change from `BASE_SHA` to `REVIEW_SHA`, not only the last increment or dirty working tree. Require both reports for that exact SHA, then end both review assignments.
- If either requests changes and another review round remains, turn blocking findings into focused remediation increments. Execute them through the same implement/verify/commit loop, rerun final checks, and review again with both agents. Any new commit invalidates both previous passes.
- Stop with unresolved findings after the configured number of rounds. Missing, blocked, or stale reports cannot pass. Escalate disputed blockers or unavailable verification instead of silently waiving them.

## Finish

Report DONE only when required checks pass, both reviewers pass the current HEAD, and no workflow-owned changes remain uncommitted except validated local handoff files. Otherwise report BLOCKED and preserve progress. Summarize commits, verification, both verdicts, unresolved issues, any untouched user changes, and retained handoff paths.