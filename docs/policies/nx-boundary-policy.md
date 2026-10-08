# Nx boundary policy

This document defines Nx tags and dependency constraints for this repository of plugins serving multiple language ecosystems and workspace-wide needs. The rules below are required policy; the enforcement status records only what has been established from repository evidence.

Inspect `nx.json`, `eslint.config.mjs`, and the actual project, task, and CI configuration to determine automated coverage. Declaring tags or documenting a constraint does not enforce it. Keep this policy and applicable configuration aligned when changing tags or constraints; configuration changes are separate implementation work.

## Boundary tags

Every non-root Nx project must have exactly one classification tag and exactly one role tag. This applies to plugins, internal libraries, E2E projects, and development tools.

Classification tags are mutually exclusive across the `scope:shared`, `kind:workspace`, and `lang:*` choices. Their different prefixes do not make them independent dimensions. For example, a project must not carry both `kind:workspace` and `lang:golang`.

Nx-inferred `npm:private` is permitted as package-manager metadata when the project package declares `private: true`. It grants no dependency permissions and does not count toward classification or role cardinality. Additional architectural tags require an update to this policy and applicable enforcement configuration.

### Classification tags

| Tag               | Meaning                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
| `scope:shared`    | Reusable, language-neutral support that can be shared across plugin classifications. |
| `kind:workspace`  | Plugins serving workspace-wide concerns, and their dedicated libraries and tools.    |
| `lang:golang`     | Plugins serving the Golang ecosystem, and their dedicated libraries and tools.       |
| `lang:typescript` | Plugins serving the TypeScript ecosystem, and their dedicated libraries and tools.   |

`lang:*` describes the ecosystem a project serves, not its implementation language. A Golang plugin implemented in TypeScript is classified as `lang:golang`. A library shared by several Golang plugins remains `lang:golang` when its responsibility is Golang-specific; reuse alone does not make it `scope:shared`.

Workspace-wide responsibility does not grant access to every language classification. Code reusable across classifications belongs in `scope:shared` only when its responsibility is genuinely language-neutral.

### Role tags

| Tag               | Meaning                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `role:production` | Plugins, general-purpose libraries, and non-test development tools. |
| `role:testing`    | E2E projects, test-only libraries, fixtures, and test-only tools.   |

Classify the purpose of the whole Nx project. Unit tests inside a production project do not change its role to `role:testing`. A separately modeled test-only project must use `role:testing`.

### Root project exception

The repository root project, currently `@org/source`, is exempt from classification and role cardinality. It exists for repository management and must not become a shared library that other projects depend on. Move reusable code into an appropriately tagged non-root project.

### Extending the taxonomy

Only the classification and role values listed above are currently permitted. Supporting another language requires updating this policy and the applicable enforcement configuration together. Each new `lang:<language>` classification follows the same dependency model: shared projects and projects of that same language only, subject to role restrictions.

New tag families, role values, or exceptions also require explicit policy and configuration updates. Do not add multiple classification tags to obtain broader dependency permissions.

## Allowed dependencies

Every dependency must satisfy both tables below. Unlisted target classifications and roles are forbidden. These permissions apply to Nx-project dependencies, including source imports and explicit project or target linkage; they do not authorize deep imports into another project's internals.

### Classification constraints

| Source classification | Allowed target classifications    |
| --------------------- | --------------------------------- |
| `scope:shared`        | `scope:shared`                    |
| `kind:workspace`      | `scope:shared`, `kind:workspace`  |
| `lang:golang`         | `scope:shared`, `lang:golang`     |
| `lang:typescript`     | `scope:shared`, `lang:typescript` |

Different plugins in the same classification may depend on one another. Shared projects must not depend on workspace or language-specific projects. Language-specific projects must not depend on another language classification or on `kind:workspace`; workspace projects must not depend on language-specific projects.

### Role constraints

| Source role       | Allowed target roles              |
| ----------------- | --------------------------------- |
| `role:production` | `role:production`                 |
| `role:testing`    | `role:production`, `role:testing` |

A production project must not depend on a testing project, including test-only helpers or fixtures. The same classification does not override this restriction. A testing role does not override classification restrictions.

### Public APIs and cycles

Cross-project source imports must use the target project's public API. Do not deep-import implementation files to bypass its public boundary. Project dependencies must not form cycles, even when each individual edge would satisfy both tag tables.

Nx applies all matching dependency constraints together with AND. Tags inside one `onlyDependOnLibsWithTags` list are alternatives, but separate matching constraints must all pass. Adding a source tag does not union dependency permissions. Enforcement configuration must preserve this distinction when adding role constraints.

## Testing interpretation

An E2E project uses the classification of its plugin under test and `role:testing`. Test-only libraries use the classification appropriate to their responsibility: language-specific helpers belong to that language, while language-neutral reusable helpers may be `scope:shared`.

An E2E project's dependency on its plugin may represent project or target linkage rather than a source import. Any source import must still use a permitted public API. Product projects must never depend on E2E projects or other test-only projects.

There is no cross-classification integration-test exception. A testing project must not depend on both workspace and Golang projects, or on projects from different language classifications. Such a requirement must first be addressed by updating this policy and its enforcement configuration. Neither `role:testing` nor `scope:shared` provides a bypass.
