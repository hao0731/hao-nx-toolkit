import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/build',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'type:shared',
              onlyDependOnLibsWithTags: ['type:shared']
            },
            {
              sourceTag: 'scope:workspace',
              onlyDependOnLibsWithTags: ['type:shared', 'scope:workspace']
            },
            {
              sourceTag: 'lang:golang',
              onlyDependOnLibsWithTags: ['type:shared', 'lang:golang']
            },
            {
              sourceTag: 'lang:typescript',
              onlyDependOnLibsWithTags: ['type:shared', 'lang:typescript']
            }
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
