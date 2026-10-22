import { formatEnvSummary, getEnv } from './lib/env';

export function validateEnvironment() {
  const { error } = getEnv();
  if (error) {
    console.error(error);
    process.exit(1);
  }
}

const SUMMARY_FLAG = Symbol.for('rapidauth.envSummaryPrinted');

export function printEnvironmentSummary() {
  const flags = globalThis as Record<symbol, unknown>;
  if (flags[SUMMARY_FLAG]) return;
  flags[SUMMARY_FLAG] = true;
  console.log(formatEnvSummary(getEnv().config));
}
