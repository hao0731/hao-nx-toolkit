import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  handlerGenerator,
  modelGenerator,
  repositoryGenerator,
  serviceGenerator,
} from '../../index';

it('rejects a test-only filename before changing the tree', async () => {
  const tree = createTreeWithEmptyWorkspace();
  const before = tree.listChanges();
  await expect(
    modelGenerator(tree, { name: 'UserTest', directory: 'models' }),
  ).rejects.toThrow(/user_test\.go.*Go.*choose another name/i);
  expect(tree.listChanges()).toEqual(before);
});

it.each([
  'UserLinux',
  'user-amd64',
  'user-linux-arm64',
  'user-386',
  'user-hurd',
  'user-armbe',
])(
  'rejects the platform-constrained filename for %s without writing files',
  async (name) => {
    const tree = createTreeWithEmptyWorkspace();
    const before = tree.listChanges();
    await expect(
      modelGenerator(tree, { name, directory: 'models' }),
    ).rejects.toThrow(/special Go filename.*choose another name/);
    expect(tree.listChanges()).toEqual(before);
  },
);

it.each([
  ['linux', 'linux.go'],
  ['test', 'test.go'],
  ['user-unix', 'user_unix.go'],
  ['user-linux-model', 'user_linux_model.go'],
  ['user-amd64-model', 'user_amd64_model.go'],
])(
  'allows %s because its filename has no special Go suffix',
  async (name, file) => {
    const tree = createTreeWithEmptyWorkspace();
    await modelGenerator(tree, { name, directory: 'models' });
    expect(tree.exists(`models/${file}`)).toBe(true);
  },
);

it('honors explicit packages including existing external test files', async () => {
  const tree = createTreeWithEmptyWorkspace();
  tree.write(
    'http-models/existing.go',
    '//go:build linux\n\n/* package decoy */\npackage transport\n',
  );
  tree.write('http-models/existing_test.go', 'package transport_test\n');
  await modelGenerator(tree, {
    name: 'response',
    directory: 'http-models',
    packageName: 'transport',
  });
  expect(tree.read('http-models/response.go', 'utf-8')).toContain(
    'package transport\n',
  );
});

it('preserves existing model implementations and refuses package conflicts', async () => {
  const tree = createTreeWithEmptyWorkspace();
  tree.write('models/user.go', 'package models\n// user implementation\n');
  const before = tree.listChanges();
  await expect(
    modelGenerator(tree, { name: 'user', directory: 'models' }),
  ).rejects.toThrow(/already exists/);
  expect(tree.listChanges()).toEqual(before);
  tree.write('other/existing.go', 'package transport\n');
  const conflictBefore = tree.listChanges();
  await expect(
    modelGenerator(tree, { name: 'user', directory: 'other' }),
  ).rejects.toThrow(/package/);
  expect(tree.listChanges()).toEqual(conflictBefore);
});

it.each([
  { name: '', directory: 'models' },
  { name: '123-user', directory: 'models' },
  { name: '../user', directory: 'models' },
  { name: 'İtem', directory: 'models' },
  { name: 'user', directory: '../models' },
  { name: 'user', directory: '/models' },
  { name: 'user', directory: 'http-models' },
  { name: 'user', directory: 'models', packageName: 'type' },
  { name: 'user', directory: 'models', packageName: '_' },
])('rejects invalid model options %j without tree changes', async (options) => {
  const tree = createTreeWithEmptyWorkspace();
  const before = tree.listChanges();
  await expect(modelGenerator(tree, options)).rejects.toThrow();
  expect(tree.listChanges()).toEqual(before);
});

it('generates a model with a zero-argument value factory by default', async () => {
  const tree = createTreeWithEmptyWorkspace();
  await modelGenerator(tree, { name: 'user', directory: 'apps/api/models' });
  expect(tree.read('apps/api/models/user.go', 'utf-8')).toBe(`package models

type User struct {
\t// TODO: Need to implement fields
}

func NewUser() User {
\t// Need to implement logic
\tvar model User
\treturn model
}
`);
});

it('can generate a request model without a factory', async () => {
  const tree = createTreeWithEmptyWorkspace();
  await modelGenerator(tree, {
    name: 'user-request',
    directory: 'requests',
    factory: false,
  });
  expect(tree.read('requests/user_request.go', 'utf-8')).toBe(`package requests

type UserRequest struct {
\t// TODO: Need to implement fields
}
`);
});

it.each([
  ['user-request', 'user_request.go', 'UserRequest'],
  ['user-model', 'user_model.go', 'UserModel'],
  ['HTTPClient', 'http_client.go', 'HttpClient'],
  ['model', 'model.go', 'Model'],
])(
  'normalizes %s without adding or removing Model',
  async (name, file, type) => {
    const tree = createTreeWithEmptyWorkspace();
    await modelGenerator(tree, { name, directory: 'models', factory: true });
    expect(tree.read(`models/${file}`, 'utf-8')).toContain(
      `func New${type}() ${type}`,
    );
  },
);

it.each([
  [handlerGenerator, 'handler'],
  [serviceGenerator, 'service'],
  [repositoryGenerator, 'repository'],
] as const)(
  'keeps %s independent from model filename restrictions',
  async (generate, suffix) => {
    const tree = createTreeWithEmptyWorkspace();
    await generate(tree, { name: 'user-linux', directory: 'components' });
    await generate(tree, { name: 'user-test', directory: 'components' });
    expect(tree.exists(`components/user_linux_${suffix}.go`)).toBe(true);
    expect(tree.exists(`components/user_test_${suffix}.go`)).toBe(true);
  },
);
