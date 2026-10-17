import type {
  NxJsonConfiguration,
  ProjectConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import {
  createTargetDefaultsResults,
  mergeTargetConfigurations,
} from '@nx/devkit/internal';

// This exported devkit entry point is internal, not a public API guarantee.
// Keep this integration isolated; @nx/devkit stays pinned to the 23.2.0 baseline,
// and installed-package E2E must validate each supported Nx compatibility version.
// Use graph synthesis: the generic defaults reader merges incompatible array
// entries before returning, whereas Nx drops those entries individually.
export function readGeneratedTargetDefaults(
  targetName: string,
  targetDefaults: NxJsonConfiguration['targetDefaults'],
  executor: string,
  project: ProjectConfiguration,
  projectName: string,
): TargetConfiguration {
  const results = createTargetDefaultsResults(
    {},
    {
      [project.root]: {
        ...project,
        name: projectName,
        targets: { [targetName]: { executor } },
      },
    },
    { targetDefaults },
  );
  let target: TargetConfiguration | undefined;
  for (const [, , result] of results) {
    const contribution = result.projects?.[project.root]?.targets?.[targetName];
    if (contribution) target = mergeTargetConfigurations(contribution, target);
  }
  return target ?? {};
}
export { mergeTargetConfigurations };
