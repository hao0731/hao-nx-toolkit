## 0.2.0 (2026-10-18)

Published to npm on 2026-10-18 (Asia/Taipei). Both packages have `latest` set to `0.2.0`; registry tarballs match the audited artifacts and the registry consumer smoke test passed. See the [release notes](./docs/releases/0.2.0.md) for the dependency-audit limitation.

### 🚀 Features

- ⚠️ **project-boundary:** infer boundary targets from root configuration ([#8](https://github.com/hao0731/hao-nx-toolkit/pull/8))

### ⚠️ Breaking Changes

- **project-boundary:** targets are inferred from root plugin registration instead of written to each project. Existing target declarations are not migrated or removed and may override inference. Run the full workspace check in CI to catch uncovered projects; affected checks can skip projects without an inferred target.

Both packages share version `0.2.0`; Golang generator behavior is unchanged. See the [release notes](./docs/releases/0.2.0.md) for setup and compatibility.

### ❤️ Thank You

- hao0731 @hao0731

## 0.1.0 (2026-10-17)

Published to npm on 2026-10-17 (Asia/Taipei): [@hao-nx-toolkit/golang@0.1.0](https://www.npmjs.com/package/@hao-nx-toolkit/golang/v/0.1.0) and [@hao-nx-toolkit/project-boundary@0.1.0](https://www.npmjs.com/package/@hao-nx-toolkit/project-boundary/v/0.1.0). Both packages have `latest` set to `0.1.0`.

### 🚀 Features

- add tag-based project boundary checks with native affected support ([#1](https://github.com/hao0731/hao-nx-toolkit/pull/1))
- add publishable Golang handler generator ([#2](https://github.com/hao0731/hao-nx-toolkit/pull/2))
- **golang:** add service, repository, and config generators ([#3](https://github.com/hao0731/hao-nx-toolkit/pull/3))
- **golang:** add model generator with optional factory ([#4](https://github.com/hao0731/hao-nx-toolkit/pull/4))

### Compatibility and packaging

- Both plugins declare Nx `^23.2.0` (stable `>=23.2.0 <24.0.0`), with installed-package E2E verified on `23.2.0`, `23.2.1`, and `23.3.0`.
- Project Boundary isolates target-default integration through `@nx/devkit/internal`; this remains an internal API dependency guarded by the version matrix.
- Packages include MIT licensing, npm metadata, and public registry settings; repository builds and `@nx/devkit` stay pinned to `23.2.0`. ([#5](https://github.com/hao0731/hao-nx-toolkit/pull/5))

See the [release notes](./docs/releases/0.1.0.md) for scope and limitations. The public [GitHub Release](https://github.com/hao0731/hao-nx-toolkit/releases/tag/v0.1.0) includes the two verified tarballs and `SHA256SUMS`; the pushed tag identifies main commit `ac01c48`, which adds publication-status documentation to the artifact build commit.

### Publication verification

Registry downloads are byte-identical to the audited tarballs built from artifact build commit [`615a781`](https://github.com/hao0731/hao-nx-toolkit/commit/615a781bbae0092367822fd48108f03d63f93876). A strict-peer public-registry install and smoke test passed on Nx 23.2.0, including package entrypoints, Go model generation and compilation, and boundary initialization. Workspace and per-project boundary checks passed; the workspace JSON report recorded `success: true`, no violations, and no errors. Before publication, 199 unit tests and 78 installed-package E2E checks passed across Nx 23.2.0, 23.2.1, and 23.3.0; this matrix is separate from the registry smoke test.

### ❤️ Thank You

- hao0731 @hao0731
