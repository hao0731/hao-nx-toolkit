import { logger, readJson, updateJson, writeJson, type Tree } from '@nx/devkit';
import type { InitGeneratorSchema } from './schema';

const plugin = '@hao-nx-toolkit/project-boundary';

export async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema = {},
) {
  if (Object.keys(options).length)
    throw new Error('The init generator does not accept options');
  const rootFile = tree.exists('project.json')
    ? 'project.json'
    : 'package.json';
  let rootName = 'workspace';
  updateJson(tree, rootFile, (json) => {
    const config = rootFile === 'project.json' ? json : (json.nx ??= {});
    rootName = config.name ?? json.name ?? 'workspace';
    if (!config.name && !json.name) config.name = rootName;
    config.targets ??= {};
    config.targets['check-boundaries-all'] ??= {
      executor: `${plugin}:check`,
      cache: false,
      inputs: ['default', '{workspaceRoot}/project-boundary.config.json'],
    };
    return json;
  });
  const nx = tree.exists('nx.json') ? readJson(tree, 'nx.json') : {};
  nx.plugins ??= [];
  if (
    !nx.plugins.some(
      (entry: string | { plugin: string }) =>
        (typeof entry === 'string' ? entry : entry.plugin) === plugin,
    )
  )
    nx.plugins.push({ plugin });
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
