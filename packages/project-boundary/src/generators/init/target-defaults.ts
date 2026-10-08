// Nx 23.2.0 exports these readers through its source subpath API, but devkit
// does not re-export them. Keep this baseline-specific integration isolated;
// the exact Nx peer version and installed-package E2E guard its compatibility.
export { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration/target-defaults';
export { mergeTargetConfigurations } from 'nx/src/project-graph/utils/project-configuration/target-merging';
