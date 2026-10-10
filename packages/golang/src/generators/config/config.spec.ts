import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { configGenerator } from '../../index';

it('generates config with path options and loading TODOs in the final directory', async () => {
  const tree = createTreeWithEmptyWorkspace();
  await configGenerator(tree, { directory: 'apps/api/internal/settings' });
  expect(tree.read('apps/api/internal/settings/config.go', 'utf-8'))
    .toBe(`package config

type Config struct {
\t// TODO: Need to implement config fields
}

type loadOptions struct {
\tpath string
}

type LoadOption func(*loadOptions)

func WithPath(path string) LoadOption {
\treturn func(options *loadOptions) {
\t\toptions.path = path
\t}
}

func Load(options ...LoadOption) (*Config, error) {
\tvar opts loadOptions
\tfor _, option := range options {
\t\toption(&opts)
\t}

\tvar result Config

\t// TODO: Need to implement loading and validation using opts

\treturn &result, nil
}
`);
});

it.each([
  '',
  '../config',
  '/config',
  'C:\\config',
  'config\\nested',
  'config/../nested',
  'config\0',
])('rejects invalid directory %j without writing', async (directory) => {
  const tree = createTreeWithEmptyWorkspace();
  const before = tree.listChanges();
  await expect(configGenerator(tree, { directory })).rejects.toThrow(
    /directory/,
  );
  expect(tree.listChanges()).toEqual(before);
});

it('preserves an existing config file', async () => {
  const tree = createTreeWithEmptyWorkspace();
  tree.write('config/config.go', 'package config\n// user implementation\n');
  const before = tree.listChanges();
  await expect(configGenerator(tree, { directory: 'config' })).rejects.toThrow(
    /exists/,
  );
  expect(tree.listChanges()).toEqual(before);
  expect(tree.read('config/config.go', 'utf-8')).toBe(
    'package config\n// user implementation\n',
  );
});

it.each([
  ['existing.go', '/* package config */\npackage settings\n'],
  ['existing_test.go', 'package settings_test\n'],
  ['existing.go', 'package config_test\n'],
  ['existing.go', '// no package clause\n'],
])(
  'rejects conflicting/unreadable package in %s before writing',
  async (file, content) => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(`settings/${file}`, content);
    const before = tree.listChanges();
    await expect(
      configGenerator(tree, { directory: 'settings' }),
    ).rejects.toThrow(/package/);
    expect(tree.listChanges()).toEqual(before);
  },
);

it('accepts config and external test packages behind comments/build tags', async () => {
  const tree = createTreeWithEmptyWorkspace();
  tree.write(
    'settings/existing.go',
    '//go:build linux\n\n/* package decoy */\npackage config\n',
  );
  tree.write(
    'settings/existing_test.go',
    '// package decoy\npackage config_test\n',
  );
  tree.write('settings/_ignored.go', 'package other\n');
  tree.write('settings/.ignored.go', 'package other\n');
  await configGenerator(tree, { directory: 'settings' });
  expect(tree.read('settings/config.go', 'utf-8')).toContain(
    'package config\n',
  );
});

it('normalizes the final directory and preserves dependency/configuration files', async () => {
  const tree = createTreeWithEmptyWorkspace();
  tree.write('go.mod', 'module example.com/api\n');
  tree.write('go.sum', 'preserved\n');
  const before = tree.listChanges();
  await configGenerator(tree, { directory: 'apps/api/my-settings/./' });
  expect(
    tree
      .listChanges()
      .slice(before.length)
      .map((change) => change.path),
  ).toEqual(['apps/api/my-settings/config.go']);
  expect(tree.read('apps/api/my-settings/config.go', 'utf-8')).toContain(
    'package config\n',
  );
  expect(tree.read('go.mod', 'utf-8')).toBe('module example.com/api\n');
  expect(tree.read('go.sum', 'utf-8')).toBe('preserved\n');
});
