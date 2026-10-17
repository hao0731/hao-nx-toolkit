# Releasing Hao Nx Toolkit

This guide prepares the first public `0.1.0` release of `@hao-nx-toolkit/golang` and `@hao-nx-toolkit/project-boundary`. They share a fixed toolkit version. Only these two projects are configured in Nx Release; the private repository root and E2E projects are excluded.

Current state: the local `0.1.0` release is prepared and both plugin manifests are `0.1.0`; the packages remain unpublished. See the [prepared release notes](./releases/0.1.0.md). Validation and dry runs do not publish to npm. The preparation recipe below describes the earlier transition from development version `0.0.1`; an already prepared checkout should run checks and package inspection, then proceed only to a separately approved publication.

## Prerequisites

- Use a clean checkout containing all reviewed release preparation changes. Commit those changes before preparing the local release. Confirm the branch and `git status --short`, and check that the intended `v0.1.0` tag does not already exist locally or on the release remote.
- Match CI: Node.js 24, pnpm 11.20.0, and Go 1.26.2. The workspace pins Nx 23.2.0; use `pnpm nx`, not a global Nx installation.
- Allow access to the npm registry and Go module proxy. E2E tests install packed packages into isolated consumers with Nx 23.2.0, 23.2.1, and 23.3.0 and compile generated Go with Gin v1.12.0 and Echo v5.0.0. Go is needed for these tests, although running the Go generators alone does not require it.
- Own or have publishing permission for the npm `@hao-nx-toolkit` scope and both package names. A GitHub repository name does not grant npm scope access. Confirm that neither `0.1.0` package version is already published before starting a new release.
- For interactive publication, have an npm account with 2FA configured and its browser/security-key or one-time-password verification available. Use the current npm CLI with the Node installation. Authenticate only when ready to publish; do not store tokens in repository files. See [npm scoped public package publishing](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) and [npm 2FA](https://docs.npmjs.com/using-two-factor-authentication).

## Validate without publishing

The commands below describe validation before version preparation, starting from `0.0.1`. On the current prepared `0.1.0` checkout, run the checks and package inspection but skip the `nx release 0.1.0` dry run and the local preparation step; do not version again.

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

## Prepare the local release

This transition from `0.0.1` has already been completed in the current checkout. Do not rerun it on an already prepared release. For a future fresh preparation, run this only when the dry run and checks have passed and release preparation is approved:

```bash
pnpm nx release 0.1.0 --first-release --skip-publish
```

This changes both manifests to `0.1.0`, updates the lockfile as needed, generates the root `CHANGELOG.md`, and creates a local release commit and `v0.1.0` tag. Nx Release is configured with `git.push: false`, so this step does not push. `--skip-publish` is essential: it skips npm publication. Do not run this non-dry-run step merely to validate the preparation PR.

Review the generated changelog against the release notes, the release commit, the tag, and any lockfile changes. Check the package versions and rerun package inventory inspection and the full checks on the prepared release. If corrections are needed, finalize the corrected release commit and ensure the local tag points to that exact commit before publication. Mark the release notes and compatibility entry as released only after successful publication.

Keep the prepared release checkout and build artifacts available until both packages have been published and verified. Running version preparation again is unnecessary after this point.

## Publish later — explicit operator action

The following commands perform external publication. Execute them only after approving the prepared release and verifying both manifests are already `0.1.0`:

```bash
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
pnpm nx release publish --first-release --access public --dry-run
pnpm nx release publish --first-release --access public
```

Inspect the dry-run package contents and registry before running the final command. Complete the npm authentication prompt as required. The first-release publish command uses existing on-disk versions and does not run version preparation or build; build artifacts must already exist. A publish dry run does not prove npm scope permission or 2FA readiness.

Verify both package versions on the public registry:

```bash
npm view @hao-nx-toolkit/golang@0.1.0 version dist.integrity --registry=https://registry.npmjs.org/
npm view @hao-nx-toolkit/project-boundary@0.1.0 version dist.integrity --registry=https://registry.npmjs.org/
```

After both publications and consumer checks succeed, push the reviewed release commit through the repository's normal branch/PR process and push the specific `v0.1.0` tag to the release remote. For a direct release from the approved branch with remote `origin`, the commands are `git push origin HEAD` and `git push origin v0.1.0`; adapt the branch workflow to repository protection rules. Create a GitHub Release for that tag using the reviewed changelog and release notes. Record the completed publication in the README compatibility table and release notes through the normal review process.

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
