# @hao-nx-toolkit/project-boundary

Keep dependencies between your Nx projects within the boundaries you define. This plugin reads the Nx project graph and checks each project's dependencies against rules based on project tags.

For example, you can allow a store application to depend on shared libraries while preventing production projects from depending on testing utilities. Checks run as Nx tasks, so you can use them locally and in CI.

The plugin supports workspace-wide, per-project, and affected checks, plus optional JSON reports. It runs independently of Nx Conformance and does not require an Enterprise license.

## Compatibility

This version requires **Nx 23.2.0 exactly**. See the [toolkit version compatibility table](../../README.md#nx-version-compatibility) when choosing a version for your workspace.

## Install and initialize

Run these commands in your existing Nx workspace:

```bash
pnpm add -D @hao-nx-toolkit/project-boundary
pnpm nx g @hao-nx-toolkit/project-boundary:init
```

When installing at the root of a pnpm workspace, use `pnpm add -Dw @hao-nx-toolkit/project-boundary` for the first command.

Initialization:

- Creates `project-boundary.config.json` at the workspace root with a schema reference for editor support.
- Adds a `check-boundaries` target to every existing project.
- Adds a `check-boundaries-all` target to the root project and prints the command to run it.
- Preserves existing boundary rules and unrelated targets, including inferred build and test targets.

The generated file starts with `depConstraints: []`. **Configure your rules before running checks**: a project with outgoing project dependencies fails if no rule matches it.

Rerun the initializer after adding projects. It includes the new projects and retains your existing rules. If a boundary target already uses another executor or has a conflicting project selector, initialization fails before writing changes.

## Configure boundary rules

Edit `project-boundary.config.json` at the workspace root. A rule selects the **source project** (the project that depends on another project) and defines which **target projects** it may depend on.

### Example: separate store, shared, and testing code

First, assign tags in your projects' Nx configuration. The following example uses three projects:

| Project      | Tags                              |
| ------------ | --------------------------------- |
| `store-app`  | `scope:store`, `role:production`  |
| `shared-lib` | `scope:shared`, `role:production` |
| `test-utils` | `scope:shared`, `role:testing`    |

For a project configured in `project.json`, add a `tags` field. For example, `store-app` uses:

```json
{
  "tags": ["scope:store", "role:production"]
}
```

For projects configured through `package.json`, put the same array in `nx.tags`.

Tag names are your choice; the plugin does not require a particular tag taxonomy.

Then configure these rules:

```json
{
  "$schema": "./node_modules/@hao-nx-toolkit/project-boundary/dist/config-schema.json",
  "depConstraints": [
    {
      "sourceTag": "scope:store",
      "onlyDependOnProjectsWithTags": ["scope:store", "scope:shared"]
    },
    {
      "sourceTag": "scope:shared",
      "onlyDependOnProjectsWithTags": ["scope:shared"]
    },
    {
      "allSourceTags": ["scope:*", "role:production"],
      "notDependOnProjectsWithTags": ["role:testing"]
    }
  ]
}
```

With these tags and rules:

| Dependency                 | Result | Reason                                                                                                    |
| -------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `store-app` → `shared-lib` | Pass   | Store projects may depend on shared projects, and the target is production code.                          |
| `shared-lib` → `store-app` | Fail   | Shared projects may only depend on shared projects.                                                       |
| `store-app` → `test-utils` | Fail   | The target has an allowed scope, but production projects cannot depend on projects tagged `role:testing`. |

### Configuration fields

The root object requires a `depConstraints` array. `$schema` is optional and must be a string; the generated reference provides editor completion and validation.

Each rule accepts these fields:

| Field                          | Value                           | Meaning                                                              |
| ------------------------------ | ------------------------------- | -------------------------------------------------------------------- |
| `sourceTag`                    | Nonempty string                 | Apply the rule when a source project matches this tag pattern.       |
| `allSourceTags`                | Nonempty array of tag patterns  | Apply the rule when the source matches every pattern in the array.   |
| `onlyDependOnProjectsWithTags` | Array of tag patterns, optional | Each dependency target must match at least one pattern in the array. |
| `notDependOnProjectsWithTags`  | Array of tag patterns, optional | Reject any dependency target that matches a pattern in the array.    |

Use **exactly one** of `sourceTag` or `allSourceTags` in each rule. Every tag pattern must be a nonempty string. Unknown fields and invalid patterns fail the check.

All rules matching a source project apply together: every matching rule must pass. A denied target fails even if an allowed pattern also matches it.

Omitting an allowed or denied list adds no restriction of that kind. An empty `onlyDependOnProjectsWithTags: []` allows no project dependencies; an empty `notDependOnProjectsWithTags: []` forbids none. A rule with only a source selector imposes no target restriction.

A source with outgoing project dependencies must match at least one rule. A project with no outgoing project dependencies, or only external npm dependencies, does not need a matching rule.

### Supported tag patterns

Patterns work in both source selectors and target lists:

| Pattern type       | Example                     | Meaning                                                                                           |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------------------------- |
| Exact tag          | `scope:store`               | Matches that tag exactly.                                                                         |
| Universal          | `*`                         | Matches every project, including projects without tags.                                           |
| Basic glob         | `scope:*`                   | Matches a whole tag starting with `scope:`. Only `*` is a wildcard; `?` and brackets are literal. |
| Regular expression | `/^scope:(store\|shared)$/` | Matches a tag using a JavaScript regular expression enclosed in slashes, without flags.           |

Regular expressions use search matching; add `^` and `$` when you want to match the whole tag. Malformed expressions fail validation even if their rule would not match any selected project.

## Run checks

### Entire workspace

Use the root project name printed by initialization in place of `<root-project>`:

```bash
pnpm nx run <root-project>:check-boundaries-all
```

This checks every project's direct outgoing project dependencies. If you need to find project names, run `pnpm nx show projects`.

### One project

```bash
pnpm nx run store-app:check-boundaries
```

This checks dependencies originating from `store-app`. It does not check projects that depend on `store-app`, or dependencies originating from its downstream projects.

### Affected projects and CI

To check projects affected by committed changes:

```bash
pnpm nx affected -t check-boundaries --base=main --head=HEAD --output-style=static
```

Replace `main` with your comparison branch or commit. For current uncommitted changes, use:

```bash
pnpm nx affected -t check-boundaries --uncommitted --output-style=static
```

Nx also selects reverse dependents, so changing a dependency target's tags rechecks projects that depend on it. Changes to the shared configuration select all initialized projects. Checks run without task caching and read the current workspace; staged-only snapshot validation is not supported.

Checks return a nonzero exit code for boundary violations, invalid configuration, unknown project names, graph failures, or report-writing failures. You can use the command's exit code to fail CI.

## Export JSON reports

Add `outputFile` after the `--` separator:

```bash
pnpm nx run <root-project>:check-boundaries-all -- --outputFile=reports/boundaries.json
```

Paths are relative to the workspace root or absolute. Parent directories are created automatically. Reports are written for successful checks, violations, and configuration or runtime errors when the output path is valid and writable. The report cannot overwrite `project-boundary.config.json`.

For parallel project checks, use a separate file for each project:

```bash
pnpm nx affected -t check-boundaries --base=main --head=HEAD --output-style=static -- --outputFile='reports/{boundaryProjectName}.json'
```

`{boundaryProjectName}` expands to `project-` followed by a SHA-256 digest of the selected project name, giving each project a safe, distinct filename. The report retains the original project name. Use this token for parallel reports; Nx interpolates `{projectName}` before the plugin runs. A literal path works for a single check, but parallel checks sharing that path can overwrite each other's reports. Workspace-wide reports use a literal path because there is no selected project.

A successful workspace report looks like this:

```json
{
  "version": 1,
  "scope": { "kind": "workspace" },
  "success": true,
  "violations": [],
  "errors": []
}
```

Per-project reports use `scope: { "kind": "project", "project": "store-app" }`. Report entries have these kinds:

| Entry     | Kind                | Meaning                                                     |
| --------- | ------------------- | ----------------------------------------------------------- |
| Violation | `unmatched-source`  | A source with project dependencies has no matching rule.    |
| Violation | `disallowed-target` | A target does not match a rule's allowed patterns.          |
| Violation | `forbidden-tag`     | A target matches a rule's denied patterns.                  |
| Error     | `configuration`     | Invalid configuration or options.                           |
| Error     | `runtime`           | A failure while running the check, such as a graph failure. |
| Error     | `report`            | A failure writing the report; the file may be unavailable.  |

Violations identify the source and its tags. Target violations also include the target, its tags, the dependency type, the matching rule, and its zero-based `constraintIndex`. Errors include a message. Report ordering is stable.

Always check the command's exit code as well as the report. Configuration errors replace a previous success report with a failed report when writing succeeds; a report-writing failure may leave no report file.

## Advanced project selection

You can select a source project through the workspace target:

```bash
pnpm nx run <root-project>:check-boundaries-all -- --project=store-app --outputFile=reports/store-app.json
```

The `--` separator before `--project` is required so Nx forwards the option to the plugin. Per-project `check-boundaries` targets already select their own source project.

## Check scope and limitations

- Checks cover direct static, dynamic, and implicit project dependencies from the Nx project graph. External npm packages are excluded.
- Allowed and denied rules evaluate direct targets. They do not walk transitive dependencies.
- Dependency exceptions, project exclusions, cycle checks, buildable-project checks, and tag cardinality validation are not provided.
- The plugin does not execute arbitrary Nx Conformance rules or claim complete behavioral equivalence with Nx Conformance.
