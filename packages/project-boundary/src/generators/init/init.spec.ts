import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readJson,
  writeJson,
  type Tree,
} from '@nx/devkit';
import initGenerator from './init';

let tree: Tree;
beforeEach(() => {
  tree = createTreeWithEmptyWorkspace();
});

it('registers inference at root without modifying project configuration', async () => {
  addProjectConfiguration(tree, 'app', { root: 'apps/app' });
  const before = tree.read('apps/app/project.json')?.toString();
  await initGenerator(tree);
  expect(tree.read('apps/app/project.json')?.toString()).toBe(before);
  expect(readJson(tree, 'nx.json').plugins).toContainEqual({
    plugin: '@hao-nx-toolkit/project-boundary',
  });
  expect(
    readJson(tree, 'package.json').nx.targets['check-boundaries-all'],
  ).toMatchObject({
    executor: '@hao-nx-toolkit/project-boundary:check',
    cache: false,
  });
  expect(
    readJson(tree, 'package.json').nx.targets['check-boundaries'],
  ).toBeUndefined();
  expect(readJson(tree, 'project-boundary.config.json').depConstraints).toEqual(
    [],
  );
});

it('preserves authored targets, policy bytes and configured marker options on repeat initialization', async () => {
  const policy = '{ "depConstraints": [{"sourceTag":"custom"}] }\n';
  tree.write('project-boundary.config.json', policy);
  writeJson(tree, 'package.json', {
    name: 'workspace',
    private: true,
    nx: {
      targets: {
        'check-boundaries': { command: 'echo custom' },
        'check-boundaries-all': { command: 'echo all' },
      },
    },
  });
  writeJson(tree, 'nx.json', {
    plugins: [
      {
        plugin: '@hao-nx-toolkit/project-boundary',
        options: { projectMarkers: ['**/go.mod'] },
      },
    ],
    targetDefaults: { 'check-boundaries': { cache: true } },
  });
  const rootBefore = tree.read('package.json')?.toString();
  const nxBefore = tree.read('nx.json')?.toString();
  await initGenerator(tree);
  await initGenerator(tree);
  expect(tree.read('package.json')?.toString()).toBe(rootBefore);
  expect(tree.read('nx.json')?.toString()).toBe(nxBefore);
  expect(tree.read('project-boundary.config.json')?.toString()).toBe(policy);
});

it('uses the existing root project.json while preserving package metadata', async () => {
  writeJson(tree, 'project.json', {
    name: 'workspace',
    targets: { build: { command: 'echo build' } },
  });
  const packageBefore = tree.read('package.json')?.toString();
  await initGenerator(tree);
  expect(tree.read('package.json')?.toString()).toBe(packageBefore);
  expect(readJson(tree, 'project.json').targets).toMatchObject({
    build: { command: 'echo build' },
    'check-boundaries-all': {
      executor: '@hao-nx-toolkit/project-boundary:check',
    },
  });
});

it('gives a nameless root package an Nx name and rejects unsupported init options', async () => {
  writeJson(tree, 'package.json', { private: true });
  await initGenerator(tree);
  expect(readJson(tree, 'package.json').nx.name).toBe('workspace');
  await expect(initGenerator(tree, { name: 'other' } as never)).rejects.toThrow(
    'does not accept options',
  );
});

it('assigns a collision-free generated name to a nameless root', async () => {
  writeJson(tree, 'package.json', { private: true });
  addProjectConfiguration(tree, 'workspace', { root: 'apps/workspace' });
  addProjectConfiguration(tree, 'workspace-1', { root: 'apps/other' });
  await initGenerator(tree);
  expect(readJson(tree, 'package.json').nx.name).toBe('workspace-2');
});

it('reports uncovered projects before writes when Nx registration filters disable inference', async () => {
  addProjectConfiguration(tree, 'app', { root: 'apps/app' });
  writeJson(tree, 'nx.json', {
    plugins: [
      { plugin: '@hao-nx-toolkit/project-boundary', exclude: ['nx.json'] },
    ],
  });
  const before = tree.listChanges();
  await expect(initGenerator(tree)).rejects.toThrow('app (apps/app)');
  expect(tree.listChanges()).toEqual(before);
});
