import { generateFiles, type Tree } from '@nx/devkit';
import { join } from 'node:path';
import { assertGoPackage, normalizeGoDirectory } from '../shared/go-skeleton';

export interface ConfigGeneratorOptions {
  directory: string;
}

export async function configGenerator(
  tree: Tree,
  options: ConfigGeneratorOptions,
) {
  const directory = normalizeGoDirectory(options.directory);
  if (tree.exists(directory + '/config.go')) {
    throw new Error('Target config file already exists.');
  }
  assertGoPackage(tree, directory, 'config');
  generateFiles(tree, join(__dirname, 'files'), directory, { template: '' });
}

export default configGenerator;
