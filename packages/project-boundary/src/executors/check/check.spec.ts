import type { ExecutorContext, ProjectGraph } from '@nx/devkit';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import executor from './check';

let root: string;
let graph: ProjectGraph;
let messages: string[];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'project-boundary-'));
  graph = {
    nodes: {
      app: {
        name: 'app',
        type: 'app',
        data: { root: 'app', tags: ['scope:app'] },
      },
      lib: {
        name: 'lib',
        type: 'lib',
        data: { root: 'lib', tags: ['scope:lib'] },
      },
    },
    dependencies: { app: [{ source: 'app', target: 'lib', type: 'static' }] },
  };
  messages = [];
  vi.spyOn(console, 'log').mockImplementation((message) =>
    messages.push(String(message)),
  );
  vi.spyOn(console, 'error').mockImplementation((message) =>
    messages.push(String(message)),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

function configure(depConstraints: unknown[]) {
  writeFileSync(
    join(root, 'project-boundary.config.json'),
    JSON.stringify({ depConstraints }),
  );
}

function context(): ExecutorContext {
  return {
    root,
    cwd: root,
    isVerbose: false,
    projectGraph: graph,
    projectsConfigurations: { version: 2, projects: {} },
    nxJsonConfiguration: {},
  };
}

it('fails with a readable source, target and tag diagnostic for a forbidden dependency', async () => {
  configure([
    { sourceTag: 'scope:app', onlyDependOnProjectsWithTags: ['scope:shared'] },
  ]);
  expect(await executor({}, context())).toEqual({ success: false });
  expect(messages.join('\n')).toContain('app → lib');
  expect(messages.join('\n')).toContain('scope:app');
  expect(messages.join('\n')).toContain('scope:lib');
  expect(messages.join('\n')).toContain('onlyDependOnProjectsWithTags');
});

it('passes when the target has an allowed exact tag', async () => {
  configure([
    {
      sourceTag: 'scope:app',
      onlyDependOnProjectsWithTags: ['scope:shared', 'scope:lib'],
    },
  ]);
  expect(await executor({}, context())).toEqual({ success: true });
  expect(messages.join('\n')).toContain('passed');
});

it('fails uncovered sources with project dependencies but permits isolated projects', async () => {
  configure([]);
  expect(await executor({}, context())).toEqual({ success: false });
  expect(messages.join('\n')).toContain('no matching constraint');
  graph.dependencies = {};
  expect(await executor({}, context())).toEqual({ success: true });
});

it('checks only the selected source outgoing project edges and ignores external packages', async () => {
  configure([
    { sourceTag: 'scope:app', onlyDependOnProjectsWithTags: ['scope:lib'] },
  ]);
  graph.nodes.incoming = {
    name: 'incoming',
    type: 'app',
    data: { root: 'incoming' },
  };
  graph.nodes.downstream = {
    name: 'downstream',
    type: 'lib',
    data: { root: 'downstream' },
  };
  graph.dependencies.incoming = [
    { source: 'incoming', target: 'app', type: 'implicit' },
  ];
  graph.dependencies.lib = [
    { source: 'lib', target: 'downstream', type: 'dynamic' },
  ];
  graph.dependencies.app.push({
    source: 'app',
    target: 'npm:external',
    type: 'static',
  });
  expect(await executor({ project: 'app' }, context())).toEqual({
    success: true,
  });
  expect(await executor({}, context())).toEqual({ success: false });
});

it('returns a configuration error for unsupported fields instead of silently accepting them', async () => {
  configure([
    {
      sourceTag: 'scope:app',
      onlyDependOnProjectsWithTags: ['scope:lib'],
      exclusions: ['app'],
    },
  ]);
  expect(await executor({}, context())).toEqual({ success: false });
  expect(messages.join('\n')).toContain('Configuration error');
  expect(messages.join('\n')).toContain('exclusions');
});

it.each([
  { depConstraints: 'invalid' },
  { depConstraints: [], exclusions: ['app'] },
  {
    depConstraints: [
      { sourceTag: 'scope:app', onlyDependOnProjectsWithTags: 'scope:lib' },
    ],
  },
  {
    depConstraints: [
      { sourceTag: 123, onlyDependOnProjectsWithTags: ['scope:lib'] },
    ],
  },
  { depConstraints: [{ allSourceTags: [] }] },
])('rejects invalid configuration %j', async (config) => {
  writeFileSync(
    join(root, 'project-boundary.config.json'),
    JSON.stringify(config),
  );
  expect(await executor({}, context())).toEqual({ success: false });
  expect(messages.join('\n')).toContain('Configuration error');
});

it('reports invalid project selection and missing configuration as failures', async () => {
  configure([]);
  expect(await executor({ project: 'missing' }, context())).toEqual({
    success: false,
  });
  expect(messages.join('\n')).toContain('Unknown project');
  rmSync(join(root, 'project-boundary.config.json'));
  expect(await executor({}, context())).toEqual({ success: false });
  expect(messages.join('\n')).toContain('project-boundary.config.json');
});

it.each(['static', 'dynamic', 'implicit'])(
  'applies constraints to %s project dependencies',
  async (type) => {
    configure([
      {
        sourceTag: 'scope:app',
        onlyDependOnProjectsWithTags: ['scope:shared'],
      },
    ]);
    graph.dependencies.app[0].type = type;
    expect(await executor({}, context())).toEqual({ success: false });
  },
);

it('requires every matched constraint to pass even when another permits the target', async () => {
  configure([
    { sourceTag: 'scope:app', onlyDependOnProjectsWithTags: ['scope:lib'] },
    {
      sourceTag: 'scope:app',
      onlyDependOnProjectsWithTags: ['role:production'],
    },
  ]);
  expect(await executor({}, context())).toEqual({ success: false });
});

it('ignores a source whose only dependency is an external package', async () => {
  configure([]);
  graph.dependencies.app = [
    { source: 'app', target: 'npm:external', type: 'static' },
  ];
  expect(await executor({}, context())).toEqual({ success: true });
});

it('requires every allSourceTags entry and permits source-only constraints', async () => {
  configure([{ allSourceTags: ['scope:app', 'role:production'] }]);
  expect(await executor({}, context())).toEqual({ success: false });
  graph.nodes.app.data.tags = ['scope:app', 'role:production'];
  expect(await executor({}, context())).toEqual({ success: true });
});

it('rejects a directly denied target even when an allow constraint permits it', async () => {
  configure([
    {
      sourceTag: 'scope:app',
      onlyDependOnProjectsWithTags: ['scope:lib'],
      notDependOnProjectsWithTags: ['scope:lib'],
    },
  ]);
  expect(await executor({}, context())).toEqual({ success: false });
  expect(messages.join('\n')).toContain('notDependOnProjectsWithTags');
  configure([{ sourceTag: 'scope:app', notDependOnProjectsWithTags: [] }]);
  expect(await executor({}, context())).toEqual({ success: true });
});

it.each([
  ['scope:*', 'scope:*'],
  ['/^scope:app$/', '/^scope:lib$/'],
  ['*', '*'],
])('matches source %s and target %s patterns', async (sourceTag, targetTag) => {
  configure([{ sourceTag, onlyDependOnProjectsWithTags: [targetTag] }]);
  expect(await executor({}, context())).toEqual({ success: true });
  if (sourceTag === '*') {
    graph.nodes.app.data.tags = [];
    graph.nodes.lib.data.tags = [];
    expect(await executor({}, context())).toEqual({ success: true });
  }
});

it('anchors glob matches and treats non-star characters literally', async () => {
  graph.nodes.app.data.tags = ['scope:app[1].+?'];
  configure([{ sourceTag: 'scope:app[1].+?*' }]);
  expect(await executor({}, context())).toEqual({ success: true });
  graph.nodes.app.data.tags = ['prefix-scope:app[1].+?'];
  expect(await executor({}, context())).toEqual({ success: false });
});

it.each(['/[/', '/unterminated', '/pattern/i'])(
  'rejects invalid regex %s eagerly even in unused constraints',
  async (pattern) => {
    configure([
      { sourceTag: 'unused', notDependOnProjectsWithTags: [pattern] },
    ]);
    graph.dependencies = {};
    expect(await executor({}, context())).toEqual({ success: false });
    expect(messages.join('\n')).toContain('Configuration error');
  },
);

it('treats backslashes literally in exact tags and glob patterns', async () => {
  graph.nodes.app.data.tags = ['path:\\service'];
  configure([{ sourceTag: 'path:\\*' }]);
  expect(await executor({}, context())).toEqual({ success: true });
});

it('writes a versioned JSON report for the selected project and its exact violations', async () => {
  configure([{ sourceTag: 'scope:app', onlyDependOnProjectsWithTags: [] }]);
  expect(
    await executor(
      { project: 'app', outputFile: 'boundary-report.json' },
      context(),
    ),
  ).toEqual({ success: false });
  expect(
    JSON.parse(readFileSync(join(root, 'boundary-report.json'), 'utf8')),
  ).toEqual({
    version: 1,
    scope: { kind: 'project', project: 'app' },
    success: false,
    errors: [],
    violations: [
      {
        kind: 'disallowed-target',
        source: 'app',
        target: 'lib',
        sourceTags: ['scope:app'],
        targetTags: ['scope:lib'],
        dependencyType: 'static',
        constraintIndex: 0,
        constraint: {
          sourceTag: 'scope:app',
          onlyDependOnProjectsWithTags: [],
        },
      },
    ],
  });
});

it('replaces a successful report with a failed configuration report', async () => {
  configure([{ sourceTag: '*' }]);
  const options = { outputFile: 'reports/boundary.json' };
  expect(await executor(options, context())).toEqual({ success: true });
  configure([{ sourceTag: 'unused', notDependOnProjectsWithTags: ['/[/'] }]);
  expect(await executor(options, context())).toEqual({ success: false });
  const report = JSON.parse(
    readFileSync(join(root, options.outputFile), 'utf8'),
  );
  expect(report).toMatchObject({
    version: 1,
    scope: { kind: 'workspace' },
    success: false,
    violations: [],
    errors: [{ kind: 'configuration' }],
  });
});

it('refuses to overwrite the input configuration and fails if a report cannot be written', async () => {
  configure([{ sourceTag: '*' }]);
  const configFile = join(root, 'project-boundary.config.json');
  const original = readFileSync(configFile, 'utf8');
  expect(
    await executor({ outputFile: 'project-boundary.config.json' }, context()),
  ).toEqual({ success: false });
  expect(readFileSync(configFile, 'utf8')).toBe(original);
  writeFileSync(join(root, 'blocked'), 'not a directory');
  expect(
    await executor({ outputFile: 'blocked/report.json' }, context()),
  ).toEqual({ success: false });
  expect(messages.join('\n')).toContain('Report error');
});

it('protects configuration aliases and writes unknown-project errors into the report', async () => {
  configure([{ sourceTag: '*' }]);
  symlinkSync(
    join(root, 'project-boundary.config.json'),
    join(root, 'config-alias.json'),
  );
  expect(
    await executor({ outputFile: 'config-alias.json' }, context()),
  ).toEqual({ success: false });
  expect(
    JSON.parse(
      readFileSync(join(root, 'project-boundary.config.json'), 'utf8'),
    ),
  ).toEqual({ depConstraints: [{ sourceTag: '*' }] });
  expect(
    await executor(
      { project: 'unknown', outputFile: 'report.json' },
      context(),
    ),
  ).toEqual({ success: false });
  expect(
    JSON.parse(readFileSync(join(root, 'report.json'), 'utf8')),
  ).toMatchObject({
    success: false,
    errors: [{ kind: 'configuration', message: 'Unknown project: unknown' }],
  });
});

it('reports uncovered sources and produces stable ordering independent of graph insertion order', async () => {
  configure([]);
  graph.nodes.zeta = {
    name: 'zeta',
    type: 'lib',
    data: { root: 'zeta', tags: ['z', 'a'] },
  };
  graph.dependencies.zeta = [
    { source: 'zeta', target: 'lib', type: 'implicit' },
  ];
  await executor({ outputFile: 'report.json' }, context());
  const first = readFileSync(join(root, 'report.json'), 'utf8');
  expect(JSON.parse(first).violations).toEqual([
    { kind: 'unmatched-source', source: 'app', sourceTags: ['scope:app'] },
    { kind: 'unmatched-source', source: 'zeta', sourceTags: ['a', 'z'] },
  ]);
  graph.nodes = Object.fromEntries(Object.entries(graph.nodes).reverse());
  graph.dependencies = Object.fromEntries(
    Object.entries(graph.dependencies).reverse(),
  );
  await executor({ outputFile: 'report.json' }, context());
  expect(readFileSync(join(root, 'report.json'), 'utf8')).toBe(first);
});

it('checks deny constraints on direct targets without walking downstream dependencies', async () => {
  configure([
    {
      sourceTag: 'scope:app',
      notDependOnProjectsWithTags: ['scope:forbidden'],
    },
  ]);
  graph.nodes.downstream = {
    name: 'downstream',
    type: 'lib',
    data: { root: 'downstream', tags: ['scope:forbidden'] },
  };
  graph.dependencies.lib = [
    { source: 'lib', target: 'downstream', type: 'dynamic' },
  ];
  expect(await executor({ project: 'app' }, context())).toEqual({
    success: true,
  });
});

it.each([
  { sourceTag: '*', allSourceTags: ['scope:app'] },
  { allSourceTags: [null] },
  { sourceTag: '*', notDependOnProjectsWithTags: 'scope:lib' },
  { sourceTag: '*', onlyDependOnProjectsWithTags: [null] },
  {},
])('rejects malformed constraints %j', async (constraint) => {
  configure([constraint]);
  expect(await executor({}, context())).toEqual({ success: false });
  expect(messages.join('\n')).toContain('Configuration error');
});

it('accepts a string $schema annotation but rejects unsupported executor options', async () => {
  writeFileSync(
    join(root, 'project-boundary.config.json'),
    JSON.stringify({
      $schema: './schema.json',
      depConstraints: [{ sourceTag: '*' }],
    }),
  );
  expect(await executor({}, context())).toEqual({ success: true });
  expect(await executor({ exclusions: ['app'] } as never, context())).toEqual({
    success: false,
  });
  expect(messages.join('\n')).toContain('Unsupported executor option');
});

it('does not create or overwrite missing input through a dangling report symlink', async () => {
  const configPath = join(root, 'project-boundary.config.json');
  symlinkSync(configPath, join(root, 'alias.json'));
  expect(await executor({ outputFile: 'alias.json' }, context())).toEqual({
    success: false,
  });
  expect(() => readFileSync(configPath)).toThrow();
});
