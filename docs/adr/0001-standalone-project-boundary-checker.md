---
status: accepted
---

# Standalone tag-based project boundary checking

Provide `project-boundary` as an independent checker using Nx's project graph and the documented Conformance tag-constraint vocabulary, so consumers can check boundaries without using the official Conformance runner. Share a workspace-root `project-boundary.config.json` between workspace checks and selected-project checks, exposed through one root-project Nx target with an optional `project` argument. This keeps policy centralized and provides both execution scopes without adding a target to every project.

## Consequences

- The first version focuses on `sourceTag`, `allSourceTags`, `onlyDependOnProjectsWithTags`, and `notDependOnProjectsWithTags`, rather than the complete official boundary rule or arbitrary Conformance rules.
- Selected-project checks inspect only that project's direct outgoing dependencies. Static, dynamic, and implicit project dependencies follow the same constraints.
- A source project with outgoing dependencies must match at least one constraint; otherwise the check fails. There are no project exclusions or dependency-pair exceptions.
- Tag matching supports exact strings, the universal `*`, basic `*` globs, and regular expressions. Invalid matching syntax is a configuration error.
- Results are human-readable by default, with optional JSON file output for other tools.
- An initialization generator creates the configuration template and configures the root-project target; consumers then supply their own tag constraints.
- Full behavioral parity with Nx Conformance 23.2.0 is not yet established. In particular, official behavior for tagged sources matching no constraints and transitive deny checks remains unverified; the explicit decisions above must not be presented as verified official behavior.

## Reference

- [Nx Conformance overview](https://nx.dev/docs/reference/conformance/overview)
- [Nx tag-based boundary configuration](https://nx.dev/docs/features/enforce-module-boundaries)

This record captures the design decisions accepted when implementation was requested.
