import { type Tree } from '@nx/devkit';
import { basename, posix } from 'node:path';

export interface GoSkeletonOptions {
  name: string;
  directory: string;
  packageName?: string;
}

export function normalizeGoSkeleton(
  tree: Tree,
  options: GoSkeletonOptions,
  kind: 'handler' | 'service' | 'repository' | 'model',
) {
  const suffix = kind === 'model' ? '' : kind[0].toUpperCase() + kind.slice(1);
  if (
    typeof options.name !== 'string' ||
    !/^[\p{L}\p{Nd}_ -]+$/u.test(options.name) ||
    !options.name.trim()
  ) {
    throw new Error(
      'name must contain letters, digits, spaces, underscores or hyphens.',
    );
  }
  const directory = normalizeGoDirectory(options.directory);
  const packageName = options.packageName ?? basename(directory);
  const keywords = new Set(
    'break default func interface select case defer go map struct chan else goto package switch const fallthrough if range type continue for import return var'.split(
      ' ',
    ),
  );
  if (
    !/^[\p{L}_][\p{L}\p{Nd}_]*$/u.test(packageName) ||
    packageName === '_' ||
    keywords.has(packageName)
  ) {
    throw new Error(
      'packageName must be a valid Go identifier other than a keyword or _. Supply --packageName to override the directory name.',
    );
  }
  const words = options.name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  if (kind !== 'model' && words.at(-1) === kind) words.pop();
  if (!words.length || !/^[\p{L}]/u.test(words[0]))
    throw new Error(
      kind === 'model'
        ? 'name must start with a letter.'
        : `name must start with a letter and contain a base name before ${suffix}.`,
    );
  const fileName = words.join('_') + (kind === 'model' ? '' : '_' + kind);
  if (tree.exists(directory + '/' + fileName + '.go'))
    throw new Error(`Target ${kind} file already exists.`);
  assertGoPackage(tree, directory, packageName);
  const typeName =
    words
      .map((word) => {
        const [initial, ...rest] = word;
        return initial.toUpperCase() + rest.join('');
      })
      .join('') + suffix;
  if (!/^[\p{L}_][\p{L}\p{Nd}_]*$/u.test(typeName)) {
    throw new Error(
      `The normalized ${kind} name must be a valid Go identifier. Unicode case conversions that introduce combining marks are unsupported.`,
    );
  }
  return { directory, packageName, fileName, typeName };
}

export function normalizeGoDirectory(directory: string) {
  if (
    typeof directory !== 'string' ||
    !directory.trim() ||
    directory.includes('\\') ||
    directory.includes('\0') ||
    posix.isAbsolute(directory) ||
    /^[A-Za-z]:/.test(directory) ||
    directory.split('/').includes('..')
  ) {
    throw new Error(
      'directory must be a nonempty workspace-root relative path without parent traversal.',
    );
  }
  return posix.normalize(directory);
}

export function assertGoPackage(
  tree: Tree,
  directory: string,
  packageName: string,
) {
  for (const file of tree
    .children(directory)
    .filter((file) => file.endsWith('.go') && !/^[._]/.test(file))) {
    const content = tree.read(directory + '/' + file, 'utf-8');
    if (content === null) continue;
    // Only the package clause is needed. Comments/build tags can precede it.
    const uncommented = content.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ' ');
    const existingPackage = /^\s*package\s+([\p{L}_][\p{L}\p{Nd}_]*)/u.exec(
      uncommented,
    )?.[1];
    const matches =
      existingPackage === packageName ||
      (file.endsWith('_test.go') && existingPackage === packageName + '_test');
    if (!matches)
      throw new Error(
        'Conflicting or unreadable package in ' +
          file +
          '; expected package ' +
          packageName +
          '.',
      );
  }
}
