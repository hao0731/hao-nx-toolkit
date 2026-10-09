# @hao-nx-toolkit/golang

Create Go handler skeletons in your Nx workspace. The `handler` generator creates a handler struct, a functional option type, a constructor that applies options in order, and a `Register` method ready for your route registration code.

Choose a framework-free skeleton, Gin, or Echo v5. The target directory does not need to be an Nx project or contain a Go module.

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

A trailing `Handler` word is recognized and is not appended again. A base name is required: `handler` alone is rejected. Names must start with a letter after normalization; punctuation other than the separators above is rejected.

The Go package name must be a valid identifier, cannot be a Go keyword or `_`, and must match existing Go files directly in the target directory. External test packages named `<packageName>_test` in `_test.go` files are accepted. Comments and build tags may precede the package clause; package validation checks files regardless of build tags, so directories with conditional alternative package names are rejected. Go files starting with `.` or `_` are ignored, following Go file selection conventions. Use `packageName` when the directory basename is invalid or differs from the existing package.

An existing target file always causes an error, even if its content matches the skeleton. There is no overwrite option. Validation failures occur before the handler is written.

## Scope and limitations

- Generates only the Go handler file; does not modify `go.mod`, `go.sum`, Nx projects, or dependency declarations.
- Does not run `go`, `gofmt`, or dependency installation. Templates are checked for `gofmt` formatting during plugin testing.
- Leaves route registration for you to implement, with a TODO comment in every framework template.
- Does not create custom options, routers, endpoints, or application tests.
- Checks the destination file and package clauses, but does not detect conflicting Go type declarations in other files.
