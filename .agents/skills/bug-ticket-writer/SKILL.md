---
name: bug-ticket-writer
description: Create or refine bug tickets with reproduction steps, a focused fix approach, a requirements checklist, and Given/When/Then acceptance criteria for regression tests.
---

# Bug Ticket Writer

## General Rules

- Write tickets in English unless the user explicitly requests another language.
- Scope each ticket to one coherent bug. Exclude unrelated improvements and refactoring.
- Use available evidence and project context. Never invent reproduction steps, environment details, expected behavior, or root causes. Distinguish confirmed facts from hypotheses.
- Ask concise questions only when missing information blocks understanding the defect, defining scope, or writing testable acceptance criteria. Otherwise, mark relevant unknowns explicitly.
- Return only the ticket, using the four sections below in order.

## Section Rules

### Background
- Explain the affected behavior, problem, and user or system impact.
- Include relevant known environment details and preconditions, numbered reproduction steps, actual behavior, and expected behavior.
- For intermittent bugs, state known triggering conditions and observed frequency when available; do not imply guaranteed reproduction.

### Description
- Describe the intended fix approach and scope without unnecessary implementation details.
- Mention the root cause only when confirmed. Otherwise, identify what needs investigation and label any proposed fix as tentative.

### Requirements
- Use numbered checklist items: `- [ ] R1: ...`.
- Each item must state a concrete repair obligation and its verifiable expected outcome, not merely an investigation or coding task.
- Include compatibility or preservation constraints only where relevant to the fix.

### Acceptance Criteria
- Use independent, repeatable Given/When/Then scenarios; add And when necessary.
- Given defines relevant initial state and data; When specifies a concrete trigger; Then states observable, objectively assertable results at the tested boundary, not private implementation details.
- Include a scenario for the original defect that should fail before the fix and pass afterward. Add relevant edge cases and checks that at-risk existing behavior remains unchanged.
- Cover every requirement with at least one scenario and reference its ID, e.g. `AC1: <Scenario> (R1)`.
- Support regression testing at the appropriate level: unit, integration, or E2E. Do not require every scenario to be E2E.
- For asynchronous behavior, specify an observable completion condition and any established timeout. Avoid arbitrary waits or vague results such as "works correctly."

## Output Template

```markdown
## Background
<Problem, affected behavior, and impact.>

**Environment / Preconditions:** <Relevant known details.>

**Steps to Reproduce:**
1. <Action.>
2. <Action that triggers the defect.>

**Actual Behavior:** <Observed result.>
**Expected Behavior:** <Intended result.>

## Description
<Fix approach and scope; confirmed cause or explicitly stated investigation needs.>

## Requirements
- [ ] R1: <Required repair and verifiable expected outcome.>

## Acceptance Criteria
### AC1: <Regression scenario> (R1)
- **Given** <Initial state and data.>
- **When** <Triggering action or event.>
- **Then** <Specific, assertable result.>
```