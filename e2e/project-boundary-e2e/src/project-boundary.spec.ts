import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const nxVersion = process.env.TOOLKIT_E2E_NX_VERSION ?? '23.2.0';
if (
  !/^23\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(nxVersion) ||
  Number(nxVersion.split('.')[1]) < 2
)
  throw new Error(
    `TOOLKIT_E2E_NX_VERSION must be an exact stable Nx version within ^23.2.0; received ${JSON.stringify(nxVersion)}`,
  );
let temporary: string;
let consumer: string;
let environment: NodeJS.ProcessEnv;
let sourceManifest: string;
let sourceLock: string;

function json(path: string, value: unknown) {
  mkdirSync(join(consumer, path, '..'), { recursive: true });
  writeFileSync(join(consumer, path), `${JSON.stringify(value, null, 2)}\n`);
}
function read(path: string) {
  return JSON.parse(readFileSync(join(consumer, path), 'utf8'));
}
async function pnpm(args: string[], cwd = consumer) {
  try {
    const result = await execute('pnpm', args, {
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
function policy() {
  json('project-boundary.config.json', {
    depConstraints: [
      {
        sourceTag: 'scope:app',
        onlyDependOnProjectsWithTags: ['scope:shared'],
      },
      {
        sourceTag: 'scope:shared',
        onlyDependOnProjectsWithTags: ['scope:shared'],
      },
      {
        sourceTag: 'scope:legacy',
        onlyDependOnProjectsWithTags: ['scope:shared'],
      },
    ],
  });
}

beforeAll(async () => {
  console.info(
    `Installed-package compatibility: project-boundary with Nx ${nxVersion}`,
  );
  sourceManifest = readFileSync(
    join(repository, 'packages/project-boundary/package.json'),
    'utf8',
  );
  sourceLock = readFileSync(join(repository, 'pnpm-lock.yaml'), 'utf8');
  temporary = mkdtempSync(join(tmpdir(), 'project-boundary-e2e-'));
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
  const tarball = join(temporary, 'project-boundary.tgz');
  const packed = await pnpm(
    ['pack', '--out', tarball],
    join(repository, 'packages/project-boundary'),
  );
  expect(packed.code, packed.text).toBe(0);
  json('package.json', {
    name: 'boundary-fixture',
    private: true,
    devDependencies: {
      nx: nxVersion,
      '@nx/js': nxVersion,
      typescript: '~6.0.3',
      '@hao-nx-toolkit/project-boundary': `file:${tarball}`,
    },
  });
  json('nx.json', { analytics: false, neverConnectToCloud: true });
  writeFileSync(
    join(consumer, 'pnpm-workspace.yaml'),
    `packages: []\nstoreDir: ${JSON.stringify(join(temporary, 'store'))}\nallowBuilds:\n  nx: true\n`,
  );
  const installed = await pnpm([
    'install',
    '--no-frozen-lockfile',
    '--strict-peer-dependencies',
    '--store-dir',
    join(temporary, 'store'),
  ]);
  expect(installed.code, installed.text).toBe(0);
  // Inspect the installed consumer, including transitive devkit resolution: an
  // auto-installed nested baseline Nx must not make a newer-version run pass.
  const runtime = await pnpm([
    'exec',
    'node',
    '--eval',
    `const {createRequire} = require('node:module');
const {realpathSync} = require('node:fs');
const {join} = require('node:path');
const root = createRequire(join(process.cwd(), 'package.json'));
const plugin = createRequire(root.resolve('@hao-nx-toolkit/project-boundary/package.json'));
const devkit = createRequire(plugin.resolve('@nx/devkit/package.json'));
const result = [root, plugin, devkit].map(resolve => {
  const path = resolve.resolve('nx/package.json');
  return {version: resolve('nx/package.json').version, path: realpathSync(path)};
});
console.log('TOOLKIT_NX_RESOLUTION=' + JSON.stringify(result));`,
  ]);
  expect(runtime.code, runtime.text).toBe(0);
  const runtimeResult = runtime.text
    .split('\n')
    .find((line) => line.startsWith('TOOLKIT_NX_RESOLUTION='));
  expect(runtimeResult, runtime.text).toBeDefined();
  const resolutions = JSON.parse(
    runtimeResult!.slice('TOOLKIT_NX_RESOLUTION='.length),
  ) as {
    version: string;
    path: string;
  }[];
  for (const resolution of resolutions) {
    expect(resolution.version, JSON.stringify(resolutions)).toBe(nxVersion);
    expect(
      resolution.path.startsWith(realpathSync(consumer) + '/'),
      JSON.stringify(resolutions),
    ).toBe(true);
  }
  const cli = await pnpm(['nx', '--version']);
  expect(cli.code, cli.text).toBe(0);
  expect(cli.text).toContain(`Local: v${nxVersion}`);
}, 240_000);

afterAll(() => {
  try {
    expect(
      readFileSync(
        join(repository, 'packages/project-boundary/package.json'),
        'utf8',
      ),
    ).toBe(sourceManifest);
    expect(readFileSync(join(repository, 'pnpm-lock.yaml'), 'utf8')).toBe(
      sourceLock,
    );
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
});

it('installs the packaged plugin and initializes a runnable uncached root target with an editor schema', async () => {
  expect(
    read('node_modules/@hao-nx-toolkit/project-boundary/package.json').version,
  ).toBe(JSON.parse(sourceManifest).version);
  const initialized = await pnpm([
    'nx',
    'g',
    '@hao-nx-toolkit/project-boundary:init',
    '--no-interactive',
  ]);
  expect(initialized.code, initialized.text).toBe(0);
  expect(read('package.json').nx.targets['check-boundaries']).toBeUndefined();
  const resolved = await pnpm([
    'nx',
    'show',
    'project',
    'boundary-fixture',
    '--json',
  ]);
  expect(resolved.code, resolved.text).toBe(0);
  expect(parsedJson(resolved.text).targets['check-boundaries']).toMatchObject({
    executor: '@hao-nx-toolkit/project-boundary:check',
    cache: false,
  });
  const configuration = read('project-boundary.config.json');
  expect(configuration.depConstraints).toEqual([]);
  expect(read(configuration.$schema).title).toBe(
    'Project boundary configuration',
  );
  const check = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
    '--output-style=static',
  ]);
  expect(check.code, check.text).toBe(0);
}, 60_000);

it('preserves customized policy on repeat initialization and checks actual static, dynamic, and implicit graph edges', async () => {
  for (const [name, root, tag] of [
    ['app', 'apps/app', 'scope:app'],
    ['lib', 'libs/lib', 'scope:shared'],
    ['downstream', 'libs/downstream', 'scope:restricted'],
    ['incoming', 'apps/incoming', 'scope:legacy'],
  ]) {
    json(`${root}/project.json`, {
      name,
      root,
      tags: [tag],
      ...(name === 'incoming' ? { implicitDependencies: ['app'] } : {}),
    });
  }
  json('tsconfig.base.json', {
    compilerOptions: {
      baseUrl: '.',
      paths: {
        '@fixture/lib': ['libs/lib/index.ts'],
        '@fixture/downstream': ['libs/downstream/index.ts'],
      },
    },
  });
  writeFileSync(
    join(consumer, 'apps/app/index.ts'),
    "import { value } from '@fixture/lib'; console.log(value);\n",
  );
  writeFileSync(
    join(consumer, 'libs/lib/index.ts'),
    "export const value = 1; export const load = () => import('@fixture/downstream');\n",
  );
  writeFileSync(
    join(consumer, 'libs/downstream/index.ts'),
    'export const downstream = 1;\n',
  );
  policy();
  const before = readFileSync(
    join(consumer, 'project-boundary.config.json'),
    'utf8',
  );
  const repeated = await pnpm([
    'nx',
    'g',
    '@hao-nx-toolkit/project-boundary:init',
    '--no-interactive',
  ]);
  expect(repeated.code, repeated.text).toBe(0);
  expect(
    readFileSync(join(consumer, 'project-boundary.config.json'), 'utf8'),
  ).toBe(before);
  const graphResult = await pnpm(['nx', 'graph', '--print']);
  expect(graphResult.code, graphResult.text).toBe(0);
  // Nx graph --print emits its JSON to stdout; command output may include stderr diagnostics.
  const graphStart = graphResult.text.indexOf('{');
  const graphEnd = graphResult.text.lastIndexOf('}');
  const graph = JSON.parse(
    graphResult.text.slice(graphStart, graphEnd + 1),
  ).graph;
  expect(graph.dependencies.app).toContainEqual(
    expect.objectContaining({ target: 'lib', type: 'static' }),
  );
  expect(graph.dependencies.lib).toContainEqual(
    expect.objectContaining({ target: 'downstream', type: 'dynamic' }),
  );
  expect(graph.dependencies.incoming).toContainEqual(
    expect.objectContaining({ target: 'app', type: 'implicit' }),
  );
}, 60_000);

it('fails workspace violations with readable JSON diagnostics while a selected source ignores incoming and downstream violations', async () => {
  const workspace = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
    '--output-style=static',
    '--',
    '--outputFile=reports/workspace.json',
  ]);
  expect(workspace.code, workspace.text).toBe(1);
  expect(workspace.text).toContain('lib → downstream');
  expect(workspace.text).toContain('scope:restricted');
  expect(read('reports/workspace.json')).toMatchObject({
    version: 1,
    scope: { kind: 'workspace' },
    success: false,
  });
  expect(read('reports/workspace.json').violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'lib',
        target: 'downstream',
        dependencyType: 'dynamic',
      }),
      expect.objectContaining({
        source: 'incoming',
        target: 'app',
        dependencyType: 'implicit',
      }),
    ]),
  );
  const selected = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
    '--output-style=static',
    '--',
    '--project=app',
    '--outputFile=reports/app.json',
  ]);
  expect(selected.code, selected.text).toBe(0);
  expect(read('reports/app.json')).toMatchObject({
    scope: { kind: 'project', project: 'app' },
    success: true,
    violations: [],
  });
  const violating = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
    '--output-style=static',
    '--',
    '--project=lib',
  ]);
  expect(violating.code, violating.text).toBe(1);
  expect(violating.text).toContain('lib → downstream');
}, 60_000);

it('retains separate reports from parallel project targets', async () => {
  const result = await pnpm([
    'nx',
    'run-many',
    '-t',
    'check-boundaries',
    '-p',
    'app,lib',
    '--parallel=2',
    '--output-style=static',
    '--',
    '--outputFile=reports/{boundaryProjectName}.json',
  ]);
  expect(result.code, result.text).toBe(1);
  expect(result.text, result.text).toContain('lib → downstream');
  expect(
    read(
      'reports/project-a172cedcae47474b615c54d510a5d84a8dea3032e958587430b413538be3f333.json',
    ),
  ).toMatchObject({
    scope: { kind: 'project', project: 'app' },
    success: true,
    violations: [],
  });
  expect(
    read(
      'reports/project-76b5a357391276b282a516f54f48ef3c207f46d8192dc58c208d5183d38415f8.json',
    ),
  ).toMatchObject({
    scope: { kind: 'project', project: 'lib' },
    success: false,
    violations: [
      expect.objectContaining({ source: 'lib', target: 'downstream' }),
    ],
  });
}, 60_000);

it('passes the workspace after explicit policy fixes and reports unknown-project and invalid-policy failures', async () => {
  json('project-boundary.config.json', {
    depConstraints: [
      {
        sourceTag: 'scope:app',
        onlyDependOnProjectsWithTags: ['scope:shared'],
      },
      {
        sourceTag: 'scope:shared',
        onlyDependOnProjectsWithTags: ['scope:restricted'],
      },
      {
        sourceTag: 'scope:legacy',
        onlyDependOnProjectsWithTags: ['scope:app'],
      },
    ],
  });
  const passing = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
    '--output-style=static',
  ]);
  expect(passing.code, passing.text).toBe(0);
  const unknown = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
    '--output-style=static',
    '--',
    '--project=unknown',
    '--outputFile=reports/error.json',
  ]);
  expect(unknown.code, unknown.text).toBe(1);
  expect(read('reports/error.json').errors).toContainEqual({
    kind: 'configuration',
    message: 'Unknown project: unknown',
  });
  json('project-boundary.config.json', {
    depConstraints: [],
    exclusions: ['app'],
  });
  const unsupported = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
    '--output-style=static',
  ]);
  expect(unsupported.code, unsupported.text).toBe(1);
  expect(unsupported.text).toContain(
    'Unsupported configuration field: exclusions',
  );
  json('project-boundary.config.json', {
    depConstraints: [
      { sourceTag: 'unused', notDependOnProjectsWithTags: ['/[/'] },
    ],
  });
  const regex = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
    '--output-style=static',
  ]);
  expect(regex.code, regex.text).toBe(1);
  expect(regex.text).toContain('Configuration error');
  expect(regex.text).toContain('regular expression');
}, 60_000);

async function git(args: string[]) {
  const result = await execute(
    'git',
    [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgSign=false',
      '-c',
      'user.name=Boundary E2E',
      '-c',
      'user.email=boundary-e2e@example.invalid',
      ...args,
    ],
    {
      cwd: consumer,
      env: {
        ...environment,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
      },
    },
  );
  return result.stdout.trim();
}
async function commitFixture(message: string) {
  await git(['add', '.']);
  await git(['commit', '-m', message]);
  return git(['rev-parse', 'HEAD']);
}
function parsedJson(text: string) {
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}
function projectReports(directory: string) {
  return readdirSync(join(consumer, directory)).map((file) =>
    read(`${directory}/${file}`),
  );
}

it('runs native affected checks from real Git changes and initializes inferred projects without freezing their targets', async () => {
  json('apps/sibling/project.json', {
    name: 'sibling',
    tags: ['scope:sibling'],
    implicitDependencies: ['downstream'],
  });
  json('packages/packaged/package.json', {
    name: '@fixture/packaged',
    private: true,
    nx: { name: 'packaged', tags: ['scope:isolated'] },
  });
  writeFileSync(
    join(consumer, 'pnpm-workspace.yaml'),
    `packages: ['packages/*']\nstoreDir: ${JSON.stringify(join(temporary, 'store'))}\nallowBuilds:\n  nx: true\n`,
  );
  mkdirSync(join(consumer, 'projects/inferred'), { recursive: true });
  writeFileSync(join(consumer, 'projects/inferred/inferred.marker'), 'fixture');
  mkdirSync(join(consumer, 'tools'), { recursive: true });
  writeFileSync(
    join(consumer, 'tools/inference.cjs'),
    `const {dirname} = require('node:path');
module.exports.createNodesV2 = ['**/inferred.marker', async (files) => files.map(file => [file, {projects: {[dirname(file)]: {name: 'inferred', targets: {build: {command: 'echo inferred-build'}}}}}])];\n`,
  );
  json('nx.json', {
    analytics: false,
    neverConnectToCloud: true,
    plugins: [
      './tools/inference.cjs',
      {
        plugin: '@hao-nx-toolkit/project-boundary',
        options: { projectMarkers: ['**/inferred.marker'] },
      },
    ],
  });
  json('project-boundary.config.json', {
    depConstraints: [
      { sourceTag: '*' },
      { sourceTag: 'scope:app', notDependOnProjectsWithTags: ['scope:shared'] },
      {
        sourceTag: 'scope:sibling',
        onlyDependOnProjectsWithTags: ['scope:shared'],
      },
    ],
  });
  const initArgs = [
    'nx',
    'g',
    '@hao-nx-toolkit/project-boundary:init',
    '--no-interactive',
  ];
  const initialized = await pnpm(initArgs);
  expect(initialized.code, initialized.text).toBe(0);
  expect(existsSync(join(consumer, 'projects/inferred/project.json'))).toBe(
    false,
  );
  expect(read('packages/packaged/package.json').nx.targets).toBeUndefined();
  const repeated = await pnpm(initArgs);
  expect(repeated.code, repeated.text).toBe(0);
  expect(existsSync(join(consumer, 'projects/inferred/project.json'))).toBe(
    false,
  );
  const inferredResolved = await pnpm([
    'nx',
    'show',
    'project',
    'inferred',
    '--json',
  ]);
  expect(inferredResolved.code, inferredResolved.text).toBe(0);
  expect(parsedJson(inferredResolved.text).targets.build.options.command).toBe(
    'echo inferred-build',
  );
  writeFileSync(
    join(consumer, '.gitignore'),
    'node_modules/\n.nx/\nreports/\n',
  );
  await git(['init', '--initial-branch=main']);
  const sourceBase = await commitFixture('baseline source policy');
  writeFileSync(
    join(consumer, 'apps/app/index.ts'),
    "import { value } from '@fixture/lib'; console.log(value, 'changed');\n",
  );
  const sourceHead = await commitFixture('change app source');
  async function affected(base: string, head: string, directory: string) {
    const selected = await pnpm([
      'nx',
      'show',
      'projects',
      '--affected',
      `--base=${base}`,
      `--head=${head}`,
      '--json',
    ]);
    expect(selected.code, selected.text).toBe(0);
    const result = await pnpm([
      'nx',
      'affected',
      '-t',
      'check-boundaries',
      `--base=${base}`,
      `--head=${head}`,
      '--parallel=2',
      '--output-style=static',
      '--',
      `--outputFile=${directory}/{boundaryProjectName}.json`,
    ]);
    return {
      selected: JSON.parse(
        selected.text.slice(
          selected.text.indexOf('['),
          selected.text.lastIndexOf(']') + 1,
        ),
      ).sort(),
      result,
      reports: projectReports(directory),
    };
  }
  const source = await affected(sourceBase, sourceHead, 'reports/source');
  expect(source.selected).toEqual(['app', 'incoming']);
  expect(source.result.code, source.result.text).toBe(1);
  expect(source.reports.map((report) => report.scope.project).sort()).toEqual([
    'app',
    'incoming',
  ]);
  expect(
    source.reports.find((report) => report.scope.project === 'app'),
  ).toMatchObject({
    success: false,
    violations: [
      expect.objectContaining({
        source: 'app',
        target: 'lib',
        targetTags: ['scope:shared'],
      }),
    ],
  });
  expect(
    source.reports.find((report) => report.scope.project === 'incoming'),
  ).toMatchObject({ success: true, violations: [] });
  expect(source.result.text).not.toContain('sibling:check-boundaries');

  json('project-boundary.config.json', {
    depConstraints: [
      { sourceTag: '*' },
      {
        sourceTag: 'scope:app',
        onlyDependOnProjectsWithTags: ['scope:shared'],
      },
      {
        sourceTag: 'scope:sibling',
        onlyDependOnProjectsWithTags: ['scope:shared'],
      },
    ],
  });
  const tagBase = await commitFixture('baseline target tag policy');
  json('libs/lib/project.json', {
    ...read('libs/lib/project.json'),
    tags: ['scope:blocked'],
  });
  const tagHead = await commitFixture('change lib tags');
  const tags = await affected(tagBase, tagHead, 'reports/tags');
  expect(tags.selected).toEqual(['app', 'incoming', 'lib']);
  expect(tags.result.code, tags.result.text).toBe(1);
  expect(tags.reports.map((report) => report.scope.project).sort()).toEqual([
    'app',
    'incoming',
    'lib',
  ]);
  expect(
    tags.reports.find((report) => report.scope.project === 'app'),
  ).toMatchObject({
    success: false,
    violations: [
      expect.objectContaining({
        source: 'app',
        target: 'lib',
        targetTags: ['scope:blocked'],
      }),
    ],
  });

  const policyBase = tagHead;
  json('project-boundary.config.json', {
    depConstraints: [{ sourceTag: '*' }],
  });
  const policyHead = await commitFixture('change shared policy only');
  expect(await git(['diff', '--name-only', policyBase, policyHead])).toBe(
    'project-boundary.config.json',
  );
  const changedPolicy = await affected(
    policyBase,
    policyHead,
    'reports/policy',
  );
  const allProjects = [
    'app',
    'boundary-fixture',
    'downstream',
    'incoming',
    'inferred',
    'lib',
    'packaged',
    'sibling',
  ];
  expect(changedPolicy.selected).toEqual(allProjects);
  expect(changedPolicy.result.code, changedPolicy.result.text).toBe(0);
  expect(
    changedPolicy.reports.map((report) => report.scope.project).sort(),
  ).toEqual(allProjects);
  expect(
    changedPolicy.reports.every(
      (report) => report.success && report.violations.length === 0,
    ),
  ).toBe(true);

  json('project-boundary.config.json', {
    depConstraints: [
      { sourceTag: '*' },
      {
        sourceTag: 'scope:app',
        onlyDependOnProjectsWithTags: ['scope:shared'],
      },
      {
        sourceTag: 'scope:sibling',
        onlyDependOnProjectsWithTags: ['scope:shared'],
      },
    ],
  });
  const whole = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
    '--output-style=static',
    '--',
    '--outputFile=reports/final-workspace.json',
  ]);
  expect(whole.code, whole.text).toBe(1);
  expect(read('reports/final-workspace.json')).toMatchObject({
    scope: { kind: 'workspace' },
    success: false,
    violations: expect.arrayContaining([
      expect.objectContaining({ source: 'app', target: 'lib' }),
      expect.objectContaining({ source: 'sibling', target: 'downstream' }),
    ]),
  });
}, 120_000);

it('reports uncovered projects only at init and full checks, and accepts root marker configuration', async () => {
  json('project-boundary.config.json', {
    depConstraints: [{ sourceTag: '*' }],
  });
  const settings = read('nx.json');
  settings.plugins = settings.plugins.filter(
    (entry: string | { plugin: string }) =>
      (typeof entry === 'string' ? entry : entry.plugin) !==
      '@hao-nx-toolkit/project-boundary',
  );
  settings.plugins.push({ plugin: '@hao-nx-toolkit/project-boundary' });
  json('nx.json', settings);
  const shown = await pnpm(['nx', 'show', 'project', 'inferred', '--json']);
  expect(shown.code, shown.text).toBe(0);
  expect(parsedJson(shown.text).targets['check-boundaries']).toBeUndefined();
  const build = await pnpm(['nx', 'run', 'inferred:build']);
  expect(build.code, build.text).toBe(0);
  const affected = await pnpm([
    'nx',
    'affected',
    '-t',
    'check-boundaries',
    '--files=apps/app/index.ts',
    '--output-style=static',
  ]);
  expect(affected.code, affected.text).toBe(0);
  const rootBefore = readFileSync(join(consumer, 'package.json'), 'utf8');
  const nxBefore = readFileSync(join(consumer, 'nx.json'), 'utf8');
  const policyBefore = readFileSync(
    join(consumer, 'project-boundary.config.json'),
    'utf8',
  );
  const init = await pnpm([
    'nx',
    'g',
    '@hao-nx-toolkit/project-boundary:init',
    '--no-interactive',
  ]);
  expect(init.code, init.text).toBe(1);
  expect(init.text).toContain('inferred');
  expect(init.text).toContain('projectMarkers');
  expect(readFileSync(join(consumer, 'package.json'), 'utf8')).toBe(rootBefore);
  expect(readFileSync(join(consumer, 'nx.json'), 'utf8')).toBe(nxBefore);
  expect(
    readFileSync(join(consumer, 'project-boundary.config.json'), 'utf8'),
  ).toBe(policyBefore);
  const full = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
    '--outputFile=reports/uncovered.json',
  ]);
  expect(full.code, full.text).toBe(1);
  expect(read('reports/uncovered.json')).toMatchObject({
    success: false,
    errors: [
      { kind: 'configuration', message: expect.stringContaining('inferred') },
    ],
  });
  settings.plugins[settings.plugins.length - 1].options = {
    projectMarkers: ['**/inferred.marker'],
  };
  json('nx.json', settings);
  const restored = await pnpm([
    'nx',
    'g',
    '@hao-nx-toolkit/project-boundary:init',
    '--no-interactive',
  ]);
  expect(restored.code, restored.text).toBe(0);
  const complete = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
  ]);
  expect(complete.code, complete.text).toBe(0);
  expect(existsSync(join(consumer, 'projects/inferred/project.json'))).toBe(
    false,
  );
}, 120_000);

it('automatically discovers new standard projects and only package-manager workspace members', async () => {
  json('apps/new/project.json', { name: 'new-app' });
  json('packages/new/package.json', { name: '@fixture/new', private: true });
  json('packages/excluded/package.json', {
    name: '@fixture/excluded',
    private: true,
  });
  json('fixtures/nonmember/package.json', {
    name: '@fixture/nonmember',
    private: true,
  });
  writeFileSync(
    join(consumer, 'pnpm-workspace.yaml'),
    `packages: ['packages/*', '!packages/excluded']\nstoreDir: ${JSON.stringify(join(temporary, 'store'))}\nallowBuilds:\n  nx: true\n`,
  );
  const appBefore = readFileSync(
    join(consumer, 'apps/new/project.json'),
    'utf8',
  );
  const packageBefore = readFileSync(
    join(consumer, 'packages/new/package.json'),
    'utf8',
  );
  const projects = await pnpm(['nx', 'show', 'projects', '--json']);
  expect(projects.code, projects.text).toBe(0);
  expect(JSON.parse(projects.text.trim())).toEqual(
    expect.arrayContaining(['new-app', '@fixture/new']),
  );
  expect(JSON.parse(projects.text.trim())).not.toContain('@fixture/excluded');
  expect(JSON.parse(projects.text.trim())).not.toContain('@fixture/nonmember');
  for (const name of ['new-app', '@fixture/new']) {
    const shown = await pnpm(['nx', 'show', 'project', name, '--json']);
    expect(shown.code, shown.text).toBe(0);
    expect(parsedJson(shown.text).targets['check-boundaries']).toMatchObject({
      executor: '@hao-nx-toolkit/project-boundary:check',
      cache: false,
    });
    const run = await pnpm([
      'nx',
      'run',
      `${name}:check-boundaries`,
      '--outputFile=reports/new-{boundaryProjectName}.json',
    ]);
    expect(run.code, run.text).toBe(0);
  }
  expect(readFileSync(join(consumer, 'apps/new/project.json'), 'utf8')).toBe(
    appBefore,
  );
  expect(
    readFileSync(join(consumer, 'packages/new/package.json'), 'utf8'),
  ).toBe(packageBefore);
  expect(
    readdirSync(join(consumer, 'reports')).filter((name) =>
      name.startsWith('new-project-'),
    ),
  ).toHaveLength(2);
}, 120_000);

it('honors Nx defaults and explicit same-name target overrides without coverage conflicts', async () => {
  const settings = read('nx.json');
  settings.targetDefaults = {
    'check-boundaries': {
      cache: true,
      options: { project: 'lib', outputFile: 'reports/default.json' },
    },
  };
  json('nx.json', settings);
  const lib = read('libs/lib/project.json');
  lib.targets = {
    'check-boundaries': { command: 'echo explicit-boundary-override' },
  };
  json('libs/lib/project.json', lib);
  const authored = readFileSync(
    join(consumer, 'libs/lib/project.json'),
    'utf8',
  );
  const init = await pnpm([
    'nx',
    'g',
    '@hao-nx-toolkit/project-boundary:init',
    '--no-interactive',
  ]);
  expect(init.code, init.text).toBe(0);
  expect(readFileSync(join(consumer, 'libs/lib/project.json'), 'utf8')).toBe(
    authored,
  );
  const app = await pnpm(['nx', 'show', 'project', 'app', '--json']);
  expect(app.code, app.text).toBe(0);
  expect(parsedJson(app.text).targets['check-boundaries']).toMatchObject({
    cache: true,
    options: { project: 'lib', outputFile: 'reports/default.json' },
  });
  const redirected = await pnpm(['nx', 'run', 'app:check-boundaries']);
  expect(redirected.code, redirected.text).toBe(0);
  expect(read('reports/default.json')).toMatchObject({
    scope: { kind: 'project', project: 'lib' },
  });
  const overridden = await pnpm(['nx', 'run', 'lib:check-boundaries']);
  expect(overridden.code, overridden.text).toBe(0);
  expect(overridden.text).toContain('explicit-boundary-override');
  const all = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
  ]);
  expect(all.code, all.text).toBe(0);
}, 120_000);

it('infers targets through isolated plugin workers and respects Nx registration filters', async () => {
  environment.NX_ISOLATE_PLUGINS = 'true';
  try {
    const isolated = await pnpm([
      'nx',
      'show',
      'project',
      'inferred',
      '--json',
    ]);
    expect(isolated.code, isolated.text).toBe(0);
    expect(parsedJson(isolated.text).targets['check-boundaries'].executor).toBe(
      '@hao-nx-toolkit/project-boundary:check',
    );
  } finally {
    environment.NX_ISOLATE_PLUGINS = 'false';
  }
  const settings = read('nx.json');
  const registration = settings.plugins.find(
    (entry: string | { plugin: string }) =>
      typeof entry === 'object' &&
      entry.plugin === '@hao-nx-toolkit/project-boundary',
  );
  registration.exclude = ['nx.json'];
  json('nx.json', settings);
  const shown = await pnpm(['nx', 'show', 'project', 'app', '--json']);
  expect(shown.code, shown.text).toBe(0);
  expect(parsedJson(shown.text).targets['check-boundaries']).toBeUndefined();
  const init = await pnpm([
    'nx',
    'g',
    '@hao-nx-toolkit/project-boundary:init',
    '--no-interactive',
  ]);
  expect(init.code, init.text).toBe(1);
  expect(init.text).toContain('not covered');
  const full = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
  ]);
  expect(full.code, full.text).toBe(1);
  expect(full.text).toContain('not covered');
}, 120_000);

it('reports missing inference registration during a full workspace check', async () => {
  const settings = read('nx.json');
  settings.plugins = [];
  delete settings.targetDefaults;
  json('nx.json', settings);
  const shown = await pnpm(['nx', 'show', 'project', 'app', '--json']);
  expect(shown.code, shown.text).toBe(0);
  expect(parsedJson(shown.text).targets['check-boundaries']).toBeUndefined();
  const full = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
  ]);
  expect(full.code, full.text).toBe(1);
  expect(full.text).toContain('not covered');
}, 60_000);
