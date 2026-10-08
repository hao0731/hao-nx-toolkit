import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, writeJson, type Tree } from '@nx/devkit';
import initGenerator from './init';

let tree: Tree;
beforeEach(() => {
  tree = createTreeWithEmptyWorkspace();
});

it('initializes one uncached root target and a fail-closed configuration', async () => {
  await initGenerator(tree, {});
  const config = readJson(tree, 'project-boundary.config.json');
  expect(config.depConstraints).toEqual([]);
  expect(readJson(tree, 'package.json').nx.targets['check-boundaries']).toEqual(
    { executor: '@hao-nx-toolkit/project-boundary:check', cache: false },
  );
  expect(tree.children('libs')).toEqual([]);
});

it('preserves existing config bytes, unrelated package settings, and matching target options on reruns', async () => {
  const existing = '{ "depConstraints": [{"sourceTag":"custom"}] }\n';
  tree.write('project-boundary.config.json', existing);
  writeJson(tree, 'package.json', {
    name: '@sample/root',
    private: true,
    scripts: { build: 'echo build' },
    nx: {
      tags: ['existing'],
      targets: {
        build: { command: 'echo build' },
        'check-boundaries': {
          executor: '@hao-nx-toolkit/project-boundary:check',
          cache: true,
          options: { outputFile: 'report.json' },
        },
      },
    },
  });
  await initGenerator(tree, {});
  const first = tree.read('package.json')?.toString();
  await initGenerator(tree, {});
  expect(tree.read('package.json')?.toString()).toBe(first);
  expect(tree.read('project-boundary.config.json')?.toString()).toBe(existing);
  expect(readJson(tree, 'package.json')).toMatchObject({
    private: true,
    scripts: { build: 'echo build' },
    nx: {
      tags: ['existing'],
      targets: {
        build: { command: 'echo build' },
        'check-boundaries': {
          cache: false,
          options: { outputFile: 'report.json' },
        },
      },
    },
  });
});

it('updates the existing root project.json without creating duplicate package metadata', async () => {
  writeJson(tree, 'project.json', {
    name: 'workspace',
    root: '.',
    targets: { build: { command: 'echo build' } },
  });
  await initGenerator(tree, {});
  expect(readJson(tree, 'project.json').targets).toEqual({
    build: { command: 'echo build' },
    'check-boundaries': {
      executor: '@hao-nx-toolkit/project-boundary:check',
      cache: false,
    },
  });
  expect(readJson(tree, 'package.json').nx).toBeUndefined();
});

it('rejects a conflicting target before changing workspace files', async () => {
  writeJson(tree, 'package.json', {
    name: 'root',
    nx: { targets: { 'check-boundaries': { command: 'echo custom' } } },
  });
  const original = tree.read('package.json')?.toString();
  await expect(initGenerator(tree, {})).rejects.toThrow('check-boundaries');
  expect(tree.read('package.json')?.toString()).toBe(original);
  expect(tree.exists('project-boundary.config.json')).toBe(false);
});

it('gives a nameless root package a usable Nx project name', async () => {
  writeJson(tree, 'package.json', { private: true });
  await initGenerator(tree, {});
  expect(readJson(tree, 'package.json').nx.name).toBe('workspace');
});

it('rejects conflicting root project targets while preserving their file', async () => {
  writeJson(tree, 'project.json', {
    name: 'workspace',
    root: '.',
    targets: { 'check-boundaries': { executor: 'other:check' } },
  });
  const before = tree.read('project.json')?.toString();
  await expect(initGenerator(tree, {})).rejects.toThrow('different executor');
  expect(tree.read('project.json')?.toString()).toBe(before);
});

it('keeps existing root Nx metadata names and rejects unsupported initialization options', async () => {
  writeJson(tree, 'package.json', {
    name: '@sample/source',
    nx: { name: 'custom-workspace' },
  });
  await initGenerator(tree, {});
  expect(readJson(tree, 'package.json').nx.name).toBe('custom-workspace');
  await expect(
    initGenerator(tree, { name: 'another' } as never),
  ).rejects.toThrow('does not accept options');
});
