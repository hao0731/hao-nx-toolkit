---
name: handoff
description: Write or read a compact, verifiable increment handoff between implementer sessions.
---

# Handoff

Use Create for a handoff-only assignment and Consume when given a document to continue from.

## Create

### Inputs and destination

Require the supplied worktree root, actual outgoing subagent session ID, increment number, original work source, last accepted HEAD, and next assignment or recovery scope. Missing identity or state is a blocker; never guess.

Write to `<worktree-root>/.handoff/<subagent_id>-incremental-<NUMBER>.md`, creating `.handoff` if absent. Resolve from the supplied worktree root, not the skill directory or shell working directory.

- `subagent_id` is the tool-returned session ID, not `implementer` or a planning label. Require a filename-safe ID matching `[A-Za-z0-9][A-Za-z0-9_-]*`; do not silently transform it.
- `NUMBER` is the main agent's positive increment number, not a per-session counter. Reused increments need no file; gaps are normal.
- Keep the resolved destination inside the worktree; reject symlink redirection, tracked destinations, and collisions with unrelated files. Only update a draft for the same work source, session, increment, and accepted HEAD. Reuse an already validated matching snapshot instead of overwriting it.

### Write

Use current task context, reports, relevant code, and actual check results. Read the explicitly supplied prior handoff when useful; carry forward only still-relevant findings, not an expanding transcript or a chain the next agent must read in full.

Create a `draft`; only the main agent accepts it after checking the recorded snapshot. For recovery, identify the actual author and mark unfinished work `interrupted`, listing its changes separately from completed work. Never claim a test ran or an increment was accepted without evidence.

Use this structure; keep entries short and reference files or logs instead of copying large content:

```markdown
---
subagent_id: "<actual outgoing session ID>"
increment: <positive integer>
worktree: "<absolute worktree root>"
accepted_head: "<last accepted commit SHA>"
status: draft
---

# Increment handoff

## Source and scope
- Original ticket/file/conversation reference; relevant Requirement/AC IDs.
- Next assignment supplied by the main agent; constraints and non-goals.

## Accepted progress
- Completed increments and commit references; behavior now available.

## Start here
- Relevant paths/symbols, existing abstractions, and reusable decisions with reasons.

## Already checked
- Search scope and result, evidence/version, and conditions that require rechecking.

## Verification
- Commands, actual outcomes, and snapshot/log references; distinguish dirty-tree results.
- Testing approach and `tdd` skill path when applicable.

## Remaining work and cautions
- Open issues, unverified assumptions, protected user changes, and interrupted edits.
```

Treat "already checked" as scoped findings, never a prohibition on further inspection. Do not include credentials, unnecessary personal data, raw transcripts, or unsupported completion claims. Do not edit product files, stage/commit, change ignore rules, or clean up other handoffs.

Read back the file and return its exact path, recorded HEAD/status, and unresolved gaps; do not repeat the full document in the report.

## Consume

Read only the explicitly selected handoff first; do not select by filename order, modification time, or highest number. Normal continuation requires `accepted`, never `draft`. Verify its work source, worktree, status, and accepted HEAD against the current assignment. For mismatches, request a refreshed handoff or an explicit, verified delta; unresolved gaps are blockers. An `interrupted` handoff requires the main agent's recovery instructions before editing.

Use it to locate relevant code and avoid redundant discovery. Original requirements, applicable policies, the current repository, and the main agent's assignment remain authoritative; refresh changed context rather than treating the summary as proof.