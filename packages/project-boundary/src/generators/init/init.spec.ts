import { vi } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readJson,
  writeJson,
  type Tree,
} from '@nx/devkit';
import initGenerator from './init';

afterEach(() => vi.restoreAllMocks());
let tree: Tree;
beforeEach(() => {
  tree = createTreeWithEmptyWorkspace();
});

it('initializes uncached project and workspace targets and a fail-closed configuration', async () => {
  await initGenerator(tree, {});
  const config = readJson(tree, 'project-boundary.config.json');
  expect(config.depConstraints).toEqual([]);
  expect(readJson(tree, 'package.json').nx.targets['check-boundaries']).toEqual(
    {
      executor: '@hao-nx-toolkit/project-boundary:check',
      cache: false,
      inputs: ['default', '{workspaceRoot}/project-boundary.config.json'],
      options: { project: '@proj/source' },
    },
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
        'check-boundaries-all': {
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
  expect(readJson(tree, 'project.json').targets).toMatchObject({
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

it('configures native affected project targets and a separate workspace target', async () => {
  addProjectConfiguration(tree, 'app', {
    root: 'apps/app',
    targets: { build: { command: 'echo build' } },
  });
  await initGenerator(tree);
  expect(readJson(tree, 'apps/app/project.json').targets).toMatchObject({
    build: { command: 'echo build' },
    'check-boundaries': {
      executor: '@hao-nx-toolkit/project-boundary:check',
      cache: false,
      inputs: ['default', '{workspaceRoot}/project-boundary.config.json'],
      options: { project: 'app' },
    },
  });
  expect(
    readJson(tree, 'package.json').nx.targets['check-boundaries-all'].options
      ?.project,
  ).toBeUndefined();
});

it('keeps custom inputs and restores normal project and policy inputs on reruns', async () => {
  addProjectConfiguration(tree, 'app', {
    root: 'apps/app',
    targets: {
      'check-boundaries': {
        executor: '@hao-nx-toolkit/project-boundary:check',
        inputs: ['{projectRoot}/custom.txt'],
        options: { project: 'app', outputFile: 'report.json' },
      },
    },
  });
  await initGenerator(tree);
  expect(
    readJson(tree, 'apps/app/project.json').targets['check-boundaries'],
  ).toMatchObject({
    inputs: [
      '{projectRoot}/custom.txt',
      'default',
      '{workspaceRoot}/project-boundary.config.json',
    ],
    options: { project: 'app', outputFile: 'report.json' },
  });
});

it('rejects another project selector before modifying any project or policy', async () => {
  addProjectConfiguration(tree, 'app', { root: 'apps/app' });
  addProjectConfiguration(tree, 'lib', {
    root: 'libs/lib',
    targets: {
      'check-boundaries': {
        executor: '@hao-nx-toolkit/project-boundary:check',
        options: { project: 'app' },
      },
    },
  });
  const before = tree.listChanges();
  await expect(initGenerator(tree)).rejects.toThrow(
    'conflicting project selector',
  );
  expect(tree.listChanges()).toEqual(before);
});

it('rejects scope-changing configurations inherited through target defaults', async () => {
  writeJson(tree, 'nx.json', {
    targetDefaults: {
      'check-boundaries': {
        configurations: { other: { project: 'another' } },
      },
    },
  });
  addProjectConfiguration(tree, 'app', { root: 'apps/app' });
  const before = tree.listChanges();
  await expect(initGenerator(tree)).rejects.toThrow(
    'conflicting configuration project selector',
  );
  expect(tree.listChanges()).toEqual(before);
});

it('chooses a unique root name when a nameless root conflicts with another project', async () => {
  writeJson(tree, 'package.json', { private: true });
  addProjectConfiguration(tree, 'workspace', { root: 'apps/workspace' });
  await initGenerator(tree);
  expect(readJson(tree, 'package.json').nx.name).toBe('workspace-1');
});

it('honors a pending project rename and target removal over the on-disk graph', async () => {
  const devkit = require('@nx/devkit') as typeof import('@nx/devkit');
  const fs = require('node:fs') as typeof import('node:fs');
  const exists = fs.existsSync;
  vi.spyOn(fs, 'existsSync').mockImplementation(
    (path) => path === '/virtual/nx.json' || exists(path),
  );
  vi.spyOn(devkit, 'workspaceRoot', 'get').mockReturnValue('/virtual');
  vi.spyOn(devkit, 'createProjectGraphAsync').mockResolvedValue({
    nodes: {
      old: {
        name: 'old',
        type: 'app',
        data: {
          root: 'apps/app',
          name: 'old',
          targets: { 'check-boundaries': { executor: 'other:check' } },
        },
      },
    },
    dependencies: { old: [] },
  });
  addProjectConfiguration(tree, 'renamed', { root: 'apps/app' });
  vi.resetModules();
  const initialize = (await import('./init.js')).initGenerator;
  await initialize(tree);
  expect(readJson(tree, 'apps/app/project.json')).toMatchObject({
    name: 'renamed',
    targets: { 'check-boundaries': { options: { project: 'renamed' } } },
  });
});

it('preserves package metadata when a root project.json coexists', async () => {
  writeJson(tree, 'package.json', {
    name: '@fixture/package',
    private: true,
    nx: { tags: ['existing'], targets: { build: { command: 'echo build' } } },
  });
  writeJson(tree, 'project.json', {
    name: 'workspace',
    root: '.',
    tags: ['root'],
    targets: { lint: { command: 'echo lint' } },
  });
  const packageBefore = tree.read('package.json')?.toString();
  await initGenerator(tree);
  expect(tree.read('package.json')?.toString()).toBe(packageBefore);
  expect(readJson(tree, 'project.json')).toMatchObject({
    name: 'workspace',
    tags: ['root'],
    targets: {
      lint: { command: 'echo lint' },
      'check-boundaries': { options: { project: 'workspace' } },
      'check-boundaries-all': {
        executor: '@hao-nx-toolkit/project-boundary:check',
      },
    },
  });
});

it('rejects wildcard defaults that select another project before writes', async () => {
  writeJson(tree, 'nx.json', {
    targetDefaults: {
      'check-*': {
        defaultConfiguration: 'ci',
        configurations: { ci: { project: 'other' } },
      },
    },
  });
  addProjectConfiguration(tree, 'app', { root: 'apps/app' });
  addProjectConfiguration(tree, 'other', { root: 'apps/other' });
  const before = tree.listChanges();
  await expect(initGenerator(tree)).rejects.toThrow(
    'conflicting configuration project selector',
  );
  expect(tree.listChanges()).toEqual(before);
});

it('preserves inherited default and named workspace reporting configurations during migration', async () => {
  writeJson(tree, 'package.json', {
    name: 'workspace',
    nx: {
      targets: {
        'check-boundaries': {
          executor: '@hao-nx-toolkit/project-boundary:check',
        },
      },
    },
  });
  writeJson(tree, 'nx.json', {
    targetDefaults: {
      'check-boundaries': {
        inputs: ['{projectRoot}/custom.txt'],
        defaultConfiguration: 'ci',
        configurations: {
          ci: { outputFile: 'reports/ci.json' },
          manual: { outputFile: 'reports/manual.json' },
        },
      },
    },
  });
  await initGenerator(tree);
  expect(
    readJson(tree, 'package.json').nx.targets['check-boundaries-all'],
  ).toMatchObject({
    defaultConfiguration: 'ci',
    configurations: {
      ci: { outputFile: 'reports/ci.json' },
      manual: { outputFile: 'reports/manual.json' },
    },
    inputs: [
      '{projectRoot}/custom.txt',
      'default',
      '{workspaceRoot}/project-boundary.config.json',
    ],
  });
});

it('applies filtered defaults in Nx precedence while leaving normal settings dynamic', async () => {
  addProjectConfiguration(tree, 'app', {
    root: 'apps/app',
    tags: ['scope:app'],
  });
  writeJson(tree, 'nx.json', {
    targetDefaults: {
      '@hao-nx-toolkit/project-boundary:check': [
        { filter: { projects: ['other'] }, options: { project: 'wrong' } },
      ],
      'check-boundaries': [
        { filter: { plugin: 'other-plugin' }, options: { project: 'wrong' } },
        {
          filter: {
            projects: ['tag:scope:app'],
            executor: '@hao-nx-toolkit/project-boundary:check',
          },
          inputs: ['{projectRoot}/first.txt'],
          configurations: { ci: { outputFile: 'first.json' } },
        },
        {
          filter: { projects: ['app'] },
          inputs: ['{projectRoot}/second.txt'],
          configurations: { ci: { outputFile: 'second.json' } },
        },
      ],
      'check-*': { options: { project: 'wrong' } },
    },
  });
  // Root doesn't match the exact-key entries, so its wildcard fallback is unsafe.
  const before = tree.listChanges();
  await expect(initGenerator(tree)).rejects.toThrow(
    'conflicting project selector',
  );
  expect(tree.listChanges()).toEqual(before);
  writeJson(tree, 'nx.json', {
    ...readJson(tree, 'nx.json'),
    targetDefaults: {
      ...readJson(tree, 'nx.json').targetDefaults,
      'check-*': {},
    },
  });
  await initGenerator(tree);
  const target = readJson(tree, 'apps/app/project.json').targets[
    'check-boundaries'
  ];
  expect(target.inputs).toEqual([
    '{projectRoot}/second.txt',
    'default',
    '{workspaceRoot}/project-boundary.config.json',
  ]);
  expect(target.options).toEqual({ project: 'app' });
  expect(target.configurations).toBeUndefined();
  expect(target.defaultConfiguration).toBeUndefined();
});

it('rejects matched filtered default configurations using inferred tags', async () => {
  const devkit = require('@nx/devkit') as typeof import('@nx/devkit');
  const fs = require('node:fs') as typeof import('node:fs');
  const exists = fs.existsSync;
  vi.spyOn(fs, 'existsSync').mockImplementation(
    (path) => path === '/virtual/nx.json' || exists(path),
  );
  vi.spyOn(devkit, 'workspaceRoot', 'get').mockReturnValue('/virtual');
  vi.spyOn(devkit, 'createProjectGraphAsync').mockResolvedValue({
    nodes: {
      app: {
        name: 'app',
        type: 'app',
        data: { root: 'apps/app', tags: ['scope:inferred'] },
      },
    },
    dependencies: { app: [] },
  });
  addProjectConfiguration(tree, 'app', {
    root: 'apps/app',
    tags: ['scope:explicit'],
  });
  writeJson(tree, 'nx.json', {
    targetDefaults: {
      'check-boundaries': [
        {
          filter: { projects: ['tag:scope:inferred'] },
          configurations: { ci: { project: 'other' } },
        },
      ],
    },
  });
  const before = tree.listChanges();
  vi.resetModules();
  const initialize = (await import('./init.js')).initGenerator;
  await expect(initialize(tree)).rejects.toThrow(
    'conflicting configuration project selector',
  );
  expect(tree.listChanges()).toEqual(before);
});

it('merges explicit legacy configurations with inherited reporting configurations', async () => {
  writeJson(tree, 'package.json', {
    name: 'workspace',
    nx: {
      targets: {
        'check-boundaries': {
          executor: '@hao-nx-toolkit/project-boundary:check',
          configurations: { local: { outputFile: 'local.json' } },
        },
      },
    },
  });
  writeJson(tree, 'nx.json', {
    targetDefaults: {
      'check-boundaries': { configurations: { ci: { outputFile: 'ci.json' } } },
    },
  });
  await initGenerator(tree);
  expect(
    readJson(tree, 'package.json').nx.targets['check-boundaries-all']
      .configurations,
  ).toEqual({
    ci: { outputFile: 'ci.json' },
    local: { outputFile: 'local.json' },
  });
});
