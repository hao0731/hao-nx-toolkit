import type {
  NxJsonConfiguration,
  ProjectConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import { createTargetDefaultsResults } from 'nx/src/project-graph/utils/project-configuration/target-defaults';
import { mergeTargetConfigurations } from 'nx/src/project-graph/utils/project-configuration/target-merging';

// Nx 23.2.0 exposes synthesis/merging through source subpaths, not devkit.
// Use graph synthesis: the generic defaults reader merges incompatible array
// entries before returning, whereas Nx drops those entries individually.
// Exact Nx peer and installed-package E2E guard this isolated integration.
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
