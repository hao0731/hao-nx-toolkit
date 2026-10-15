# Hao Nx Toolkit

A collection of practical Nx plugins for your workspace. Install the plugins you need to extend Nx with tools for everyday monorepo workflows.

## Available plugins

| Plugin                             | What it does                                                                                                      | Documentation                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `@hao-nx-toolkit/project-boundary` | Checks tag-based project dependency boundaries using the Nx project graph, independently of Nx Conformance.       | [README](./packages/project-boundary/README.md) |
| `@hao-nx-toolkit/golang`           | Generates Go model, config, service, repository, and handler skeletons for framework-free code, Gin, and Echo v5. | [README](./packages/golang/README.md)           |

See each plugin's README for installation, configuration, and usage instructions.

## Nx version compatibility

Hao Nx Toolkit plugins share a single toolkit version. **Nx 23.2.0 exactly is supported**; the plugin peer dependencies require this exact version. Other Nx versions have not been verified. The table below lists compatibility and release status for each toolkit version.

| Hao Nx Toolkit version        | Supported Nx version |
| ----------------------------- | -------------------- |
| `0.0.1` (development)         | `23.2.0`             |
| `0.1.0` (planned, unreleased) | `23.2.0`             |

Choose the toolkit version that matches your workspace's Nx version. Support for newer Nx versions will be recorded in this table as it becomes available.

## Releases

See the [release guide](./docs/releasing.md) for validation, package inspection, and the manual release process. The [draft 0.1.0 release notes](./docs/releases/0.1.0.md) describe the planned first public release; package manifests remain at development version `0.0.1` until release preparation.

## License

[MIT](./LICENSE). Each published package includes its own copy of the license.
