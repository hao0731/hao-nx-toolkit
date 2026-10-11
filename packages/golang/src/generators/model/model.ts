import { generateFiles, type Tree } from '@nx/devkit';
import { join } from 'node:path';
import {
  normalizeGoSkeleton,
  type GoSkeletonOptions,
} from '../shared/go-skeleton';

export interface ModelGeneratorOptions extends GoSkeletonOptions {
  factory?: boolean;
}

// Go 1.26.2 internal/syslist KnownOS + KnownArch, including historical targets.
// Keep this list aligned when upgrading Go. Generation must not require Go installed.
const platformSuffixes = new Set(
  (
    'aix android darwin dragonfly freebsd hurd illumos ios js linux nacl netbsd openbsd plan9 solaris wasip1 windows zos ' +
    '386 amd64 amd64p32 arm armbe arm64 arm64be loong64 mips mipsle mips64 mips64le mips64p32 mips64p32le ppc ppc64 ppc64le riscv riscv64 s390 s390x sparc sparc64 wasm'
  ).split(' '),
);

export async function modelGenerator(
  tree: Tree,
  options: ModelGeneratorOptions,
) {
  const { directory, ...normalized } = normalizeGoSkeleton(
    tree,
    options,
    'model',
  );
  const words = normalized.fileName.split('_');
  const last = words.at(-1)!;
  // Go recognizes these suffixes only after an underscore; linux.go is ordinary.
  if (words.length > 1 && (last === 'test' || platformSuffixes.has(last))) {
    throw new Error(
      `${normalized.fileName}.go has special Go filename semantics; choose another name.`,
    );
  }
  generateFiles(tree, join(__dirname, 'files'), directory, {
    ...normalized,
    template: '',
    factory: options.factory ?? true,
  });
}

export default modelGenerator;
