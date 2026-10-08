import { createProjectGraphAsync, type PromiseExecutor } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckExecutorSchema } from './schema';

interface Constraint {
  sourceTag: string;
  onlyDependOnProjectsWithTags: string[];
}

const runExecutor: PromiseExecutor<CheckExecutorSchema> = async (
  options,
  context,
) => {
  try {
    const input: unknown = JSON.parse(
      readFileSync(join(context.root, 'project-boundary.config.json'), 'utf8'),
    );
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('Expected a configuration object');
    const config = input as { depConstraints: unknown };
    for (const key of Object.keys(config)) {
      if (key !== 'depConstraints')
        throw new Error(`Unsupported configuration field: ${key}`);
    }
    if (!Array.isArray(config.depConstraints))
      throw new Error('depConstraints must be an array');
    const constraintsConfig = config.depConstraints as Constraint[];
    for (const rule of constraintsConfig) {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule))
        throw new Error('Each constraint must be an object');
      for (const key of Object.keys(rule)) {
        if (!['sourceTag', 'onlyDependOnProjectsWithTags'].includes(key))
          throw new Error(`Unsupported constraint field: ${key}`);
      }
      if (typeof rule.sourceTag !== 'string' || !rule.sourceTag.length)
        throw new Error('sourceTag must be a nonempty string');
      if (!Array.isArray(rule.onlyDependOnProjectsWithTags))
        throw new Error('onlyDependOnProjectsWithTags must be an array');
      for (const tag of [
        rule.sourceTag,
        ...rule.onlyDependOnProjectsWithTags,
      ]) {
        if (
          typeof tag !== 'string' ||
          !tag.length ||
          ['*', '?', '[', ']', '/'].some((character) => tag.includes(character))
        )
          throw new Error('Baseline checker supports only exact tag strings');
      }
    }
    const graph = context.projectGraph ?? (await createProjectGraphAsync());
    if (
      options.project !== undefined &&
      (typeof options.project !== 'string' || !graph.nodes[options.project])
    )
      throw new Error(`Unknown project: ${options.project}`);
    for (const key of Object.keys(options)) {
      if (key !== 'project')
        throw new Error(`Unsupported executor option: ${key}`);
    }
    let success = true;
    for (const [source, edges] of Object.entries(graph.dependencies)) {
      if (options.project && source !== options.project) continue;
      const projectEdges = edges.filter((edge) => graph.nodes[edge.target]);
      const sourceTags = graph.nodes[source]?.data.tags ?? [];
      const constraints = constraintsConfig.filter((rule) =>
        sourceTags.includes(rule.sourceTag),
      );
      if (projectEdges.length && !constraints.length) {
        console.error(
          `${source}: source tags [${sourceTags.join(', ')}] have no matching constraint`,
        );
        success = false;
      }
      for (const edge of projectEdges) {
        const targetTags = graph.nodes[edge.target]?.data.tags ?? [];
        for (const constraint of constraints) {
          if (
            !constraint.onlyDependOnProjectsWithTags.some((tag) =>
              targetTags.includes(tag),
            )
          ) {
            console.error(
              `${source} → ${edge.target}: source tags [${sourceTags.join(', ')}], target tags [${targetTags.join(', ')}] violate onlyDependOnProjectsWithTags ${JSON.stringify(constraint)}`,
            );
            success = false;
          }
        }
      }
    }
    if (success) console.log('Project boundary check passed.');
    return { success };
  } catch (error) {
    console.error(
      `Configuration error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { success: false };
  }
};
export default runExecutor;
