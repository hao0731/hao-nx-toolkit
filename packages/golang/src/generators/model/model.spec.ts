import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { modelGenerator } from '../../index';

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
