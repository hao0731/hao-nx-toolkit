import { generateFiles, type Tree } from '@nx/devkit';
import { join } from 'node:path';
import {
  normalizeGoSkeleton,
  type GoSkeletonOptions,
} from '../shared/go-skeleton';

export type ServiceGeneratorOptions = GoSkeletonOptions;

export async function serviceGenerator(
  tree: Tree,
  options: ServiceGeneratorOptions,
) {
  const { directory, ...normalized } = normalizeGoSkeleton(
    tree,
    options,
    'service',
  );
  generateFiles(tree, join(__dirname, 'files'), directory, {
    ...normalized,
    template: '',
  });
}

export default serviceGenerator;
