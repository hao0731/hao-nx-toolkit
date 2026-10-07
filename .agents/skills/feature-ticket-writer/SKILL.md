---
name: feature-ticket-writer
description: Create or refine feature-oriented development tickets across frontend, backend, APIs, and workflows, with Background, Description, a Requirements checklist, and E2E-verifiable Given/When/Then Acceptance Criteria. Use when asked to write feature tickets, functional requirements, or acceptance criteria.
---

# Feature Ticket Writer

Turn requirements into clearly scoped, actionable, and verifiable tickets organized around feature outcomes rather than technical layers.

## Principles

- Scope each ticket around one coherent user or system capability. Prefer small, independently verifiable feature slices; include only the technical layers involved, and do not split solely by frontend/backend.
- Follow the user's requirements and provided specifications. Do not invent features, business rules, UI interactions, or technical constraints.
- Ask necessary questions when missing information prevents defining scope, behavior, or acceptance outcomes. Do not repeat questions already answered.
- Use English by default unless a different language is explicitly specified. Keep section headings in English.
- Once clarification is complete, output only the ticket. Do not generate implementation or test code.

## Section Rules

### Background

Describe the usage context, current problems, affected users or systems, and impact. Focus on why the ticket is needed, not the solution.

### Description

Explain how the problems should be addressed, including target behavior, key interactions, and scope. Identify the feature's entry point and observable outcome, including relevant system boundaries. Describe the solution direction without code or a step-by-step implementation plan.

### Requirements

- Use a checklist with sequential IDs: `- [ ] R1: ...`. Each item must describe one clear requirement.
- Include feature behavior, interactions, data handling, and confirmed engineering constraints as applicable. Do not assume every feature needs a UI or changes across all layers.
- Avoid vague statements such as "improve the experience." Label purely engineering constraints that cannot be verified through E2E as "Engineering constraint"; do not force them into E2E scenarios.

### Acceptance Criteria

- Each AC must represent one independent, repeatable E2E test case focused on a single scenario. It must not depend on other test cases' execution results.
- Use Given / When / Then, with And for additional conditions, actions, or outcomes.
  - Given: The actor or caller, initial data, and system state needed to reproduce the scenario.
  - When: A specific action at the feature's entry point, such as a user interaction, API request, CLI command, incoming event, or controlled scheduled trigger.
  - Then: An explicit, observable, assertable outcome, such as visible content, API response data, an emitted event, a delivered notification, or a generated file.
- Exercise the relevant end-to-end feature flow within the boundaries defined in Description. An isolated component check does not qualify as E2E merely because it uses an API or event.
- Verify outcomes through supported interfaces. Do not use internal function calls, private application state, source-file organization, or source code content as pass conditions. Verify persistence through subsequent reads or interactions when required.
- Make asynchronous outcomes testable using a concrete completion signal or an agreed timeout. Do not invent timing thresholds.
- Avoid vague outcomes such as "works normally," "displays correctly," or "is fast." Specify concrete data, states, or confirmed quantitative criteria.
- Cover the main flow and applicable error, empty-state, boundary, and permission scenarios within the stated scope. Do not invent requirements.
- Every E2E-verifiable requirement must have at least one AC. Reference the relevant R IDs in each AC, and do not verify out-of-scope behavior.

## Output Format

Output these four sections in order. Add requirements and ACs as needed, and replace placeholders with specific content:

```markdown
## Background

<Usage context, current problems, affected users or systems, and impact>

## Description

<Solution direction, target behavior, entry point, observable outcome, and scope>

## Requirements

- [ ] R1: <Specific requirement>

## Acceptance Criteria

### AC1: <Scenario name> (R1)

- **Given** <Explicit preconditions and test data>
- **When** <Specific action or trigger at the feature's entry point>
- **Then** <Externally observable outcome assertable through E2E>
```