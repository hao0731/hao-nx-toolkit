---
status: accepted
---

# Root-inferred project boundary targets

Replace [ADR 0002](./0002-native-affected-project-boundary-checks.md)'s persisted per-project target setup with an Nx inference plugin registered once in root `nx.json.plugins`. It dynamically contributes `check-boundaries` targets, preserving native `nx affected -t check-boundaries` while allowing new matching projects to participate without rerunning init or modifying their configuration files. Keep the explicit root `check-boundaries-all` target for workspace boundary checks.

## Consequences

- Discover `project.json` and actual package-manager workspace `package.json` files by default, following workspace exclusions. Optional root plugin `projectMarkers` globs extend discovery; each marker's containing directory is the project root. The callback is triggered by root `nx.json`, so Nx registration filters must include that file.
- Inference cannot inspect the final set of projects produced by every other plugin. Configurable markers let consumers align discovery with those plugins without maintaining a root list for each individual project. Init and `check-boundaries-all` compare discovered roots against the complete project graph and fail for uncovered projects; init validates before writing. Ordinary Nx graph, build, and affected commands remain available. CI must include the full check to detect coverage gaps that affected selection can skip.
- Use normal Nx target defaults and project/plugin override precedence. Do not enforce executor identity, reject selector conflicts, or force inferred settings over user configuration. Coverage is based on discovery rules and active registration, so a same-name custom target remains allowed. Overrides can change the default task scope, inputs, and caching behavior.
- Retain the shared policy input, complete graph evaluation, direct outgoing dependency scope, disabled caching defaults, and parallel report naming from ADR 0002. The root full-check executor still accepts an explicit project selector; coverage validation remains workspace-wide even when that selector narrows dependency evaluation.
- Treat this as a breaking change without migration or legacy cleanup. Init preserves policy bytes and authored targets and writes only root files. Old persisted targets may override inference until consumers remove them.
- Reuse Nx's internal discovery and registration-filtering helpers behind `@nx/devkit/internal`, rather than duplicating workspace membership rules or mutating another plugin's graph results. The installed-package compatibility matrix covers Nx 23.2.0, 23.2.1, and 23.3.0; the peer range alone is not evidence for other versions.

The tag policy and evaluation/report semantics from ADR 0001 remain unchanged. This decision supersedes ADR 0002's per-project writes, rerun-init requirement for new projects, conflict rejection, and legacy migration, while retaining its native affected design.
