import type { ExecutorContext, ProjectGraph } from '@nx/devkit';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
      { sourceTag: 'scope:*', onlyDependOnProjectsWithTags: ['scope:lib'] },
    ],
  },
  { depConstraints: [{ sourceTag: 'scope:app' }] },
])('rejects invalid baseline configuration %j', async (config) => {
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
