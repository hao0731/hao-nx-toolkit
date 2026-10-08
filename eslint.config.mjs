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
            // Classification and role constraints both apply (AND).
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'kind:workspace',
              onlyDependOnLibsWithTags: ['scope:shared', 'kind:workspace'],
            },
            {
              sourceTag: 'lang:golang',
              onlyDependOnLibsWithTags: ['scope:shared', 'lang:golang'],
            },
            {
              sourceTag: 'lang:typescript',
              onlyDependOnLibsWithTags: ['scope:shared', 'lang:typescript'],
            },
            {
              sourceTag: 'role:production',
              onlyDependOnLibsWithTags: ['role:production'],
            },
            {
              sourceTag: 'role:testing',
              onlyDependOnLibsWithTags: ['role:production', 'role:testing'],
            },
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
