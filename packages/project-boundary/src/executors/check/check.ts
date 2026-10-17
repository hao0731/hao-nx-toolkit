import { createHash } from 'node:crypto';
import { createProjectGraphAsync, type PromiseExecutor } from '@nx/devkit';
import {
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { CheckExecutorSchema } from './schema';
import { assertProjectCoverage, configuredProjectRoots } from '../../discovery';

interface Constraint {
  sourceTag?: string;
  allSourceTags?: string[];
  onlyDependOnProjectsWithTags?: string[];
  notDependOnProjectsWithTags?: string[];
}

function compilePattern(pattern: string): (tags: string[]) => boolean {
  if (pattern === '*') return () => true;
  if (pattern.startsWith('/')) {
    if (!pattern.endsWith('/') || pattern.length < 2)
      throw new Error(`Invalid regular expression pattern: ${pattern}`);
    const regex = new RegExp(pattern.slice(1, -1));
    return (tags) => tags.some((tag) => regex.test(tag));
  }
  const literal = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  const regex = new RegExp(`^${literal}$`);
  return (tags) => tags.some((tag) => regex.test(tag));
}

interface Violation {
  kind: 'unmatched-source' | 'disallowed-target' | 'forbidden-tag';
  source: string;
  sourceTags: string[];
  target?: string;
  targetTags?: string[];
  dependencyType?: string;
  constraintIndex?: number;
  constraint?: Constraint;
}
interface Report {
  version: 1;
  scope: { kind: 'workspace' } | { kind: 'project'; project: string };
  success: boolean;
  violations: Violation[];
  errors: { kind: 'configuration' | 'runtime' | 'report'; message: string }[];
}

function readConstraints(configPath: string): Constraint[] {
  const input: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Expected a configuration object');
  const config = input as { depConstraints: unknown };
  for (const key of Object.keys(config)) {
    if (key !== 'depConstraints' && key !== '$schema')
      throw new Error(`Unsupported configuration field: ${key}`);
  }
  if (!Array.isArray(config.depConstraints))
    throw new Error('depConstraints must be an array');
  if ('$schema' in config && typeof config.$schema !== 'string')
    throw new Error('$schema must be a string');
  const constraintsConfig = config.depConstraints as Constraint[];
  for (const rule of constraintsConfig) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule))
      throw new Error('Each constraint must be an object');
    for (const key of Object.keys(rule)) {
      if (
        ![
          'sourceTag',
          'allSourceTags',
          'onlyDependOnProjectsWithTags',
          'notDependOnProjectsWithTags',
        ].includes(key)
      )
        throw new Error(`Unsupported constraint field: ${key}`);
    }
    if ((rule.sourceTag !== undefined) === (rule.allSourceTags !== undefined))
      throw new Error('Specify sourceTag or allSourceTags, exclusively');
    if (
      rule.sourceTag !== undefined &&
      (typeof rule.sourceTag !== 'string' || !rule.sourceTag.length)
    )
      throw new Error('sourceTag must be a nonempty string');
    if (
      rule.allSourceTags !== undefined &&
      (!Array.isArray(rule.allSourceTags) || !rule.allSourceTags.length)
    )
      throw new Error('allSourceTags must be a nonempty array');
    if (
      rule.onlyDependOnProjectsWithTags !== undefined &&
      !Array.isArray(rule.onlyDependOnProjectsWithTags)
    )
      throw new Error('onlyDependOnProjectsWithTags must be an array');
    if (
      rule.notDependOnProjectsWithTags !== undefined &&
      !Array.isArray(rule.notDependOnProjectsWithTags)
    )
      throw new Error('notDependOnProjectsWithTags must be an array');
    for (const tag of [
      ...(rule.sourceTag !== undefined
        ? [rule.sourceTag]
        : (rule.allSourceTags ?? [])),
      ...(rule.onlyDependOnProjectsWithTags ?? []),
      ...(rule.notDependOnProjectsWithTags ?? []),
    ]) {
      if (typeof tag !== 'string' || !tag.length)
        throw new Error('Tag patterns must be nonempty strings');
      compilePattern(tag);
    }
  }
  return constraintsConfig;
}

const runExecutor: PromiseExecutor<CheckExecutorSchema> = async (
  options,
  context,
) => {
  options = {
    ...options,
    project:
      options.project ??
      (context.targetName === 'check-boundaries'
        ? context.projectName
        : undefined),
  };
  const report: Report = {
    version: 1,
    scope:
      typeof options.project === 'string'
        ? { kind: 'project', project: options.project }
        : { kind: 'workspace' },
    success: false,
    violations: [],
    errors: [],
  };
  const configPath = resolve(context.root, 'project-boundary.config.json');
  let outputPath: string | undefined;
  let phase: 'configuration' | 'runtime' = 'configuration';
  try {
    if (options.outputFile !== undefined) {
      if (typeof options.outputFile !== 'string' || !options.outputFile.length)
        throw new Error('outputFile must be a nonempty path');
      let reportFile = options.outputFile;
      if (reportFile.includes('{boundaryProjectName}')) {
        if (typeof options.project !== 'string' || !options.project.length)
          throw new Error(
            'outputFile {boundaryProjectName} requires a selected project',
          );
        // A bounded lowercase digest distinguishes names on case-insensitive
        // filesystems and cannot introduce separators or traversal components.
        const component = `project-${createHash('sha256').update(options.project, 'utf8').digest('hex')}`;
        reportFile = reportFile.replaceAll('{boundaryProjectName}', component);
      }
      const candidate = resolve(context.root, reportFile);
      let sameFile = candidate === configPath;
      try {
        sameFile ||=
          resolve(dirname(candidate), readlinkSync(candidate)) === configPath;
      } catch {
        /* A normal output file is not a symbolic link. */
      }
      try {
        const inputStat = statSync(configPath);
        const outputStat = statSync(candidate);
        sameFile ||=
          realpathSync(candidate) === realpathSync(configPath) ||
          (inputStat.dev === outputStat.dev &&
            inputStat.ino === outputStat.ino);
      } catch {
        /* Missing output is expected on the first run. */
      }
      if (sameFile)
        throw new Error(
          'outputFile must not overwrite project-boundary.config.json',
        );
      outputPath = candidate;
    }
    for (const key of Object.keys(options)) {
      if (!['project', 'outputFile'].includes(key))
        throw new Error(`Unsupported executor option: ${key}`);
    }
    const constraintsConfig = readConstraints(configPath);
    phase = 'runtime';
    const graph = context.projectGraph ?? (await createProjectGraphAsync());
    if (context.targetName === 'check-boundaries-all') {
      phase = 'configuration';
      assertProjectCoverage(
        Object.fromEntries(
          Object.entries(graph.nodes).map(([name, node]) => [name, node.data]),
        ),
        await configuredProjectRoots(context.root, context.nxJsonConfiguration),
      );
      phase = 'runtime';
    }
    if (
      options.project !== undefined &&
      (typeof options.project !== 'string' ||
        !Object.hasOwn(graph.nodes, options.project))
    ) {
      phase = 'configuration';
      throw new Error(`Unknown project: ${options.project}`);
    }
    for (const source of Object.keys(graph.nodes).sort()) {
      if (options.project && source !== options.project) continue;
      const projectEdges = (graph.dependencies[source] ?? [])
        .filter((edge) => Object.hasOwn(graph.nodes, edge.target))
        .sort(
          (a, b) =>
            a.target.localeCompare(b.target) || a.type.localeCompare(b.type),
        );
      const sourceTags = [...(graph.nodes[source].data.tags ?? [])].sort();
      const constraints = constraintsConfig
        .map((constraint, index) => ({ constraint, index }))
        .filter(({ constraint }) =>
          (constraint.sourceTag !== undefined
            ? [constraint.sourceTag]
            : (constraint.allSourceTags ?? [])
          ).every((tag) => compilePattern(tag)(sourceTags)),
        );
      if (projectEdges.length && !constraints.length) {
        report.violations.push({
          kind: 'unmatched-source',
          source,
          sourceTags,
        });
        console.error(
          `${source}: source tags [${sourceTags.join(', ')}] have no matching constraint`,
        );
      }
      for (const edge of projectEdges) {
        const targetTags = [
          ...(graph.nodes[edge.target].data.tags ?? []),
        ].sort();
        for (const { constraint, index } of constraints) {
          const denied = constraint.notDependOnProjectsWithTags?.some((tag) =>
            compilePattern(tag)(targetTags),
          );
          const disallowed =
            constraint.onlyDependOnProjectsWithTags !== undefined &&
            !constraint.onlyDependOnProjectsWithTags.some((tag) =>
              compilePattern(tag)(targetTags),
            );
          if (denied || disallowed) {
            const kind = denied ? 'forbidden-tag' : 'disallowed-target';
            const field = denied
              ? 'notDependOnProjectsWithTags'
              : 'onlyDependOnProjectsWithTags';
            report.violations.push({
              kind,
              source,
              target: edge.target,
              sourceTags,
              targetTags,
              dependencyType: edge.type,
              constraintIndex: index,
              constraint,
            });
            console.error(
              `${source} → ${edge.target}: source tags [${sourceTags.join(', ')}], target tags [${targetTags.join(', ')}] violate ${field} ${JSON.stringify(constraint)}`,
            );
          }
        }
      }
    }
    report.success = report.violations.length === 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.errors.push({ kind: phase, message });
    console.error(
      `${phase === 'configuration' ? 'Configuration' : 'Runtime'} error: ${message}`,
    );
  }
  if (outputPath) {
    try {
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.success = false;
      report.errors.push({ kind: 'report', message });
      try {
        rmSync(outputPath, { force: true });
      } catch {
        /* The report error below also signals an inaccessible prior report. */
      }
      console.error(`Report error: ${message}`);
    }
  }
  if (report.success) console.log('Project boundary check passed.');
  return { success: report.success };
};
export default runExecutor;
