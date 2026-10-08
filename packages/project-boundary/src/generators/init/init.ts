import {
  getProjects,
  logger,
  readJson,
  updateJson,
  writeJson,
  type Tree,
} from '@nx/devkit';
import type { InitGeneratorSchema } from './schema';

export async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema = {},
) {
  if (Object.keys(options).length)
    throw new Error('The init generator does not accept options');
  const rootProjectFile = tree.exists('project.json')
    ? 'project.json'
    : 'package.json';
  const rootJson = readJson(tree, rootProjectFile);
  const rootProject = [...getProjects(tree).values()].find(
    (project) => project.root === '.' || project.root === '',
  );
  const existing =
    rootProject?.targets?.['check-boundaries'] ??
    (rootProjectFile === 'project.json'
      ? rootJson.targets
      : rootJson.nx?.targets)?.['check-boundaries'];
  if (
    existing &&
    existing.executor !== '@hao-nx-toolkit/project-boundary:check'
  )
    throw new Error(
      'Root target check-boundaries already exists with a different executor',
    );
  updateJson(tree, rootProjectFile, (json) => {
    const config = rootProjectFile === 'project.json' ? json : (json.nx ??= {});
    config.name ??= rootProject?.name ?? rootJson.name ?? 'workspace';
    config.targets ??= {};
    config.targets['check-boundaries'] = {
      ...config.targets['check-boundaries'],
      executor: '@hao-nx-toolkit/project-boundary:check',
      cache: false,
    };
    return json;
  });
  if (!tree.exists('project-boundary.config.json')) {
    writeJson(tree, 'project-boundary.config.json', {
      $schema:
        './node_modules/@hao-nx-toolkit/project-boundary/dist/config-schema.json',
      depConstraints: [],
    });
  }
  logger.info(
    `Configure depConstraints in project-boundary.config.json, then run nx run ${rootProject?.name ?? rootJson.name ?? 'workspace'}:check-boundaries.`,
  );
}
export default initGenerator;
