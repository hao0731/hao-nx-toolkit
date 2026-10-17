## 0.1.0 (2026-10-17)

Locally prepared; unpublished. The date records local preparation, not npm publication.

### 🚀 Features

- add tag-based project boundary checks with native affected support ([#1](https://github.com/hao0731/hao-nx-toolkit/pull/1))
- add publishable Golang handler generator ([#2](https://github.com/hao0731/hao-nx-toolkit/pull/2))
- **golang:** add service, repository, and config generators ([#3](https://github.com/hao0731/hao-nx-toolkit/pull/3))
- **golang:** add model generator with optional factory ([#4](https://github.com/hao0731/hao-nx-toolkit/pull/4))

### Compatibility and packaging

- Both plugins declare Nx `^23.2.0` (stable `>=23.2.0 <24.0.0`), with installed-package E2E verified on `23.2.0`, `23.2.1`, and `23.3.0`.
- Project Boundary isolates target-default integration through `@nx/devkit/internal`; this remains an internal API dependency guarded by the version matrix.
- Packages include MIT licensing, npm metadata, and public registry settings; repository builds and `@nx/devkit` stay pinned to `23.2.0`. ([#5](https://github.com/hao0731/hao-nx-toolkit/pull/5))

See the [prepared release notes](./docs/releases/0.1.0.md) for scope and limitations.

### ❤️ Thank You

- hao0731 @hao0731
