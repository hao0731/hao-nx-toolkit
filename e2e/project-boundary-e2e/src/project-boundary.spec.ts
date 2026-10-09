import { execFile } from 'node:child_process';
import {
  mkdtempSync,
  readdirSync,
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
    NX_DAEMON: 'false',
    NX_ISOLATE_PLUGINS: 'false',
    NX_NO_CLOUD: 'true',
    FORCE_COLOR: '0',
  };
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
      nx: '23.2.0',
      '@nx/js': '23.2.0',
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
    '--store-dir',
    join(temporary, 'store'),
  ]);
  expect(installed.code, installed.text).toBe(0);
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
  expect(read('package.json').nx.targets['check-boundaries']).toMatchObject({
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
  ]);
  expect(passing.code, passing.text).toBe(0);
  const unknown = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
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
    plugins: ['./tools/inference.cjs'],
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
  const inferredFile = read('projects/inferred/project.json');
  expect(inferredFile.name).toBe('inferred');
  expect(Object.keys(inferredFile.targets)).toEqual(['check-boundaries']);
  expect(inferredFile.targets['check-boundaries'].options.project).toBe(
    'inferred',
  );
  expect(
    read('packages/packaged/package.json').nx.targets['check-boundaries']
      .options.project,
  ).toBe('packaged');
  const inferredBefore = readFileSync(
    join(consumer, 'projects/inferred/project.json'),
    'utf8',
  );
  const repeated = await pnpm(initArgs);
  expect(repeated.code, repeated.text).toBe(0);
  expect(
    readFileSync(join(consumer, 'projects/inferred/project.json'), 'utf8'),
  ).toBe(inferredBefore);
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

it('rejects effective wildcard and filtered source conflicts transactionally and migrates inherited reporting configurations', async () => {
  const files = [
    'package.json',
    'project-boundary.config.json',
    'apps/app/project.json',
    'libs/lib/project.json',
    'libs/downstream/project.json',
    'apps/incoming/project.json',
    'apps/sibling/project.json',
    'projects/inferred/project.json',
    'packages/packaged/package.json',
  ];
  const nxSettings = read('nx.json');
  for (const targetDefaults of [
    {
      'check-*': {
        defaultConfiguration: 'ci',
        configurations: { ci: { project: 'other' } },
      },
    },
    {
      'check-boundaries': [
        { filter: { projects: ['missing'] }, options: { project: 'other' } },
        {
          filter: {
            projects: ['tag:scope:app'],
            executor: '@hao-nx-toolkit/project-boundary:check',
          },
          configurations: { ci: { project: 'lib' } },
        },
      ],
    },
  ]) {
    json('nx.json', { ...nxSettings, targetDefaults });
    const before = files.map((file) =>
      readFileSync(join(consumer, file), 'utf8'),
    );
    const rejected = await pnpm([
      'nx',
      'g',
      '@hao-nx-toolkit/project-boundary:init',
      '--no-interactive',
    ]);
    expect(rejected.code, rejected.text).toBe(1);
    expect(rejected.text).toContain(
      'conflicting configuration project selector',
    );
    expect(
      files.map((file) => readFileSync(join(consumer, file), 'utf8')),
    ).toEqual(before);
  }
  const root = read('package.json');
  root.nx.targets['check-boundaries'] = {
    executor: '@hao-nx-toolkit/project-boundary:check',
    configurations: {
      explicit: { outputFile: 'reports/migrated-explicit.json' },
    },
  };
  delete root.nx.targets['check-boundaries-all'];
  json('package.json', root);
  json('project-boundary.config.json', {
    depConstraints: [{ sourceTag: '*' }],
  });
  json('nx.json', {
    ...nxSettings,
    targetDefaults: {
      'check-boundaries': [
        {
          filter: { plugin: 'unrelated-inference-plugin' },
          options: { project: 'wrong' },
        },
        {
          filter: { projects: ['boundary-fixture'] },
          defaultConfiguration: 'ci',
          inputs: ['{projectRoot}/custom.txt'],
          configurations: {
            ci: { outputFile: 'reports/migrated-default.json' },
            manual: { outputFile: 'reports/migrated-manual.json' },
          },
        },
      ],
    },
  });
  const migrated = await pnpm([
    'nx',
    'g',
    '@hao-nx-toolkit/project-boundary:init',
    '--no-interactive',
  ]);
  expect(migrated.code, migrated.text).toBe(0);
  expect(read('package.json').nx.targets['check-boundaries-all']).toMatchObject(
    {
      defaultConfiguration: 'ci',
      inputs: [
        '{projectRoot}/custom.txt',
        'default',
        '{workspaceRoot}/project-boundary.config.json',
      ],
      configurations: {
        ci: { outputFile: 'reports/migrated-default.json' },
        manual: { outputFile: 'reports/migrated-manual.json' },
        explicit: { outputFile: 'reports/migrated-explicit.json' },
      },
    },
  );
  for (const [configuration, file] of [
    [undefined, 'default'],
    ['manual', 'manual'],
    ['explicit', 'explicit'],
  ]) {
    const result = await pnpm([
      'nx',
      'run',
      'boundary-fixture:check-boundaries-all',
      ...(configuration ? [`--configuration=${configuration}`] : []),
    ]);
    expect(result.code, result.text).toBe(0);
    expect(read(`reports/migrated-${file}.json`)).toMatchObject({
      scope: { kind: 'workspace' },
      success: true,
    });
  }
  const before = readFileSync(join(consumer, 'package.json'), 'utf8');
  const repeated = await pnpm([
    'nx',
    'g',
    '@hao-nx-toolkit/project-boundary:init',
    '--no-interactive',
  ]);
  expect(repeated.code, repeated.text).toBe(0);
  expect(readFileSync(join(consumer, 'package.json'), 'utf8')).toBe(before);
}, 60_000);

it('preserves Nx spread behavior and validates inferred boundary layers and inherited executors', async () => {
  const expectedExecutor = '@hao-nx-toolkit/project-boundary:check';
  const settings = read('nx.json');
  json('apps/app/project.json', {
    ...read('apps/app/project.json'),
    targets: {
      'check-boundaries': {
        defaultConfiguration: 'local',
        '...': true,
        executor: expectedExecutor,
        options: {
          outputFile: 'reports/ignored-options.json',
          '...': true,
          project: 'app',
        },
        configurations: {
          local: { outputFile: 'reports/local.json' },
          ci: { outputFile: 'reports/ignored-ci.json', '...': true },
        },
      },
    },
  });
  const root = read('package.json');
  root.nx.targets['check-boundaries-all'] = {
    cache: false,
    '...': true,
    executor: expectedExecutor,
    options: { '...': true },
  };
  json('package.json', root);
  json('nx.json', {
    ...settings,
    targetDefaults: {
      'check-boundaries': [
        {
          filter: { projects: ['app'] },
          defaultConfiguration: 'ci',
          cache: true,
          options: { outputFile: 'reports/base-options.json' },
          configurations: { ci: { outputFile: 'reports/spread-ci.json' } },
        },
      ],
      'check-boundaries-all': {
        cache: true,
        options: { outputFile: 'reports/spread-all.json' },
      },
    },
  });
  const before = await pnpm(['nx', 'show', 'project', 'app', '--json']);
  expect(before.code, before.text).toBe(0);
  expect(
    parsedJson(before.text).targets['check-boundaries'].defaultConfiguration,
  ).toBe('ci');
  const initArgs = [
    'nx',
    'g',
    '@hao-nx-toolkit/project-boundary:init',
    '--no-interactive',
  ];
  const initialized = await pnpm(initArgs);
  expect(initialized.code, initialized.text).toBe(0);
  const app = await pnpm(['nx', 'show', 'project', 'app', '--json']);
  expect(app.code, app.text).toBe(0);
  expect(parsedJson(app.text).targets['check-boundaries']).toMatchObject({
    executor: expectedExecutor,
    defaultConfiguration: 'ci',
    cache: false,
    inputs: expect.arrayContaining([
      'default',
      '{workspaceRoot}/project-boundary.config.json',
    ]),
    options: { project: 'app' },
    configurations: { ci: { outputFile: 'reports/spread-ci.json' } },
  });
  const appRun = await pnpm(['nx', 'run', 'app:check-boundaries']);
  expect(appRun.code, appRun.text).toBe(0);
  expect(read('reports/spread-ci.json')).toMatchObject({
    scope: { kind: 'project', project: 'app' },
    success: true,
  });
  const all = await pnpm([
    'nx',
    'show',
    'project',
    'boundary-fixture',
    '--json',
  ]);
  expect(all.code, all.text).toBe(0);
  const allTarget = parsedJson(all.text).targets['check-boundaries-all'];
  expect(allTarget.cache).toBe(false);
  expect(allTarget.executor).toBe(expectedExecutor);
  expect(allTarget.options.project).toBeUndefined();
  const allRun = await pnpm([
    'nx',
    'run',
    'boundary-fixture:check-boundaries-all',
  ]);
  expect(allRun.code, allRun.text).toBe(0);
  expect(read('reports/spread-all.json')).toMatchObject({
    scope: { kind: 'workspace' },
    success: true,
  });
  const stable = readFileSync(join(consumer, 'apps/app/project.json'), 'utf8');
  const repeated = await pnpm(initArgs);
  expect(repeated.code, repeated.text).toBe(0);
  expect(readFileSync(join(consumer, 'apps/app/project.json'), 'utf8')).toBe(
    stable,
  );

  const inferenceBefore = readFileSync(
    join(consumer, 'tools/inference.cjs'),
    'utf8',
  );
  writeFileSync(
    join(consumer, 'tools/inference.cjs'),
    `const {dirname} = require('node:path');
module.exports.createNodesV2 = ['**/inferred.marker', async files => files.map(file => [file, {projects: {[dirname(file)]: {name: 'inferred', targets: {build: {command: 'echo inferred-build'}, 'check-boundaries': {executor: '${expectedExecutor}', defaultConfiguration: 'ci', configurations: {ci: {project: 'app'}}}}}}}])];\n`,
  );
  const persisted = readFileSync(
    join(consumer, 'projects/inferred/project.json'),
    'utf8',
  );
  const rejected = await pnpm(initArgs);
  expect(rejected.code, rejected.text).toBe(1);
  expect(rejected.text).toContain('conflicting configuration project selector');
  expect(
    readFileSync(join(consumer, 'projects/inferred/project.json'), 'utf8'),
  ).toBe(persisted);
  writeFileSync(join(consumer, 'tools/inference.cjs'), inferenceBefore);
  json('apps/app/project.json', {
    ...read('apps/app/project.json'),
    targets: { 'check-boundaries': { options: { project: 'app' } } },
  });
  json('nx.json', {
    ...settings,
    targetDefaults: { 'check-boundaries': { executor: expectedExecutor } },
  });
  const inherited = await pnpm(initArgs);
  expect(inherited.code, inherited.text).toBe(0);
  const resolved = await pnpm(['nx', 'show', 'project', 'app', '--json']);
  expect(resolved.code, resolved.text).toBe(0);
  expect(parsedJson(resolved.text).targets['check-boundaries']).toMatchObject({
    executor: expectedExecutor,
    cache: false,
    options: { project: 'app' },
  });
}, 60_000);

it('refuses fresh targets whose compatible unsafe defaults survive foreign executor entries', async () => {
  json('apps/fresh-app/project.json', {
    name: 'fresh-app',
    tags: ['scope:app'],
  });
  json('apps/fresh-other/project.json', {
    name: 'fresh-other',
    tags: ['scope:other'],
  });
  json('nx.json', {
    ...read('nx.json'),
    targetDefaults: {
      'check-boundaries': [
        {
          filter: { projects: ['fresh-app'] },
          executor: '@hao-nx-toolkit/project-boundary:check',
          defaultConfiguration: 'ci',
          configurations: { ci: { project: 'fresh-other' } },
        },
        {
          filter: { projects: ['fresh-app'] },
          executor: 'nx:run-commands',
          options: { command: 'echo unrelated' },
        },
      ],
    },
  });
  const files = [
    'package.json',
    'project-boundary.config.json',
    'nx.json',
    'apps/fresh-app/project.json',
    'apps/fresh-other/project.json',
    'apps/app/project.json',
    'projects/inferred/project.json',
  ];
  const before = files.map((file) =>
    readFileSync(join(consumer, file), 'utf8'),
  );
  const result = await pnpm([
    'nx',
    'g',
    '@hao-nx-toolkit/project-boundary:init',
    '--no-interactive',
  ]);
  expect(result.code, result.text).toBe(1);
  expect(result.text).toContain('conflicting configuration project selector');
  expect(
    files.map((file) => readFileSync(join(consumer, file), 'utf8')),
  ).toEqual(before);
  expect(read('apps/fresh-app/project.json').targets).toBeUndefined();
  // Independently demonstrate the unsafe effective graph that initialization
  // refused to create: Nx keeps compatible ci and drops the foreign executor.
  json('apps/fresh-app/project.json', {
    ...read('apps/fresh-app/project.json'),
    targets: {
      'check-boundaries': {
        executor: '@hao-nx-toolkit/project-boundary:check',
        options: { project: 'fresh-app' },
      },
    },
  });
  const graph = await pnpm(['nx', 'show', 'project', 'fresh-app', '--json']);
  expect(graph.code, graph.text).toBe(0);
  expect(parsedJson(graph.text).targets['check-boundaries']).toMatchObject({
    executor: '@hao-nx-toolkit/project-boundary:check',
    defaultConfiguration: 'ci',
    options: { project: 'fresh-app' },
    configurations: { ci: { project: 'fresh-other' } },
  });
}, 60_000);
