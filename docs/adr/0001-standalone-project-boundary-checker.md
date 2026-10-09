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

## Execution and verification

The root `check-boundaries` target uses `@hao-nx-toolkit/project-boundary:check` with caching disabled. On Nx 23.2.0, project selection must be forwarded after the CLI separator: `pnpm nx run <root-project>:check-boundaries -- --project=my-app`. Without the separator, Nx consumes `--project` as its own target-selection option.

The initializer preserves existing policy bytes, keeps matching target options, and rejects conflicting executors. Its empty initial constraint list grants no permissions; consumers explicitly define their tag policy. Source-only constraints impose no target restriction. An empty allow list permits no project targets, while an empty deny list forbids none. Regex syntax is `/expression/` without flags; all regex patterns are validated before evaluating the selected graph scope.

Reports use version 1 with scope, success, violations, and errors. Configuration failures update an existing report to a failed result when output remains writable. Report write failures fail the task. The input configuration is protected from report output collisions.

The dedicated `project-boundary-e2e` project uses `kind:workspace` and `role:testing`. It installs a packed package into a temporary Nx 23.2.0 consumer and exercises public CLI behavior against actual static, dynamic, and implicit project graph edges. Its isolated configuration avoids registry setup that changes repository package versions or global npm settings. Both E2E entry points depend on the plugin build and run without task caching.
