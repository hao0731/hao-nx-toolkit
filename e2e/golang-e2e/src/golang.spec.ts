import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../../../', import.meta.url));
let temporary: string;
let consumer: string;
let environment: NodeJS.ProcessEnv;
let sourceManifest: string;
let sourceLock: string;

function write(path: string, content: string) {
  mkdirSync(join(consumer, path, '..'), { recursive: true });
  writeFileSync(join(consumer, path), content);
}
function json(path: string, value: unknown) {
  write(path, JSON.stringify(value, null, 2) + '\n');
}
function read(path: string) {
  return readFileSync(join(consumer, path), 'utf8');
}
async function command(program: string, args: string[], cwd = consumer) {
  try {
    const result = await execute(program, args, {
      cwd,
      env: environment,
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return { code: 0, text: result.stdout + result.stderr };
  } catch (error) {
    const failure = error as Error & {
      code: number | string;
      stdout?: string;
      stderr?: string;
    };
    return {
      code: failure.code,
      text: `${failure.stdout ?? ''}${failure.stderr ?? ''}${failure.message}`,
    };
  }
}
async function generate(args: string[], cwd = consumer, kind = 'handler') {
  return command(
    'pnpm',
    ['nx', 'g', `@hao-nx-toolkit/golang:${kind}`, '--no-interactive', ...args],
    cwd,
  );
}

beforeAll(async () => {
  sourceManifest = readFileSync(
    join(repository, 'packages/golang/package.json'),
    'utf8',
  );
  sourceLock = readFileSync(join(repository, 'pnpm-lock.yaml'), 'utf8');
  temporary = mkdtempSync(join(tmpdir(), 'golang-e2e-'));
  consumer = join(temporary, 'consumer');
  mkdirSync(consumer);
  const npmrc = join(consumer, '.npmrc');
  writeFileSync(
    npmrc,
    `registry=https://registry.npmjs.org/\nstore-dir=${join(temporary, 'store')}\n`,
  );
  environment = {
    ...process.env,
    npm_config_userconfig: npmrc,
    PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: 'false',
    NX_DAEMON: 'false',
    NX_ISOLATE_PLUGINS: 'false',
    NX_NO_CLOUD: 'true',
    FORCE_COLOR: '0',
    GOPATH: join(temporary, 'go'),
    GOMODCACHE: join(temporary, 'go-mod'),
    GOCACHE: join(temporary, 'go-build'),
    GOTOOLCHAIN: 'local',
    GOENV: 'off',
    GOFLAGS: '-modcacherw',
    TEST_TELEMETRY_DIR: join(temporary, 'go-telemetry'),
  };
  // Child CLIs must discover the fixture, not inherit the outer Nx task workspace.
  for (const key of Object.keys(environment))
    if (key.startsWith('NX_')) delete environment[key];
  Object.assign(environment, {
    NX_DAEMON: 'false',
    NX_ISOLATE_PLUGINS: 'false',
    NX_NO_CLOUD: 'true',
    NX_WORKSPACE_ROOT_PATH: consumer,
  });
  delete environment.NODE_PATH;
  const tarball = join(temporary, 'golang.tgz');
  const packed = await command(
    'pnpm',
    ['pack', '--out', tarball],
    join(repository, 'packages/golang'),
  );
  expect(packed.code, packed.text).toBe(0);
  json('package.json', {
    name: 'golang-fixture',
    private: true,
    devDependencies: {
      nx: '23.2.0',
      '@hao-nx-toolkit/golang': `file:${tarball}`,
    },
  });
  json('nx.json', { analytics: false, neverConnectToCloud: true });
  write(
    'pnpm-workspace.yaml',
    `packages: []\nstoreDir: ${JSON.stringify(join(temporary, 'store'))}\nallowBuilds:\n  nx: true\n`,
  );
  const installed = await command('pnpm', [
    'install',
    '--no-frozen-lockfile',
    '--store-dir',
    join(temporary, 'store'),
  ]);
  expect(installed.code, installed.text).toBe(0);
}, 240_000);

afterAll(() => {
  try {
    expect(
      readFileSync(join(repository, 'packages/golang/package.json'), 'utf8'),
    ).toBe(sourceManifest);
    expect(readFileSync(join(repository, 'pnpm-lock.yaml'), 'utf8')).toBe(
      sourceLock,
    );
  } finally {
    if (temporary)
      rmSync(temporary, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
  }
});

it('generates a default handler through the installed plugin and real Nx CLI', async () => {
  expect(
    JSON.parse(read('node_modules/@hao-nx-toolkit/golang/package.json'))
      .version,
  ).toBe(JSON.parse(sourceManifest).version);
  const result = await generate([
    '--name=user-profile',
    '--directory=apps/api/handlers',
  ]);
  expect(result.code, result.text).toBe(0);
  expect(read('apps/api/handlers/user_profile_handler.go')).toContain(
    'type UserProfileHandler struct',
  );
}, 60_000);

it('generates each framework without changing dependency files or Nx configuration', async () => {
  write(
    'go/go.mod',
    'module example.com/handlers\n\ngo 1.26.2\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.12.0\n\tgithub.com/labstack/echo/v5 v5.0.0\n)\n',
  );
  write('go/go.sum', '');
  const protectedFiles = ['go/go.mod', 'go/go.sum', 'package.json', 'nx.json'];
  const before = protectedFiles.map(read);
  for (const [framework, importPath, signature] of [
    ['none', '', 'Register()'],
    ['gin', 'github.com/gin-gonic/gin', 'Register(router gin.IRoutes)'],
    ['echo', 'github.com/labstack/echo/v5', 'Register(router *echo.Echo)'],
  ]) {
    const result = await generate([
      '--name=user',
      `--directory=go/${framework}`,
      `--framework=${framework}`,
    ]);
    expect(result.code, result.text).toBe(0);
    const output = read(`go/${framework}/user_handler.go`);
    expect(output).toContain(signature);
    expect(output).toContain('// TODO: Implement route registration here.');
    if (importPath) {
      expect(output).toContain(`import "${importPath}"`);
      expect(result.text).toContain(`go get ${importPath}`);
    }
  }
  expect(protectedFiles.map(read)).toEqual(before);
}, 60_000);

it('uses workspace-relative paths from a nested working directory and normalizes names', async () => {
  mkdirSync(join(consumer, 'nested'), { recursive: true });
  const result = await generate(
    [
      '--name=HTTPClient',
      '--directory=apps/api/transport-handlers',
      '--packageName=transport',
    ],
    join(consumer, 'nested'),
  );
  expect(result.code, result.text).toBe(0);
  expect(read('apps/api/transport-handlers/http_client_handler.go')).toContain(
    'package transport\n\ntype HttpClientHandler struct',
  );
  for (const name of ['user', 'user-handler', 'UserHandler']) {
    const generated = await generate([
      `--name=${name}`,
      `--directory=names/${name}`,
      '--packageName=handlers',
    ]);
    expect(generated.code, generated.text).toBe(0);
    expect(read(`names/${name}/user_handler.go`)).toContain(
      'type UserHandler struct',
    );
  }
}, 60_000);

it('refuses overwrites, package conflicts and invalid input, preserving existing files', async () => {
  write(
    'conflicts/user_handler.go',
    'package conflicts\n// existing implementation\n',
  );
  const original = read('conflicts/user_handler.go');
  const overwrite = await generate(['--name=user', '--directory=conflicts']);
  expect(overwrite.code, overwrite.text).not.toBe(0);
  expect(overwrite.text).toContain('already exists');
  expect(read('conflicts/user_handler.go')).toBe(original);
  write('mismatch/existing.go', '/* package mismatch */\npackage other\n');
  const conflict = await generate(['--name=user', '--directory=mismatch']);
  expect(conflict.code, conflict.text).not.toBe(0);
  expect(conflict.text).toContain('package');
  const badName = await generate(['--name=123-user', '--directory=invalid']);
  expect(badName.code, badName.text).not.toBe(0);
  expect(badName.text).toContain('name must start with a letter');
  const badFramework = await generate([
    '--name=user',
    '--directory=invalid',
    '--framework=echo-v4',
  ]);
  expect(badFramework.code, badFramework.text).not.toBe(0);
  expect(badFramework.text).toContain('framework');
}, 60_000);

it('supports dry-run without writing a handler', async () => {
  const result = await generate([
    '--name=preview',
    '--directory=previews',
    '--dry-run',
  ]);
  expect(result.code, result.text).toBe(0);
  expect(result.text).toContain('previews/preview_handler.go');
  expect(() => read('previews/preview_handler.go')).toThrow(/ENOENT/);
}, 60_000);

it.each(['service', 'repository'])(
  'generates %s through the packed CLI with naming, packages and dependency preservation',
  async (kind) => {
    const protectedFiles = [
      'go/go.mod',
      'go/go.sum',
      'package.json',
      'nx.json',
    ];
    const before = protectedFiles.map(read);
    const suffix = kind === 'service' ? 'Service' : 'Repository';
    const directory = kind === 'service' ? 'services' : 'repositories';
    const result = await generate(
      ['--name=user-profile', `--directory=go/${directory}`],
      consumer,
      kind,
    );
    expect(result.code, result.text).toBe(0);
    expect(read(`go/${directory}/user_profile_${kind}.go`)).toContain(
      `package ${directory}\n\ntype UserProfile${suffix} struct`,
    );
    mkdirSync(join(consumer, 'nested'), { recursive: true });
    const nested = await generate(
      [
        '--name=HTTPClient',
        `--directory=features/${kind}-components`,
        '--packageName=components',
      ],
      join(consumer, 'nested'),
      kind,
    );
    expect(nested.code, nested.text).toBe(0);
    expect(
      read(`features/${kind}-components/http_client_${kind}.go`),
    ).toContain(`package components\n\ntype HttpClient${suffix} struct`);
    expect(
      existsSync(join(consumer, `nested/features/${kind}-components`)),
    ).toBe(false);
    for (const name of ['user', `user-${kind}`, `User${suffix}`]) {
      const generated = await generate(
        [
          `--name=${name}`,
          `--directory=names/${kind}/${name}`,
          '--packageName=components',
        ],
        consumer,
        kind,
      );
      expect(generated.code, generated.text).toBe(0);
      expect(read(`names/${kind}/${name}/user_${kind}.go`)).toContain(
        `type User${suffix} struct`,
      );
    }
    expect(protectedFiles.map(read)).toEqual(before);
  },
  60_000,
);

it('generates fixed config filename/package from a nested cwd without dependency/config changes', async () => {
  const protectedFiles = ['go/go.mod', 'go/go.sum', 'package.json', 'nx.json'];
  const before = protectedFiles.map(read);
  const result = await generate(
    ['--directory=go/settings'],
    join(consumer, 'nested'),
    'config',
  );
  expect(result.code, result.text).toBe(0);
  const output = read('go/settings/config.go');
  expect(output).toContain('package config\n');
  expect(output).toContain('func WithPath(path string) LoadOption');
  expect(output).toContain('type LoadOption func(*loadOptions)');
  expect(output).toContain('options.path = path');
  expect(output).toContain(
    'for _, option := range options {\n\t\toption(&opts)\n\t}',
  );
  expect(output).toContain('func Load(options ...LoadOption) (*Config, error)');
  expect(output).toContain(
    '// TODO: Need to implement loading and validation using opts',
  );
  expect(existsSync(join(consumer, 'go/settings/config'))).toBe(false);
  expect(existsSync(join(consumer, 'nested/go/settings'))).toBe(false);
  expect(protectedFiles.map(read)).toEqual(before);
}, 60_000);

it.each(['service', 'repository', 'config'])(
  'protects files and rejects invalid %s CLI inputs',
  async (kind) => {
    const directory = `safeguards/${kind}`;
    const filename = kind === 'config' ? 'config.go' : `user_${kind}.go`;
    const name = kind === 'config' ? [] : ['--name=user'];
    const target = `${directory}/${filename}`;
    write(target, `package ${kind}\n// user implementation\n`);
    const original = read(target);
    const overwrite = await generate(
      [...name, `--directory=${directory}`],
      consumer,
      kind,
    );
    expect(overwrite.code, overwrite.text).not.toBe(0);
    expect(overwrite.text).toContain('already exists');
    expect(read(target)).toBe(original);
    const conflictDirectory = `safeguards/${kind}-conflict`;
    write(
      `${conflictDirectory}/existing.go`,
      '/* package decoy */\npackage other\n',
    );
    const packageArgs = kind === 'config' ? [] : [`--packageName=${kind}`];
    const conflict = await generate(
      [...name, `--directory=${conflictDirectory}`, ...packageArgs],
      consumer,
      kind,
    );
    expect(conflict.code, conflict.text).not.toBe(0);
    expect(conflict.text).toContain('package');
    expect(read(`${conflictDirectory}/existing.go`)).toBe(
      '/* package decoy */\npackage other\n',
    );
    expect(existsSync(join(consumer, conflictDirectory, filename))).toBe(false);
    for (const path of ['../escape', '/absolute', 'C:\\escape']) {
      const invalid = await generate(
        [...name, `--directory=${path}`],
        consumer,
        kind,
      );
      expect(invalid.code, invalid.text).not.toBe(0);
      expect(invalid.text).toContain('directory');
    }
    const schemaDirectory = `safeguards/${kind}-schema`;
    const invalidArgs =
      kind === 'config'
        ? ['--name=user', '--packageName=settings']
        : ['--framework=gin'];
    for (const arg of invalidArgs) {
      const invalid = await generate(
        [...name, `--directory=${schemaDirectory}`, ...packageArgs, arg],
        consumer,
        kind,
      );
      expect(invalid.code, invalid.text).not.toBe(0);
      expect(invalid.text).toMatch(
        /schema|not found|not allowed|additional|property/i,
      );
    }
    if (kind !== 'config') {
      for (const invalidName of ['123-user', kind]) {
        const invalid = await generate(
          [
            `--name=${invalidName}`,
            `--directory=${schemaDirectory}`,
            ...packageArgs,
          ],
          consumer,
          kind,
        );
        expect(invalid.code, invalid.text).not.toBe(0);
        expect(invalid.text).toContain('name');
      }
    }
    expect(existsSync(join(consumer, schemaDirectory))).toBe(false);
    const previewDirectory = `previews/${kind}`;
    const preview = await generate(
      [...name, `--directory=${previewDirectory}`, '--dry-run'],
      consumer,
      kind,
    );
    expect(preview.code, preview.text).toBe(0);
    expect(preview.text).toContain(`${previewDirectory}/${filename}`);
    expect(existsSync(join(consumer, previewDirectory))).toBe(false);
    expect(read(target)).toBe(original);
  },
  120_000,
);

it('compiles real frameworks, applies options once in order to the returned pointer, and emits gofmt-clean code', async () => {
  for (const framework of ['none', 'gin', 'echo']) {
    const importPath =
      framework === 'gin'
        ? 'github.com/gin-gonic/gin'
        : framework === 'echo'
          ? 'github.com/labstack/echo/v5'
          : '';
    const register =
      framework === 'gin'
        ? 'router := gin.New()\n\thandler.Register(router)\n\thandler.Register(router.Group("/api"))'
        : framework === 'echo'
          ? 'handler.Register(echo.New())'
          : 'handler.Register()';
    write(
      `go/${framework}/user_handler_test.go`,
      `package ${framework}

import (
    "reflect"
    "testing"
    ${importPath ? `"${importPath}"` : ''}
)

func TestConstructorAndRegistration(t *testing.T) {
    var observed *UserHandler
    calls := []int{}
    handler := NewUserHandler(
        func(h *UserHandler) { observed = h; calls = append(calls, 1) },
        func(h *UserHandler) {
            if h != observed { t.Fatal("options received different pointers") }
            calls = append(calls, 2)
        },
    )
    if handler == nil || handler != observed { t.Fatal("constructor did not return the option pointer") }
    if !reflect.DeepEqual(calls, []int{1, 2}) { t.Fatalf("unexpected calls: %v", calls) }
    if NewUserHandler() == nil { t.Fatal("constructor without options returned nil") }
    ${register}
}
`,
    );
    const formatted = await command(
      'gofmt',
      ['-l', `${framework}/user_handler.go`],
      join(consumer, 'go'),
    );
    expect(formatted.code, formatted.text).toBe(0);
    expect(formatted.text).toBe('');
  }
  const tidy = await command('go', ['mod', 'tidy'], join(consumer, 'go'));
  expect(tidy.code, tidy.text).toBe(0);
  // Negative control: the Go validation must reject a broken generated artifact.
  write('go/none/broken.go', 'package none\nvar _ = missingSymbol\n');
  const broken = await command('go', ['test', './none'], join(consumer, 'go'));
  expect(broken.code, broken.text).not.toBe(0);
  expect(broken.text).toContain('undefined: missingSymbol');
  rmSync(join(consumer, 'go/none/broken.go'));
  const compiled = await command('go', ['test', './...'], join(consumer, 'go'));
  expect(compiled.code, compiled.text).toBe(0);
}, 240_000);

it('compiles new skeletons through public Go APIs and detects broken constructors', async () => {
  for (const [kind, suffix] of [
    ['service', 'Service'],
    ['repository', 'Repository'],
  ]) {
    const directory = kind === 'service' ? 'services' : 'repositories';
    write(
      `go/${directory}/user_profile_${kind}_test.go`,
      `package ${directory}

import (
    "reflect"
    "testing"
)

func TestConstructor(t *testing.T) {
    var observed *UserProfile${suffix}
    calls := []int{}
    value := NewUserProfile${suffix}(
        func(v *UserProfile${suffix}) { observed = v; calls = append(calls, 1) },
        func(v *UserProfile${suffix}) {
            if v != observed { t.Fatal("options received different pointers") }
            calls = append(calls, 2)
        },
    )
    if value == nil || value != observed { t.Fatal("constructor did not return the option pointer") }
    if !reflect.DeepEqual(calls, []int{1, 2}) { t.Fatalf("unexpected calls: %v", calls) }
    if NewUserProfile${suffix}() == nil { t.Fatal("constructor without options returned nil") }
}
`,
    );
  }
  write(
    'go/settings/config_test.go',
    `package config_test

import (
    "testing"
    config "example.com/handlers/settings"
)

func TestLoadPublicOptions(t *testing.T) {
    result, err := config.Load(config.WithPath("missing-first.yaml"), config.WithPath("missing-last.yaml"))
    if result == nil || err != nil { t.Fatalf("Load failed: result=%v err=%v", result, err) }
    if result, err := config.Load(); result == nil || err != nil { t.Fatal("Load without options failed") }
    if result, err := config.Load(config.WithPath("never-created.json")); result == nil || err != nil {
        t.Fatal("skeleton attempted to load a file")
    }
}
`,
  );
  const generated = [
    'services/user_profile_service.go',
    'repositories/user_profile_repository.go',
    'settings/config.go',
  ];
  const formatted = await command(
    'gofmt',
    ['-l', ...generated],
    join(consumer, 'go'),
  );
  expect(formatted.code, formatted.text).toBe(0);
  expect(formatted.text).toBe('');
  for (const [path, originalCall, brokenCall, target, failure] of [
    [
      'go/services/user_profile_service.go',
      'option(service)',
      'option(service)\n\t\toption(service)',
      './services',
      'unexpected calls',
    ],
    [
      'go/repositories/user_profile_repository.go',
      'option(repository)',
      'option(repository)\n\t\toption(repository)',
      './repositories',
      'unexpected calls',
    ],
  ]) {
    const original = read(path);
    expect(original).toContain(originalCall);
    try {
      write(path, original.replace(originalCall, brokenCall));
      const broken = await command(
        'go',
        ['test', target],
        join(consumer, 'go'),
      );
      expect(broken.code, broken.text).not.toBe(0);
      expect(broken.text).toContain(failure);
    } finally {
      write(path, original);
    }
  }
  const compiled = await command('go', ['test', './...'], join(consumer, 'go'));
  expect(compiled.code, compiled.text).toBe(0);
}, 240_000);
