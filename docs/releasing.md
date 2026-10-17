# Releasing Hao Nx Toolkit

The first public release, `0.1.0`, was published to npm on **2026-10-17 (Asia/Taipei)**: [@hao-nx-toolkit/golang@0.1.0](https://www.npmjs.com/package/@hao-nx-toolkit/golang/v/0.1.0) and [@hao-nx-toolkit/project-boundary@0.1.0](https://www.npmjs.com/package/@hao-nx-toolkit/project-boundary/v/0.1.0). Both packages have `latest` set to `0.1.0`. See the [release notes](./releases/0.1.0.md).

**Do not rerun version preparation or publication for `0.1.0`.** The first-release commands below are a historical recipe. Both packages are fully published; a later release must use a new version. Only these two projects belong to Nx's fixed release group; the private repository root and E2E projects are excluded.

The published artifacts were built from commit [`615a781`](https://github.com/hao0731/hao-nx-toolkit/commit/615a781bbae0092367822fd48108f03d63f93876). Registry downloads match the audited tarballs byte for byte. The local annotated `v0.1.0` tag stays on that commit; documentation updates do not move it. Pushing the release tag and creating a GitHub Release require separate authorization and are not automatic consequences of a documentation PR.

## Historical first-release prerequisites

- Use a clean checkout containing all reviewed release preparation changes. Commit those changes before preparing the local release. Confirm the branch and `git status --short`, and check that the intended `v0.1.0` tag does not already exist locally or on the release remote.
- Match CI: Node.js 24, pnpm 11.20.0, and Go 1.26.2. The workspace pins Nx 23.2.0; use `pnpm nx`, not a global Nx installation.
- Allow access to the npm registry and Go module proxy. E2E tests install packed packages into isolated consumers with Nx 23.2.0, 23.2.1, and 23.3.0 and compile generated Go with Gin v1.12.0 and Echo v5.0.0. Go is needed for these tests, although running the Go generators alone does not require it.
- Own or have publishing permission for the npm `@hao-nx-toolkit` scope and both package names. A GitHub repository name does not grant npm scope access. Confirm that neither `0.1.0` package version is already published before starting a new release.
- For interactive publication, have an npm account with 2FA configured and its browser/security-key or one-time-password verification available. Use the current npm CLI with the Node installation. Authenticate only when ready to publish; do not store tokens in repository files. See [npm scoped public package publishing](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) and [npm 2FA](https://docs.npmjs.com/using-two-factor-authentication).

## Historical first-release validation

The commands below record validation before version preparation, starting from `0.0.1`. On a current `0.1.0` checkout, only the checks and package inspection remain repeatable; skip the release dry run and version preparation. They have already completed.

From the repository root on the reviewed preparation branch, compare formatting against the release base, following the pull-request CI check. The example uses `origin/main`; ensure that remote-tracking reference is available and current. If the preparation changes are already merged into main, use the commit before those changes as `--base` instead, so the intended release changes remain in the comparison.

```bash
pnpm install --frozen-lockfile
pnpm nx format:check --base=origin/main --head=HEAD
pnpm nx run-many -t lint build typecheck
pnpm nx run-many -t test --exclude='*-e2e'
for toolkit_nx_version in 23.2.0 23.2.1 23.3.0; do
  TOOLKIT_E2E_NX_VERSION="$toolkit_nx_version" pnpm nx run-many -t e2e -p golang-e2e,project-boundary-e2e || exit $?
done
pnpm nx release 0.1.0 --first-release --skip-publish --dry-run
npm pack ./packages/golang --dry-run --json
npm pack ./packages/project-boundary --dry-run --json
```

The checks match CI's split between static checks, unit suites, and installed-package E2E. CI runs all three consumer versions for both plugins on every pull request and main-branch push, independently of affected-project selection. `TOOLKIT_E2E_NX_VERSION` defaults to `23.2.0`; explicit values must be exact stable versions in `^23.2.0` (`>=23.2.0 <24.0.0`), with invalid values, ranges, and prereleases rejected. The test logs identify the selected version. Strict peer installs and runtime assertions check the actual Nx used by the consumer root, plugin, devkit dependency, and CLI, preventing a nested baseline Nx from masking a compatibility failure. Keep development and build dependencies, including `@nx/devkit`, pinned to the 23.2.0 baseline.

The declared peer range permits other stable Nx 23.x releases; only `23.2.0`, `23.2.1`, and `23.3.0` are currently verified. Add another exact version to CI and pass both suites before listing it as verified. The boundary initializer uses an isolated `@nx/devkit/internal` integration instead of deep Nx source imports. This remains an internal API dependency, so the range is not a guarantee that future internal APIs will remain unchanged.

The first-release dry run must select only `golang` and `project-boundary`, show both changing from `0.0.1` to `0.1.0`, and preview a workspace changelog, release commit, and `v0.1.0` tag. Inspect the output and exit code. Dry runs can build local artifacts and update caches, but must leave package versions and tracked source files unchanged and create no release tag. In restricted environments, set `NX_DAEMON=false NX_ISOLATE_PLUGINS=false` before the Nx commands if plugin workers cannot start.

The configured pre-version command builds just these plugins using pnpm. Inspect both package inventories for `package.json`, `README.md`, `LICENSE`, compiled `dist/index.js`, and `dist/index.d.ts`. Check that all paths referenced by `generators.json` and `executors.json` exist, including generator schemas, Go templates, and the boundary configuration schema. The `LICENSE` in each package must match the root MIT license. Do not include credentials or temporary consumer artifacts.

The publish roots are **`packages/golang` and `packages/project-boundary`**, each containing its manifest and compiled `dist/`. Publishing `dist/` alone omits package metadata and generator/executor registration files. The manifests set public access and `https://registry.npmjs.org/` explicitly.

## Historical local preparation

This transition from `0.0.1` to `0.1.0` is complete. The historical recipe was:

```bash
pnpm nx release 0.1.0 --first-release --skip-publish
```

This changes both manifests to `0.1.0`, updates the lockfile as needed, generates the root `CHANGELOG.md`, and creates a local release commit and `v0.1.0` tag. Nx Release is configured with `git.push: false`, so this step does not push. `--skip-publish` is essential: it skips npm publication. Do not run this non-dry-run step merely to validate the preparation PR.

Review the generated changelog against the release notes, the release commit, the tag, and any lockfile changes. Check the package versions and rerun package inventory inspection and the full checks on the prepared release. If corrections are needed, finalize the corrected release commit and ensure the local tag points to that exact commit before publication. Mark the release notes and compatibility entry as released only after successful publication.

Keep the prepared release checkout and build artifacts available until both packages have been published and verified. Running version preparation again is unnecessary after this point.

## Completed publication from verified tarballs

For `0.1.0`, publication used the already built and audited `.tgz` files from release commit `615a781`, rather than rebuilding or repacking from a later checkout. Each artifact was submitted with `npm publish <verified-tarball.tgz> --access public --registry=https://registry.npmjs.org/`, using its exact audited file:

- `hao-nx-toolkit-golang-0.1.0.tgz`
- `hao-nx-toolkit-project-boundary-0.1.0.tgz`

These are historical publication commands, not instructions to publish `0.1.0` again. Browser-based npm 2FA was completed during publication. Registry visibility can lag during npm scanning; check the version and integrity rather than retrying publication solely because it is not immediately visible.

Both versions and their `latest` tags were verified on the public registry, and the downloaded tarballs were compared byte for byte with the audited artifacts. These read-only checks remain repeatable:

```bash
npm view @hao-nx-toolkit/golang@0.1.0 version dist.integrity --registry=https://registry.npmjs.org/
npm view @hao-nx-toolkit/project-boundary@0.1.0 version dist.integrity --registry=https://registry.npmjs.org/
```

Before publication, 199 unit tests and 78 packed-artifact E2E checks passed across Nx 23.2.0, 23.2.1, and 23.3.0. A separate strict-peer installation from the public registry and smoke test passed on Nx 23.2.0, including package entrypoints, Go model generation and compilation, and boundary initialization. Workspace and per-project boundary checks passed; the workspace JSON report recorded `success: true`, no violations, and no errors. Registry smoke testing on the baseline does not claim a second full three-version registry test run.

## Release tag and GitHub Release

Keep the local annotated `v0.1.0` tag on `615a781`, the commit that produced the published artifacts. Do not move it onto a later publication-status documentation commit. Pushing this tag and creating a GitHub Release are separate future actions requiring authorization; do not perform them automatically after opening or merging the documentation PR. A later GitHub Release can use the reviewed changelog and release notes.

## Registry consumer smoke test

Use a disposable directory outside this repository after both versions are visible. This complements the existing packed-package E2E tests by installing the actual registry versions:

```bash
mkdir hao-nx-toolkit-0.1.0-smoke
cd hao-nx-toolkit-0.1.0-smoke
npm init -y
cat > nx.json <<'JSON'
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "analytics": false,
  "neverConnectToCloud": true
}
JSON
npm install --save-dev --registry=https://registry.npmjs.org/ nx@23.2.0 @hao-nx-toolkit/golang@0.1.0 @hao-nx-toolkit/project-boundary@0.1.0
npx nx g @hao-nx-toolkit/golang:model --name=user --directory=internal/models
npx nx g @hao-nx-toolkit/project-boundary:init
npx nx show projects
```

The explicit `nx.json` establishes the disposable directory as an Nx workspace before either generator runs. Inspect `internal/models/user.go`. Initialization prints the root workspace boundary command; run that command with `--output-style=static` and confirm it succeeds. The initial empty ruleset permits a workspace without project-to-project dependencies. For a consumer with dependencies, configure the rules described in the [boundary README](../packages/project-boundary/README.md) before checking. Delete the disposable workspace after verification.

For inline boundary task diagnostics, pass `--output-style=static` before the executor's `--` separator, for example `npx nx run hao-nx-toolkit-0.1.0-smoke:check-boundaries-all --output-style=static -- --outputFile=reports/boundaries.json` (use the root name printed by initialization). Nx 23.3.0 can otherwise summarize noninteractive failures with a log-file reference. The exit status and JSON report retain their meaning in either output mode.

## Recover a partial publication

This recovery procedure applies only to an incomplete future publication. Both `0.1.0` packages are already published and verified; do not retry their publication.

A release can publish one package successfully and fail on the other. Keep the prepared release commit, tag, package versions, and validated artifacts. Check the exact versions on npm using the `npm view` commands above; distinguish an actual missing version from an authentication, network, or registry error.

Fix the publishing permission, authentication, or network problem and retry the **publish phase only**, without `--first-release`:

```bash
pnpm nx release publish --access public --dry-run
pnpm nx release publish --access public
```

Nx 23.2.0 checks the registry during a real publish retry: it skips a version already published under the requested tag, or restores the tag if that version exists under another tag, and publishes missing versions. The dry run previews packages without making that registry existence check. Review the real retry output and recheck both registry versions and smoke tests. Do not rerun `nx release 0.1.0`, bump versions, delete release tags, or unpublish the successful package as a retry strategy. npm versions are immutable; if a published artifact itself is wrong, stop and plan a corrective release with a new shared version.

## Future automated releases

After the first release, consider [npm Trusted Publishing with OIDC](https://docs.npmjs.com/trusted-publishers/) for GitHub Actions. Configure a trusted publisher separately for each package, restricted to the intended repository, workflow filename, and any environment. Use a supported GitHub-hosted runner, npm 11.5.1 or later and Node 22.14.0 or later, with `id-token: write`. Check whether the publisher allows direct publication or requires staged publication when choosing the workflow's publish command. Keep the full validation and package inspection before publication. This repository does not add an automatic publishing workflow as part of `0.1.0` preparation.

Subsequent releases normally omit `--first-release`; always preview the release, inspect the changelog and packages, and publish the already prepared versions.
