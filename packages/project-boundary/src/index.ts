import type { CreateNodesV2 } from '@nx/devkit';
import { discoverProjectRoots, type BoundaryPluginOptions } from './discovery';

export type { BoundaryPluginOptions } from './discovery';

export const createNodesV2: CreateNodesV2<BoundaryPluginOptions> = [
  'nx.json',
  async (files, options, context) => {
    if (!files.length) return [];
    const roots = await discoverProjectRoots(context.workspaceRoot, options);
    return [
      [
        'nx.json',
        {
          projects: Object.fromEntries(
            [...roots].map((root) => [
              root,
              {
                targets: {
                  'check-boundaries': {
                    executor: '@hao-nx-toolkit/project-boundary:check',
                    cache: false,
                    inputs: [
                      'default',
                      '{workspaceRoot}/project-boundary.config.json',
                    ],
                  },
                },
              },
            ]),
          ),
        },
      ],
    ];
  },
];
