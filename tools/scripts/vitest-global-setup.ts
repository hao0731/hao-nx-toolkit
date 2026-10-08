/**
 * This script adapts the local registry scripts to vitest's globalSetup
 * lifecycle: vitest calls the exported setup and teardown functions around
 * the test run.
 */

export { default as setup } from './start-local-registry';
export { default as teardown } from './stop-local-registry';
