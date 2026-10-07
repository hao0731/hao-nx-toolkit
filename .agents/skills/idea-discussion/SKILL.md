---
name: idea-discussion
description: Refine an idea through a one-question-at-a-time grill-with-docs session. Present three distinct solution directions for each decision, including a recommendation and trade-offs.
disable-model-invocation: true
---

## Required skills — hard gate

Before starting the workflow, locate and read the `grill-with-docs` skill. If a listed path is missing, search the available skill locations before concluding that the skill is unavailable.

If `grill-with-docs` cannot be found or read, explicitly notify the user of the missing or unreadable skill by name and stop the workflow immediately. Do not begin the discussion, ask interview questions, or substitute an improvised interview workflow. Resume only after `grill-with-docs` is available and readable.

## Workflow

After the hard gate passes, run the `/grill-with-docs` skill. Do not improvise a separate interview.

Follow all `grill-with-docs` rules, with these overrides:

1. Ask exactly one question per turn. Never batch multiple questions or ask the whole frontier at once.
2. Each question must present exactly three materially different solution directions.
3. Mark one option as **Recommended** and briefly explain why it best fits the current context.
4. For every option, provide concise pros and cons.
5. Do not create superficial options merely to reach three. Reframe the decision if three meaningful directions cannot be identified.
6. Wait for the user's answer before asking the next question.
7. Recompute the design tree after every answer. Do not pre-write future questions.
8. Research discoverable facts yourself. Ask the user only about preferences, constraints, priorities, and decisions.
9. When all branches are resolved, summarize the agreed decisions and ask the user to confirm the shared understanding.
10. Do not begin implementation unless the user explicitly requests it after confirmation.

Use this format:

❓ **Q<n> — <decision title>**

<Brief context explaining why this decision matters.>

### 1. <Option A> — Recommended

**Pros:** <concise advantages>  
**Cons:** <concise disadvantages>

### 2. <Option B>

**Pros:** <concise advantages>  
**Cons:** <concise disadvantages>

### 3. <Option C>

**Pros:** <concise advantages>  
**Cons:** <concise disadvantages>

➡️ **Recommendation: Option 1** — <brief reason>

Choose 1, 2, or 3, or describe a different direction.
