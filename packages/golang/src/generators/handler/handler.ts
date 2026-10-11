import { generateFiles, logger, type Tree } from '@nx/devkit';
import { join } from 'node:path';
import { normalizeGoSkeleton } from '../shared/go-skeleton';

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
    options.framework !== undefined &&
    !['none', 'gin', 'echo'].includes(options.framework)
  ) {
    throw new Error('framework must be none, gin or echo.');
  }
  const { directory, packageName, fileName, typeName } = normalizeGoSkeleton(
    tree,
    options,
    'handler',
  );
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
