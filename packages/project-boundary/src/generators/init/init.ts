import {
  createProjectGraphAsync,
  getProjects,
  logger,
  readJson,
  updateJson,
  workspaceRoot,
  writeJson,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { assertProjectCoverage, configuredProjectRoots } from '../../discovery';
import type { InitGeneratorSchema } from './schema';

const plugin = '@hao-nx-toolkit/project-boundary';

export async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema = {},
) {
  if (Object.keys(options).length)
    throw new Error('The init generator does not accept options');
  const nx = tree.exists('nx.json') ? readJson(tree, 'nx.json') : {};
  nx.plugins ??= [];
  if (
    !nx.plugins.some(
      (entry: string | { plugin: string }) =>
        (typeof entry === 'string' ? entry : entry.plugin) === plugin,
    )
  )
    nx.plugins.push({ plugin });
  const projects = new Map<string, ProjectConfiguration>(getProjects(tree));
  if (existsSync(join(tree.root, 'nx.json'))) {
    if (tree.root !== workspaceRoot)
      throw new Error('Initialization must run in the active Nx workspace');
    const graph = await createProjectGraphAsync();
    for (const [name, node] of Object.entries(graph.nodes)) {
      const removed = tree
        .listChanges()
        .some(
          (change) =>
            change.type === 'DELETE' &&
            [
              join(node.data.root, 'project.json'),
              join(node.data.root, 'package.json'),
            ].includes(change.path),
        );
      if (
        !removed &&
        ![...projects.values()].some(
          (project) => project.root === node.data.root,
        )
      )
        projects.set(name, node.data);
    }
  }
  const roots = await configuredProjectRoots(tree.root, nx, tree);
  assertProjectCoverage(Object.fromEntries(projects), roots);
  const rootFile = tree.exists('project.json')
    ? 'project.json'
    : 'package.json';
  const existingRoot = [...projects.entries()].find(
    ([, project]) => project.root === '.' || project.root === '',
  );
  let rootName = 'workspace';
  updateJson(tree, rootFile, (json) => {
    const config = rootFile === 'project.json' ? json : (json.nx ??= {});
    rootName = existingRoot?.[0] ?? config.name ?? json.name ?? 'workspace';
    if (!existingRoot) {
      let suffix = 0;
      while (projects.has(rootName)) rootName = `workspace-${++suffix}`;
    }
    if (rootName !== json.name && config.name !== rootName)
      config.name = rootName;
    config.targets ??= {};
    config.targets['check-boundaries-all'] ??= {
      executor: `${plugin}:check`,
      cache: false,
      inputs: ['default', '{workspaceRoot}/project-boundary.config.json'],
    };
    return json;
  });
  writeJson(tree, 'nx.json', nx);
  if (!tree.exists('project-boundary.config.json'))
    writeJson(tree, 'project-boundary.config.json', {
      $schema:
        './node_modules/@hao-nx-toolkit/project-boundary/dist/config-schema.json',
      depConstraints: [],
    });
  logger.info(
    `Configure depConstraints in project-boundary.config.json, then run nx run ${rootName}:check-boundaries-all or nx affected -t check-boundaries.`,
  );
}
export default initGenerator;
