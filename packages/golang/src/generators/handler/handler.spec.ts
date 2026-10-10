import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { handlerGenerator } from '../../index';

it('generates a default handler in the requested workspace directory', async () => {
  const tree = createTreeWithEmptyWorkspace();
  await handlerGenerator(tree, {
    name: 'user',
    directory: 'apps/api/handlers',
  });
  expect(tree.read('apps/api/handlers/user_handler.go', 'utf-8'))
    .toBe(`package handlers

type UserHandler struct {
}

type UserHandlerOption func(*UserHandler)

func NewUserHandler(options ...UserHandlerOption) *UserHandler {
\thandler := &UserHandler{}
\tfor _, option := range options {
\t\toption(handler)
\t}
\treturn handler
}

func (handler *UserHandler) Register() {
\t// TODO: Implement route registration here.
}
`);
});

it.each([
  ['gin', 'github.com/gin-gonic/gin', 'gin.IRoutes'],
  ['echo', 'github.com/labstack/echo/v5', '*echo.Echo'],
] as const)(
  'generates a %s route registration skeleton without changing Go dependencies',
  async (framework, importPath, routerType) => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('apps/api/go.mod', 'module example.com/api\n\ngo 1.26\n');
    tree.write('apps/api/go.sum', 'unchanged\n');
    const before = tree.listChanges().length;
    await handlerGenerator(tree, {
      name: 'user',
      directory: 'apps/api/handlers',
      framework,
    });
    const output = tree.read('apps/api/handlers/user_handler.go', 'utf-8');
    expect(output).toContain(`import "${importPath}"`);
    expect(output).toContain(`Register(router ${routerType})`);
    expect(output).toContain('// TODO: Implement route registration here.');
    expect(
      tree
        .listChanges()
        .slice(before)
        .map((change) => change.path),
    ).toEqual(['apps/api/handlers/user_handler.go']);
    expect(tree.read('apps/api/go.mod', 'utf-8')).toBe(
      'module example.com/api\n\ngo 1.26\n',
    );
    expect(tree.read('apps/api/go.sum', 'utf-8')).toBe('unchanged\n');
  },
);

it.each([
  ['user-profile', 'UserProfileHandler', 'user_profile_handler.go'],
  ['userProfile', 'UserProfileHandler', 'user_profile_handler.go'],
  ['UserHandler', 'UserHandler', 'user_handler.go'],
  ['user-handler', 'UserHandler', 'user_handler.go'],
  ['http-client', 'HttpClientHandler', 'http_client_handler.go'],
  ['HTTPClient', 'HttpClientHandler', 'http_client_handler.go'],
])(
  'normalizes %s without special acronym capitalization',
  async (name, typeName, fileName) => {
    const tree = createTreeWithEmptyWorkspace();
    await handlerGenerator(tree, { name, directory: 'handlers' });
    expect(tree.read(`handlers/${fileName}`, 'utf-8')).toContain(
      `type ${typeName} struct`,
    );
  },
);

it.each([
  { name: '', directory: 'handlers' },
  { name: '123-user', directory: 'handlers' },
  { name: '../user', directory: 'handlers' },
  { name: 'handler', directory: 'handlers' },
  { name: 'user', directory: '' },
  { name: 'user', directory: '../handlers' },
  { name: 'user', directory: '/handlers' },
  { name: 'user', directory: 'C:\\handlers' },
  { name: 'user', directory: 'my-handlers' },
  { name: 'user', directory: 'handlers', packageName: 'type' },
  { name: 'user', directory: 'handlers', packageName: '_' },
  { name: 'user', directory: 'handlers', framework: 'invalid' },
])('rejects invalid input %j before creating files', async (options) => {
  const tree = createTreeWithEmptyWorkspace();
  const before = tree.listChanges();
  await expect(
    handlerGenerator(tree, options as Parameters<typeof handlerGenerator>[1]),
  ).rejects.toThrow();
  expect(tree.listChanges()).toEqual(before);
});

it('preserves an existing target rather than overwriting it', async () => {
  const tree = createTreeWithEmptyWorkspace();
  tree.write(
    'handlers/user_handler.go',
    'package handlers\n// user implementation\n',
  );
  await expect(
    handlerGenerator(tree, { name: 'user', directory: 'handlers' }),
  ).rejects.toThrow(/exists/);
  expect(tree.read('handlers/user_handler.go', 'utf-8')).toBe(
    'package handlers\n// user implementation\n',
  );
});

it('allows a package override while respecting ordinary and external test packages behind comments and build tags', async () => {
  const tree = createTreeWithEmptyWorkspace();
  tree.write(
    'my-handlers/existing.go',
    '//go:build linux\n\n/* package decoy */\npackage transport\n',
  );
  tree.write(
    'my-handlers/existing_test.go',
    '// package decoy\npackage transport_test\n',
  );
  await handlerGenerator(tree, {
    name: 'user',
    directory: 'my-handlers',
    packageName: 'transport',
  });
  expect(tree.read('my-handlers/user_handler.go', 'utf-8')).toContain(
    'package transport\n',
  );
});

it.each([
  ['existing.go', '/* package handlers */\npackage transport\n'],
  ['existing_test.go', 'package transport_test\n'],
  ['existing.go', 'package handlers_test\n'],
])(
  'rejects a conflicting package in %s before creating the handler',
  async (fileName, content) => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(`handlers/${fileName}`, content);
    const before = tree.listChanges();
    await expect(
      handlerGenerator(tree, { name: 'user', directory: 'handlers' }),
    ).rejects.toThrow(/package/);
    expect(tree.listChanges()).toEqual(before);
  },
);

it.each(['İtem', 'ǰob'])(
  'rejects Unicode case conversion that produces an invalid Go identifier: %s',
  async (name) => {
    const tree = createTreeWithEmptyWorkspace();
    const before = tree.listChanges();
    await expect(
      handlerGenerator(tree, { name, directory: 'handlers' }),
    ).rejects.toThrow(/normalized.*identifier/);
    expect(tree.listChanges()).toEqual(before);
  },
);

it('normalizes an initial Unicode letter outside the BMP by code point', async () => {
  const tree = createTreeWithEmptyWorkspace();
  await handlerGenerator(tree, { name: '𐐨item', directory: 'handlers' });
  expect(tree.read('handlers/𐐨item_handler.go', 'utf-8')).toContain(
    'type 𐐀itemHandler struct',
  );
});
