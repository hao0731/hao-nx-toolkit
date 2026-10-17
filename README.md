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

| Hao Nx Toolkit version         | Declared Nx range | Verified Nx versions         |
| ------------------------------ | ----------------- | ---------------------------- |
| `0.0.1` (development)          | `^23.2.0`         | `23.2.0`, `23.2.1`, `23.3.0` |
| `0.1.0` (published 2026-10-17) | `^23.2.0`         | `23.2.0`, `23.2.1`, `23.3.0` |
| `0.2.0` (publication pending)  | `^23.2.0`         | `23.2.0`, `23.2.1`, `23.3.0` |

The verified versions have passed installed-package E2E tests for both plugins. CI runs this exact matrix on every pull request and main-branch push. Other stable versions in the declared range are eligible for installation, but add them to the matrix and pass the checks before describing them as verified. Repository development, builds, and the plugins' `@nx/devkit` dependency remain pinned to the Nx 23.2.0 baseline.

## Releases

Version `0.2.0` is being prepared. See its [release notes](./docs/releases/0.2.0.md) for the breaking Project Boundary setup change.

See the [release guide](./docs/releasing.md) for validation, package inspection, and the manual release process. The [0.1.0 release notes](./docs/releases/0.1.0.md) and [changelog](./CHANGELOG.md) describe the first public release, published to npm on **2026-10-17 (Asia/Taipei)**. Install [@hao-nx-toolkit/golang@0.1.0](https://www.npmjs.com/package/@hao-nx-toolkit/golang/v/0.1.0) and [@hao-nx-toolkit/project-boundary@0.1.0](https://www.npmjs.com/package/@hao-nx-toolkit/project-boundary/v/0.1.0). Both packages have `latest` set to `0.1.0`. Registry downloads match the verified release tarballs; a public-registry consumer smoke test passed on Nx 23.2.0. The public [GitHub Release](https://github.com/hao0731/hao-nx-toolkit/releases/tag/v0.1.0) includes both verified package tarballs and `SHA256SUMS`.

## License

[MIT](./LICENSE). Each published package includes its own copy of the license.
