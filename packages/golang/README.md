# @hao-nx-toolkit/golang

Create Go handler, service, repository, and config skeletons in your Nx workspace. The `handler` generator creates a handler struct, a functional option type, a constructor that applies options in order, and a `Register` method ready for your route registration code.

For Handler, choose a framework-free skeleton, Gin, or Echo v5. The target directory does not need to be an Nx project or contain a Go module.

## Compatibility

This version requires **Nx 23.2.0 exactly**. See the [toolkit version compatibility table](../../README.md#nx-version-compatibility) when choosing a version for your workspace.

You do not need Go installed to run the generator. Install Go and the selected framework when you are ready to compile your application.

## Install

Run this command in your existing Nx workspace:

```bash
pnpm add -D @hao-nx-toolkit/golang
```

When installing at the root of a pnpm workspace, use `pnpm add -Dw @hao-nx-toolkit/golang`. No initialization generator or Nx plugin configuration is required.

## Generate a handler

```bash
pnpm nx g @hao-nx-toolkit/golang:handler \
  --name=user-profile \
  --directory=apps/api/internal/handlers
```

This creates `apps/api/internal/handlers/user_profile_handler.go`:

```go
package handlers

type UserProfileHandler struct {
}

type UserProfileHandlerOption func(*UserProfileHandler)

func NewUserProfileHandler(options ...UserProfileHandlerOption) *UserProfileHandler {
	handler := &UserProfileHandler{}
	for _, option := range options {
		option(handler)
	}
	return handler
}

func (handler *UserProfileHandler) Register() {
	// TODO: Implement route registration here.
}
```

Add your fields, option functions, and route registration implementation after generation. The generator does not create endpoints or implement application behavior.

### Options

| Option        | Value                    | Meaning                                                                |
| ------------- | ------------------------ | ---------------------------------------------------------------------- |
| `name`        | Required string          | Handler base name; converted to PascalCase with a `Handler` suffix.    |
| `directory`   | Required string          | Output directory relative to the workspace root, using `/` separators. |
| `packageName` | Optional string          | Go package name; defaults to the directory basename.                   |
| `framework`   | `none`, `gin`, or `echo` | Registration signature; defaults to `none`. Echo uses v5 only.         |

The generator writes one Go file directly in `directory` and creates missing directories. Paths remain relative to the workspace root even when you run the command from a subdirectory. Absolute paths and parent traversal (`..`) are rejected.

To use a package name different from the directory name:

```bash
pnpm nx g @hao-nx-toolkit/golang:handler \
  --name=user \
  --directory=apps/api/internal/http-handlers \
  --packageName=transport
```

## Generate a service or repository

```bash
pnpm nx g @hao-nx-toolkit/golang:service \
  --name=user-profile \
  --directory=apps/api/internal/services

pnpm nx g @hao-nx-toolkit/golang:repository \
  --name=user-profile \
  --directory=apps/api/internal/repositories
```

These commands create `services/user_profile_service.go` and `repositories/user_profile_repository.go` under `apps/api/internal`. Each generator writes one file and accepts required `name` and `directory` options plus optional `packageName`, using the same naming, path, package validation, and overwrite protections as Handler. They do not accept `framework`.

The service skeleton is:

```go
package services

type UserProfileService struct {
}

type UserProfileServiceOption func(*UserProfileService)

func NewUserProfileService(options ...UserProfileServiceOption) *UserProfileService {
	service := &UserProfileService{}
	for _, option := range options {
		option(service)
	}
	return service
}
```

The repository skeleton uses `UserProfileRepository`, `UserProfileRepositoryOption`, and `NewUserProfileRepository` with the same constructor pattern. Constructors apply each option once in the supplied order to the returned pointer. Add fields, option functions, and application methods yourself; these generators do not create a `Register` method, framework imports, or application tests.

Names become PascalCase types and snake_case filenames with the appropriate suffix. `UserService` and `user-service` both produce `UserService` in `user_service.go`; `UserRepository` and `user-repository` both produce `UserRepository` in `user_repository.go`. A suffix alone (`service` or `repository`) is rejected because a base name is required. Use `--packageName=storage` to override the output directory's package name when needed.

## Generate config

```bash
pnpm nx g @hao-nx-toolkit/golang:config \
  --directory=apps/api/internal/config
```

This creates `apps/api/internal/config/config.go`. `directory` is the only generator option and refers to the final directory; the generator does not add a `config` subdirectory. The filename is always `config.go` and the package is always `config`, even when the directory has a different name. `name` and `packageName` are not supported.

```go
package config

type Config struct {
	// TODO: Need to implement config fields
}

type loadOptions struct {
	path string
}

type LoadOption func(*loadOptions)

func WithPath(path string) LoadOption {
	return func(options *loadOptions) {
		options.path = path
	}
}

func Load(options ...LoadOption) (*Config, error) {
	var opts loadOptions
	for _, option := range options {
		option(&opts)
	}

	var result Config

	// TODO: Need to implement loading and validation using opts

	return &result, nil
}
```

After implementing loading and validation, callers can supply a path with `config.Load(config.WithPath("config.yaml"))`. Options run once in order before the loading TODO; repeated `WithPath` calls keep the last path. Without `WithPath`, the private path starts as an empty string. The skeleton currently returns an empty `Config` and nil error, performs no I/O, and supplies no default path, file format, parser, or validation. Add those behaviors yourself using `opts.path`.

The same workspace-relative path and existing-file safeguards apply. Existing Go files must use `package config` (or `config_test` in external test files); a different directory package causes an error before generation. Existing `config.go` files are never overwritten.

## Framework templates

### Gin

```bash
pnpm nx g @hao-nx-toolkit/golang:handler \
  --name=user \
  --directory=apps/api/internal/handlers \
  --framework=gin
```

The generated file imports `github.com/gin-gonic/gin` and uses this method:

```go
func (handler *UserHandler) Register(router gin.IRoutes) {
	// TODO: Implement route registration here.
}
```

Pass either a `*gin.Engine` or a `*gin.RouterGroup` to `Register`. `gin.IRoutes` provides route registration methods but does not provide `Group`; create groups in the caller.

### Echo v5

```bash
pnpm nx g @hao-nx-toolkit/golang:handler \
  --name=user \
  --directory=apps/api/internal/handlers \
  --framework=echo
```

The generated file imports `github.com/labstack/echo/v5` and uses this method:

```go
func (handler *UserHandler) Register(router *echo.Echo) {
	// TODO: Implement route registration here.
}
```

Pass the Echo v5 application instance to `Register`. This template does not accept `*echo.Group` or support Echo v4.

For Gin and Echo, the struct, option type, and constructor have the same form as the default template. Ensure your Go module already has the selected framework, or install it from the module directory with `go get github.com/gin-gonic/gin` or `go get github.com/labstack/echo/v5`. The generator prints dependency guidance but never runs these commands or selects dependency versions.

## Naming and validation

Names can use camelCase, PascalCase, spaces, hyphens, or underscores. Each word becomes initial uppercase with the remaining letters lowercase; there is no special acronym list.

| Input                                 | Handler type         | File                      |
| ------------------------------------- | -------------------- | ------------------------- |
| `user-profile`, `userProfile`         | `UserProfileHandler` | `user_profile_handler.go` |
| `http-client`, `HTTPClient`           | `HttpClientHandler`  | `http_client_handler.go`  |
| `user`, `user-handler`, `UserHandler` | `UserHandler`        | `user_handler.go`         |

A trailing `Handler` word is recognized and is not appended again. A base name is required: `handler` alone is rejected. Names must start with a letter after normalization; punctuation other than the separators above is rejected. The complete normalized type name must be a valid Go identifier. Unicode names whose case conversion introduces combining marks (for example, `İtem` or `ǰob`) are rejected before any file is written.

The Go package name must be a valid identifier, cannot be a Go keyword or `_`, and must match existing Go files directly in the target directory. External test packages named `<packageName>_test` in `_test.go` files are accepted. Comments and build tags may precede the package clause; package validation checks files regardless of build tags, so directories with conditional alternative package names are rejected. Go files starting with `.` or `_` are ignored, following Go file selection conventions. Use `packageName` when the directory basename is invalid or differs from the existing package.

An existing target file always causes an error, even if its content matches the skeleton. There is no overwrite option. Validation failures occur before a generated file is written.

## Scope and limitations

- Generates only the requested Go skeleton file; does not modify `go.mod`, `go.sum`, Nx projects, or dependency declarations.
- Does not run `go`, `gofmt`, or dependency installation. Templates are checked for `gofmt` formatting during plugin testing.
- Leaves route registration and config loading/validation for you to implement, with TODO comments in the relevant templates.
- Does not create custom options, routers, endpoints, or application tests.
- Checks the destination file and package clauses, but does not detect conflicting Go type declarations in other files.

## Development verification

From this repository's root, run:

```bash
pnpm nx run-many -p golang -t lint test build typecheck
pnpm nx e2e golang-e2e
```

The E2E suite packs the plugin, installs it into a temporary Nx 23.2.0 consumer, and runs the real CLI. It checks the documented generation workflows, naming, package validation, refusal to overwrite, dry-run behavior, and preservation of dependency/configuration files.

Go validation uses **Go 1.26.2**, **Gin v1.12.0**, and **Echo v5.0.0** (both pinned framework versions require Go 1.25 or later). It compiles the three Handler framework variants and the Service, Repository, and Config templates, runs constructor option and registration tests, and checks generated files with `gofmt`. Config generation checks cover the emitted option loop and path assignment; external Go consumer tests use only public `Load` and `WithPath` APIs to check successful calls with zero or repeated options and nonexistent file paths. The loading state remains private, and actual loading remains a TODO. Negative controls temporarily duplicate Service and Repository constructor option calls in fixture artifacts to prove the Go behavior checks detect regressions; original artifacts are restored before the final compilation. The suite uses temporary pnpm and Go caches and cleans them up. Install the Go toolchain and allow network access to the npm registry and Go module proxy before running E2E tests; missing prerequisites cause failures rather than skipped checks. CI installs the same Go version in both pull request and main branch jobs.
