import { generateFiles, type Tree } from '@nx/devkit';
import { join } from 'node:path';
import {
  normalizeGoSkeleton,
  type GoSkeletonOptions,
} from '../shared/go-skeleton';

export type RepositoryGeneratorOptions = GoSkeletonOptions;

export async function repositoryGenerator(
  tree: Tree,
  options: RepositoryGeneratorOptions,
) {
  const { directory, ...normalized } = normalizeGoSkeleton(
    tree,
    options,
    'repository',
  );
  generateFiles(tree, join(__dirname, 'files'), directory, {
    ...normalized,
    template: '',
  });
}

export default repositoryGenerator;
