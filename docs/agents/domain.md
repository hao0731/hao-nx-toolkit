# Domain Docs

Use a single-context layout:
- `GLOSSARY.md` at the repository root.
- `docs/adr/` for architecture decision records.

## Before exploring

Read the root glossary and ADRs relevant to the area being explored.

If these files do not exist, proceed silently. Do not flag their
absence or suggest creating them upfront. The domain-modeling skill
creates them lazily when terms or decisions get resolved.

## Use the glossary's vocabulary

Use defined domain terms in issue titles, proposals, hypotheses,
and tests. Avoid synonyms the glossary explicitly excludes.

If a concept is missing, reconsider whether it belongs to the
project's vocabulary or note the gap for domain-modeling.

## Flag ADR conflicts

Explicitly identify proposals that contradict an existing ADR
and explain why the decision may need reopening.
