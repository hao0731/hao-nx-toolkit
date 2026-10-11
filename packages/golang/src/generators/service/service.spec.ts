import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { serviceGenerator, repositoryGenerator } from '../../index';

it.each([
  ['service', serviceGenerator, 'UserService'],
  ['repository', repositoryGenerator, 'UserRepository'],
] as const)(
  'generates a %s with ordered constructor options',
  async (kind, generate, typeName) => {
    const tree = createTreeWithEmptyWorkspace();
    await generate(tree, { name: 'user', directory: `apps/api/${kind}s` });
    expect(tree.read(`apps/api/${kind}s/user_${kind}.go`, 'utf-8'))
      .toBe(`package ${kind}s

type ${typeName} struct {
}

type ${typeName}Option func(*${typeName})

func New${typeName}(options ...${typeName}Option) *${typeName} {
\t${kind} := &${typeName}{}
\tfor _, option := range options {
\t\toption(${kind})
\t}
\treturn ${kind}
}
`);
  },
);

describe.each([
  ['service', serviceGenerator, 'Service'],
  ['repository', repositoryGenerator, 'Repository'],
] as const)('%s input and preservation rules', (kind, generate, suffix) => {
  it.each(['user-profile', 'userProfile', 'UserProfile', 'user_profile'])(
    'normalizes %s',
    async (name) => {
      const tree = createTreeWithEmptyWorkspace();
      await generate(tree, { name, directory: kind });
      expect(tree.read(`${kind}/user_profile_${kind}.go`, 'utf-8')).toContain(
        `type UserProfile${suffix} struct`,
      );
    },
  );

  it('does not repeat the suffix or modify dependencies/configuration', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('go.mod', 'module example.com/api\n');
    tree.write('go.sum', 'preserved\n');
    const before = tree.listChanges();
    await generate(tree, {
      name: `User${suffix}`,
      directory: `apps/api/${kind}s/./`,
    });
    expect(tree.read(`apps/api/${kind}s/user_${kind}.go`, 'utf-8')).toContain(
      `type User${suffix} struct`,
    );
    expect(
      tree
        .listChanges()
        .slice(before.length)
        .map((change) => change.path),
    ).toEqual([`apps/api/${kind}s/user_${kind}.go`]);
    expect(tree.read('go.mod', 'utf-8')).toBe('module example.com/api\n');
    expect(tree.read('go.sum', 'utf-8')).toBe('preserved\n');
  });

  it.each([
    { name: '', directory: 'components' },
    { name: '123-user', directory: 'components' },
    { name: '../user', directory: 'components' },
    { name: 'user', directory: '' },
    { name: 'user', directory: '../components' },
    { name: 'user', directory: '/components' },
    { name: 'user', directory: 'C:\\components' },
    { name: 'user', directory: 'my-components' },
    { name: 'user', directory: 'components', packageName: 'type' },
    { name: 'user', directory: 'components', packageName: '_' },
    { name: 'İtem', directory: 'components' },
    { name: 'ǰob', directory: 'components' },
  ])('rejects invalid input %j without writing', async (options) => {
    const tree = createTreeWithEmptyWorkspace();
    const before = tree.listChanges();
    await expect(generate(tree, options)).rejects.toThrow();
    expect(tree.listChanges()).toEqual(before);
  });

  it('requires a base name before the suffix', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const before = tree.listChanges();
    await expect(
      generate(tree, { name: suffix, directory: kind }),
    ).rejects.toThrow(/base name/);
    expect(tree.listChanges()).toEqual(before);
  });

  it('preserves an existing destination', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const path = `${kind}/user_${kind}.go`;
    tree.write(path, `package ${kind}\n// user code\n`);
    const before = tree.listChanges();
    await expect(
      generate(tree, { name: 'user', directory: kind }),
    ).rejects.toThrow(/exists/);
    expect(tree.listChanges()).toEqual(before);
    expect(tree.read(path, 'utf-8')).toBe(`package ${kind}\n// user code\n`);
  });

  it('respects package overrides and external tests behind build tags/comments', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'my-components/existing.go',
      '//go:build linux\n\n/* package decoy */\npackage components\n',
    );
    tree.write(
      'my-components/existing_test.go',
      '// package decoy\npackage components_test\n',
    );
    await generate(tree, {
      name: 'user',
      directory: 'my-components',
      packageName: 'components',
    });
    expect(tree.read(`my-components/user_${kind}.go`, 'utf-8')).toContain(
      'package components\n',
    );
  });

  it.each([
    ['existing.go', '/* package components */\npackage other\n'],
    ['existing_test.go', 'package other_test\n'],
    ['existing.go', 'package components_test\n'],
    ['existing.go', '// no package clause\n'],
  ])('rejects conflicting/unreadable packages in %s', async (file, content) => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(`components/${file}`, content);
    const before = tree.listChanges();
    await expect(
      generate(tree, { name: 'user', directory: 'components' }),
    ).rejects.toThrow(/package/);
    expect(tree.listChanges()).toEqual(before);
  });

  it('supports an initial Unicode letter outside the BMP', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await generate(tree, { name: '𐐨item', directory: kind });
    expect(tree.read(`${kind}/𐐨item_${kind}.go`, 'utf-8')).toContain(
      `type 𐐀item${suffix} struct`,
    );
  });
});
