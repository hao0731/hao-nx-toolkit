---
status: accepted
---

# Native affected project boundary checks

Amend [ADR 0001](./0001-standalone-project-boundary-checker.md)'s single-root execution design: native `nx affected -t check-boundaries` needs a target on each source project. Initialization now configures each project's own project boundary check and a separate root `check-boundaries-all` workspace boundary check. This uses Nx's existing affected selection and reverse dependent propagation, avoiding a second Git selection implementation.

## Consequences

- Every project target includes the shared policy as a workspace input. Policy changes select all configured projects; target tag changes select upstream dependents. The executor uses the complete graph so unchanged targets retain their tags. Caching remains disabled.
- Existing generated root workspace targets migrate to `check-boundaries-all`. Initialization rejects conflicting selectors or executors before writes and preserves policy bytes. Inferred projects receive minimal persistent target configuration; their inferred build/test targets remain inferred. Newly added projects require rerunning initialization.
- Parallel reports use the optional `{boundaryProjectName}` token, expanded to a bounded SHA-256 filename component. Nx interpolates its own `{projectName}` token before CLI execution, which prevents that token from providing the plugin's safe filename behavior. Literal output paths retain their existing behavior.
- The tag policy and dependency semantics from ADR 0001 remain unchanged. Affected checks read the current workspace; committed base/head comparison does not include uncommitted changes or provide staged-only snapshot validation.

Installed Nx 23.2.0 E2E verifies these decisions with real temporary Git commits, distinct report scopes, unrelated-source negative controls, full workspace checks, and a real inference plugin.
