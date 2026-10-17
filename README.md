# Hao Nx Toolkit

A collection of practical Nx plugins for your workspace. Install the plugins you need to extend Nx with tools for everyday monorepo workflows.

## Available plugins

| Plugin                             | What it does                                                                                                      | Documentation                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `@hao-nx-toolkit/project-boundary` | Checks tag-based project dependency boundaries using the Nx project graph, independently of Nx Conformance.       | [README](./packages/project-boundary/README.md) |
| `@hao-nx-toolkit/golang`           | Generates Go model, config, service, repository, and handler skeletons for framework-free code, Gin, and Echo v5. | [README](./packages/golang/README.md)           |

See each plugin's README for installation, configuration, and usage instructions.

## Nx version compatibility

Hao Nx Toolkit plugins share a single toolkit version. Both plugins declare **Nx `^23.2.0`** as their peer range: stable versions `>=23.2.0 <24.0.0`. Prerelease versions are outside this range.

| Hao Nx Toolkit version        | Declared Nx range | Verified Nx versions         |
| ----------------------------- | ----------------- | ---------------------------- |
| `0.0.1` (development)         | `^23.2.0`         | `23.2.0`, `23.2.1`, `23.3.0` |
| `0.1.0` (planned, unreleased) | `^23.2.0`         | `23.2.0`, `23.2.1`, `23.3.0` |

The verified versions have passed installed-package E2E tests for both plugins. CI runs this exact matrix on every pull request and main-branch push. Other stable versions in the declared range are eligible for installation, but add them to the matrix and pass the checks before describing them as verified. Repository development, builds, and the plugins' `@nx/devkit` dependency remain pinned to the Nx 23.2.0 baseline.

## Releases

See the [release guide](./docs/releasing.md) for validation, package inspection, and the manual release process. The [draft 0.1.0 release notes](./docs/releases/0.1.0.md) describe the planned first public release; package manifests remain at development version `0.0.1` until release preparation.

## License

[MIT](./LICENSE). Each published package includes its own copy of the license.
