import { readJsonFile } from '@nx/devkit';
import {
  buildPackageJsonPatterns,
  buildPackageJsonWorkspacesMatcher,
  globWithWorkspaceContext,
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
): Promise<Set<string>> {
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
