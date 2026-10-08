# Project boundary

Check tag-based project dependency boundaries using the Nx project graph. This plugin runs independently of Nx Conformance and does not require its runtime or Enterprise license. The supported baseline is Nx 23.2.0; this is not a claim of complete Conformance behavioral compatibility.

## Install and initialize

```bash
pnpm add -D @hao-nx-toolkit/project-boundary
pnpm nx g @hao-nx-toolkit/project-boundary:init
```

In a pnpm workspace, add `-w` to the installation command when installing at its root. Initialization adds a `check-boundaries` target to every existing Nx project and a separate `check-boundaries-all` target to the root project and creates `project-boundary.config.json` with an editor schema reference. It preserves existing configuration bytes and unrelated targets. A conflicting target using another executor is an error. Repeating initialization includes newly added projects, keeps existing non-scope target options, and sets `cache: false` so graph, tags, configuration, and report changes are checked on every run.

The initial `depConstraints: []` grants no permissions: sources with outgoing project dependencies fail until rules cover them. Fill in your policy before using the check in CI.

Use the root project name printed by initialization. You can also find it with `pnpm nx show projects` and inspect `pnpm nx show project <root-project> --json`.

```bash
# Entire workspace
pnpm nx run <root-project>:check-boundaries-all

# One project's direct outgoing dependencies
pnpm nx run my-app:check-boundaries

# Optional JSON report, relative to the workspace root or absolute
pnpm nx run <root-project>:check-boundaries-all -- --outputFile=reports/boundaries.json
```

Each project target fixes `options.project` to its own project name. Native affected execution uses Nx's selection and dependent propagation:

```bash
pnpm nx affected -t check-boundaries --base=main --head=HEAD --output-style=static
```

Nx also selects reverse dependents: changing a dependency target's tags rechecks its upstream sources. The executor retains the complete project graph to evaluate unchanged dependency targets. Targets include the shared configuration file as a workspace input, so policy changes select all configured projects even though caching is disabled. Rerun initialization after adding projects. Existing generated root workspace targets migrate to `check-boundaries-all`; conflicting executors or project selectors fail before any writes.

`--base=main --head=HEAD` selects committed changes. For current uncommitted changes, use Nx's `--uncommitted` selection. Checks read the current workspace; staged-only snapshot validation is not provided.

Initialization stores minimal target configuration for inferred projects and preserves their inferred build/test targets.

When overriding selection on the workspace target, the `--` separator before `--project` is required: Nx otherwise treats it as its own project-selection argument. You can combine `--project` and `--outputFile` after the separator.

## Shared configuration

```json
{
  "$schema": "./node_modules/@hao-nx-toolkit/project-boundary/dist/config-schema.json",
  "depConstraints": [
    {
      "sourceTag": "scope:store",
      "onlyDependOnProjectsWithTags": ["scope:store", "scope:shared"]
    },
    {
      "allSourceTags": ["scope:*", "role:production"],
      "notDependOnProjectsWithTags": ["role:testing"]
    }
  ]
}
```

Each constraint has exactly one selector: `sourceTag`, or a nonempty `allSourceTags` array. All entries in `allSourceTags` must match the source. All constraints matching a source apply together with AND; entries inside one allowed-target list are alternatives (OR). A target matching any denied pattern fails even when an allowed pattern also matches.

Both target lists are optional. A matching source-only constraint imposes no target restriction. An empty `onlyDependOnProjectsWithTags` allows no project targets; an empty `notDependOnProjectsWithTags` forbids none.

Tag patterns support:

- Exact strings such as `scope:store`.
- Universal `*`, including projects without tags.
- Basic `*` globs such as `scope:*`, anchored to the entire tag. Every other character is literal; `?` and brackets are not glob operators.
- Slash-delimited JavaScript regular expressions, such as `/^scope:(store|shared)$/`, without flags. Regex matches follow JavaScript search semantics; use anchors when a full-tag match is needed.

Malformed regular expressions are configuration errors even in constraints that do not match any selected project. Unknown configuration fields, constraint fields, and executor options are errors. The optional root `$schema` annotation must be a string.

## Scope and failures

Workspace checks inspect every project's direct outgoing project dependencies. Project checks inspect only the selected source: incoming dependencies and edges originating from downstream projects are outside that scope. Allowed and denied tags are evaluated against each direct target; deny checks do not walk transitive dependencies.

Static, dynamic, and implicit edges all follow the same rules. External npm packages are excluded. A source with outgoing project dependencies that matches no constraint fails. An isolated source, or one depending only on external packages, does not fail merely because no constraint covers it.

Violations return a nonzero exit code and show the source, target, tags, and violated constraint. Missing or invalid configuration, unknown selected projects, graph failures, and report-writing failures also fail the task. Report output cannot overwrite the input configuration.

The first version does not provide dependency exceptions, project exclusions, cycle checks, buildable-project checks, or tag cardinality validation. It does not execute arbitrary Conformance rules. Its explicit unmatched-source and direct-only deny behavior should not be presented as verified equivalence with official Conformance.

## JSON reports

`outputFile` writes reports on successful checks, violations, and configuration/runtime errors. Parent directories are created as needed. Configuration errors replace a previous success report with a failed report; callers must also check the command's exit code, particularly if the output path cannot be written.

For parallel project targets, give each source its own report path:

```bash
pnpm nx affected -t check-boundaries --base=main --head=HEAD --output-style=static -- --outputFile='reports/{boundaryProjectName}.json'
```

`{boundaryProjectName}` requires a selected project and expands to `project-` followed by the name's full lowercase SHA-256 digest of its UTF-8 encoding (a 72-character component). The bounded digest makes long or scoped names and path separators safe and distinguishes names even on case-insensitive filesystems. The JSON scope retains the original project name. Nx owns and interpolates `{projectName}` before CLI execution; use the plugin-owned `{boundaryProjectName}` token for safe report filenames. Literal paths still work for single checks; sharing a literal output path across parallel tasks can overwrite reports. Full workspace reports use a literal path unless a source project is explicitly selected.

Reports have `version: 1`, a `scope` (`{ "kind": "workspace" }` or `{ "kind": "project", "project": "my-app" }`), `success`, `violations`, and `errors`. Ordering is stable across graph insertion order.

Violation kinds are `unmatched-source`, `disallowed-target`, and `forbidden-tag`. Each has `source` and `sourceTags`. Target violations also contain `target`, `targetTags`, `dependencyType`, zero-based `constraintIndex`, and the original `constraint`. Error entries contain `kind` (`configuration`, `runtime`, or `report`) and `message`. A report-writing error is printed to the terminal and fails the task; it may prevent producing a report file.

## Repository verification

```bash
pnpm nx run-many -t test lint typecheck build -p project-boundary
pnpm nx run project-boundary-e2e:e2e --skipNxCache
```

The E2E project packs and installs the published package contents into a temporary Nx 23.2.0 workspace, exercises real Nx commands and temporary Git commits for native affected selection, target tag propagation, shared-policy changes, inferred project initialization, and parallel JSON reports, and cleans up its workspace, archive, and isolated package store. It requires access to the npm registry on a cold cache.
