import {
  getProjects,
  globAsync,
  readJsonFile,
  type NxJsonConfiguration,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  buildPackageJsonPatterns,
  buildPackageJsonWorkspacesMatcher,
  globWithWorkspaceContext,
  findMatchingConfigFiles,
} from '@nx/devkit/internal';
import { dirname, join } from 'node:path';

export interface BoundaryPluginOptions {
  /** Additional workspace-relative marker globs. Each marker's directory is a project root. */
  projectMarkers?: string[];
}

export function projectMarkers(options: BoundaryPluginOptions = {}): string[] {
  if (
    options.projectMarkers !== undefined &&
    (!Array.isArray(options.projectMarkers) ||
      options.projectMarkers.some(
        (pattern) =>
          typeof pattern !== 'string' ||
          !pattern.trim() ||
          pattern.startsWith('!') ||
          pattern.startsWith('/') ||
          pattern.split('/').includes('..'),
      ))
  )
    throw new Error(
      'projectMarkers must be an array of nonempty workspace-relative marker globs',
    );
  return options.projectMarkers ?? [];
}

export async function discoverProjectRoots(
  workspaceRoot: string,
  options: BoundaryPluginOptions = {},
  tree?: Tree,
): Promise<Set<string>> {
  if (tree) {
    const roots = new Set(
      [...getProjects(tree).values()]
        .filter(
          (project) =>
            tree.exists(join(project.root, 'project.json')) ||
            tree.exists(join(project.root, 'package.json')),
        )
        .map((project) => project.root || '.'),
    );
    const markers = projectMarkers(options);
    if (markers.length)
      for (const file of await globAsync(tree, markers))
        roots.add(dirname(file));
    return roots;
  }
  // Nx's internal workspace matcher keeps npm/pnpm/yarn/lerna patterns and
  // exclusions aligned with Nx. Installed CLI tests cover supported Nx versions.
  const patterns = buildPackageJsonPatterns(workspaceRoot, (path) =>
    readJsonFile(join(workspaceRoot, path)),
  );
  const isWorkspacePackage = buildPackageJsonWorkspacesMatcher(patterns);
  const files = await globWithWorkspaceContext(workspaceRoot, [
    '**/project.json',
    '**/package.json',
  ]);
  const roots = new Set(
    files
      .filter(
        (file) =>
          file.endsWith('/project.json') ||
          file === 'project.json' ||
          isWorkspacePackage(file),
      )
      .map((file) => dirname(file)),
  );
  const markers = projectMarkers(options);
  if (markers.length)
    for (const file of await globWithWorkspaceContext(workspaceRoot, markers))
      roots.add(dirname(file));
  return roots;
}

export async function configuredProjectRoots(
  workspaceRoot: string,
  nx: NxJsonConfiguration,
  tree?: Tree,
): Promise<Set<string>> {
  const registrations = (nx.plugins ?? []).filter(
    (entry) =>
      (typeof entry === 'string' ? entry : entry.plugin) ===
      '@hao-nx-toolkit/project-boundary',
  );
  const active = registrations.filter(
    (entry) =>
      typeof entry === 'string' ||
      findMatchingConfigFiles(
        ['nx.json'],
        entry.include ?? [],
        entry.exclude ?? [],
      ).length > 0,
  );
  const options = active.map((entry) =>
    typeof entry === 'string'
      ? {}
      : ((entry.options ?? {}) as BoundaryPluginOptions),
  );
  const roots = new Set<string>();
  for (const option of options)
    for (const root of await discoverProjectRoots(workspaceRoot, option, tree))
      roots.add(root);
  // Init supplies root metadata after validating the current Tree.
  if (tree && options.length) roots.add('.');
  return roots;
}

export function assertProjectCoverage(
  projects: Record<string, Pick<ProjectConfiguration, 'root'>>,
  roots: Set<string>,
) {
  const missing = Object.entries(projects)
    .filter(([, project]) => !roots.has(project.root || '.'))
    .map(([name, project]) => `${name} (${project.root || '.'})`)
    .sort();
  if (missing.length)
    throw new Error(
      `Projects not covered by boundary inference: ${missing.join(', ')}. Add their marker globs to projectMarkers in the @hao-nx-toolkit/project-boundary plugin options in nx.json, and ensure the plugin registration includes nx.json.`,
    );
}
