import { generateFiles, logger, type Tree } from '@nx/devkit';
import { basename, join, posix } from 'node:path';

export interface HandlerGeneratorOptions {
  name: string;
  directory: string;
  packageName?: string;
  framework?: 'none' | 'gin' | 'echo';
}

export async function handlerGenerator(
  tree: Tree,
  options: HandlerGeneratorOptions,
) {
  if (
    typeof options.name !== 'string' ||
    !/^[\p{L}\p{Nd}_ -]+$/u.test(options.name) ||
    !options.name.trim()
  ) {
    throw new Error(
      'name must contain letters, digits, spaces, underscores or hyphens.',
    );
  }
  if (
    typeof options.directory !== 'string' ||
    !options.directory.trim() ||
    options.directory.includes('\\') ||
    options.directory.includes('\0') ||
    posix.isAbsolute(options.directory) ||
    /^[A-Za-z]:/.test(options.directory) ||
    options.directory.split('/').includes('..')
  ) {
    throw new Error(
      'directory must be a nonempty workspace-root relative path without parent traversal.',
    );
  }
  const directory = posix.normalize(options.directory);
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
  if (
    options.framework !== undefined &&
    !['none', 'gin', 'echo'].includes(options.framework)
  ) {
    throw new Error('framework must be none, gin or echo.');
  }
  const words = options.name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  if (words.at(-1) === 'handler') words.pop();
  if (!words.length || !/^[\p{L}]/u.test(words[0]))
    throw new Error(
      'name must start with a letter and contain a base name before Handler.',
    );
  const fileName = words.join('_') + '_handler';
  if (tree.exists(directory + '/' + fileName + '.go'))
    throw new Error('Target handler file already exists.');
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
  const typeName =
    words.map((word) => word[0].toUpperCase() + word.slice(1)).join('') +
    'Handler';
  const framework = options.framework ?? 'none';
  const importPath =
    framework === 'gin'
      ? 'github.com/gin-gonic/gin'
      : framework === 'echo'
        ? 'github.com/labstack/echo/v5'
        : '';
  const router =
    framework === 'gin'
      ? 'router gin.IRoutes'
      : framework === 'echo'
        ? 'router *echo.Echo'
        : '';
  generateFiles(tree, join(__dirname, 'files'), directory, {
    packageName,
    typeName,
    fileName,
    template: '',
    importPath,
    router,
  });
  if (importPath)
    logger.info(
      'Ensure your Go module has ' +
        importPath +
        ' installed (for example: go get ' +
        importPath +
        '). Go dependencies were not modified.',
    );
}
export default handlerGenerator;
