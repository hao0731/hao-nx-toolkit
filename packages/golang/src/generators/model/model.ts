import { generateFiles, type Tree } from '@nx/devkit';
import { join } from 'node:path';
import {
  normalizeGoSkeleton,
  type GoSkeletonOptions,
} from '../shared/go-skeleton';

export interface ModelGeneratorOptions extends GoSkeletonOptions {
  factory?: boolean;
}

export async function modelGenerator(
  tree: Tree,
  options: ModelGeneratorOptions,
) {
  const { directory, ...normalized } = normalizeGoSkeleton(
    tree,
    options,
    'model',
  );
  generateFiles(tree, join(__dirname, 'files'), directory, {
    ...normalized,
    template: '',
    factory: options.factory ?? true,
  });
}

export default modelGenerator;
