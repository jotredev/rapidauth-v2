import { parseArgs } from 'node:util';
import * as clack from '@clack/prompts';
import { createGitRunner } from './git';
import { PullError, runPull, type PullFlags } from './pull-run';
import { nodeFs } from './transaction';
import { TemplateError, type Reporter } from './types';

const USAGE = ['Usage: bun run template:pull [--dry-run] [--allow-major]', '  --dry-run      show what would change and write nothing', '  --allow-major  accept a jump to a new major version'].join('\n');

function parseFlags(argv: string[]): PullFlags {
  const { values } = parseArgs({
    args: argv,
    options: { 'dry-run': { type: 'boolean' }, 'allow-major': { type: 'boolean' } },
    strict: true,
    allowPositionals: false,
  });
  return { dryRun: values['dry-run'] === true, allowMajor: values['allow-major'] === true };
}

const terminal: Reporter = {
  info: (message) => clack.log.info(message),
  warn: (message) => clack.log.warn(message),
  error: (message) => clack.log.error(message),
  success: (message) => clack.log.success(message),
};

/** Exit codes: 0 done (also with conflicts) or up to date, 1 refused or failed with nothing changed, 2 invalid arguments. */
function main(): number {
  let flags: PullFlags;
  try {
    flags = parseFlags(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
    return 2;
  }
  const root = process.cwd();
  try {
    runPull({ root, flags, terminal, git: createGitRunner(root), fs: nodeFs });
    return 0;
  } catch (error) {
    if (error instanceof PullError || error instanceof TemplateError) terminal.error(error.message);
    else process.stderr.write(`Unexpected error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    return 1;
  }
}

process.exitCode = main();
