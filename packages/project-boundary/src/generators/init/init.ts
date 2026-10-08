import {
  createProjectGraphAsync,
  workspaceRoot,
  getProjects,
  logger,
  readJson,
  updateJson,
  writeJson,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { existsSync } from 'node:fs';
import { join, normalize } from 'node:path';
import type { InitGeneratorSchema } from './schema';

type StoredProject = {
  name?: string;
  targets?: Record<string, TargetConfiguration>;
  nx?: StoredProject;
};

const executor = '@hao-nx-toolkit/project-boundary:check';
const policyInput = '{workspaceRoot}/project-boundary.config.json';

export async function initGenerator(
  tree: Tree,
  options: InitGeneratorSchema = {},
) {
  if (Object.keys(options).length)
    throw new Error('The init generator does not accept options');
  const projects = new Map<string, ProjectConfiguration>();
  // Tree discovery omits plugin-inferred projects. Retain their names and resolved
  // targets for validation, but persist only this generator's target additions.
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
      if (!removed) projects.set(name, node.data);
    }
  }
  for (const [name, project] of getProjects(tree)) {
    const previous = [...projects.entries()].find(
      ([, candidate]) =>
        normalize(candidate.root || '.') === normalize(project.root || '.'),
    );
    const resolved = previous?.[1];
    const renamed = previous && previous[0] !== name;
    if (previous) projects.delete(previous[0]);
    projects.set(name, {
      ...resolved,
      ...project,
      // A pending rename owns its explicit target selection; the disk graph
      // still refers to the previous identity and must not restore its targets.
      targets: renamed
        ? project.targets
        : { ...resolved?.targets, ...project.targets },
    });
  }
  let root = [...projects.entries()].find(
    ([, project]) => project.root === '.' || project.root === '',
  );
  if (!root) {
    const file = tree.exists('project.json') ? 'project.json' : 'package.json';
    const json = readJson(tree, file);
    let name = json.nx?.name ?? json.name ?? 'workspace';
    if (projects.has(name)) {
      let suffix = 1;
      while (projects.has(`workspace-${suffix}`)) suffix++;
      name = `workspace-${suffix}`;
    }
    root = [
      name,
      {
        root: '.',
        name,
        targets: file === 'project.json' ? json.targets : json.nx?.targets,
      },
    ];
    projects.set(...root);
  }
  const rootName = root[0];
  const defaults = tree.exists('nx.json')
    ? (readJson(tree, 'nx.json').targetDefaults ?? {})
    : {};
  const changes: {
    file: string;
    package: boolean;
    name: string;
    targets: Record<string, TargetConfiguration>;
  }[] = [];
  for (const [name, project] of projects) {
    const projectFile = join(project.root, 'project.json');
    const packageFile = join(project.root, 'package.json');
    const file = tree.exists(projectFile)
      ? projectFile
      : tree.exists(packageFile)
        ? packageFile
        : projectFile;
    const isPackage = file === packageFile;
    const json = tree.exists(file) ? readJson(tree, file) : {};
    const persisted = isPackage ? (json.nx ?? {}) : json;
    const targets: Record<string, TargetConfiguration> = {};
    const existing = project.targets?.['check-boundaries'];
    const legacy =
      name === rootName && existing && existing.options?.project === undefined;
    for (const targetName of [
      'check-boundaries',
      ...(name === rootName ? ['check-boundaries-all'] : []),
    ]) {
      const current =
        targetName === 'check-boundaries-all'
          ? (project.targets?.[targetName] ?? (legacy ? existing : undefined))
          : existing;
      if (current && current.executor !== executor)
        throw new Error(
          `${name} target ${targetName} already exists with a different executor`,
        );
      const inherited = defaults[executor] ?? defaults[targetName] ?? {};
      const expected = targetName === 'check-boundaries' ? name : undefined;
      for (const candidate of [current, inherited]) {
        if (
          candidate?.options?.project !== undefined &&
          candidate.options.project !== expected
        )
          throw new Error(
            `${name} target ${targetName} has a conflicting project selector`,
          );
        for (const configuration of Object.values(
          candidate?.configurations ?? {},
        ) as Record<string, unknown>[])
          if (
            configuration.project !== undefined &&
            configuration.project !== expected
          )
            throw new Error(
              `${name} target ${targetName} has a conflicting configuration project selector`,
            );
      }
      const saved =
        persisted.targets?.[targetName] ??
        (targetName === 'check-boundaries-all' && legacy
          ? persisted.targets?.['check-boundaries']
          : undefined);
      const inputs = [
        ...(saved?.inputs ??
          current?.inputs ??
          inherited.inputs ?? ['default']),
      ];
      if (!inputs.includes('default')) inputs.push('default');
      if (!inputs.includes(policyInput)) inputs.push(policyInput);
      targets[targetName] = {
        ...saved,
        executor,
        cache: false,
        inputs,
        options: {
          ...inherited.options,
          ...current?.options,
          ...saved?.options,
          ...(expected === undefined ? {} : { project: expected }),
        },
      };
    }
    changes.push({ file, package: isPackage, name, targets });
  }
  // Validate every project before writing any file so conflicts are transactional.
  for (const change of changes) {
    const update = (json: StoredProject) => {
      const config = change.package ? (json.nx ??= {}) : json;
      config.name ??= change.name;
      config.targets = { ...config.targets, ...change.targets };
      return json;
    };
    if (tree.exists(change.file)) updateJson(tree, change.file, update);
    else writeJson(tree, change.file, update({}));
  }
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
