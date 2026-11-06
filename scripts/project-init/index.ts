import { parseArgs } from 'node:util';
import * as clack from '@clack/prompts';
import { runInit } from './init';
import { createRealContext } from './real-context';
import { InitCancelled, InitError, START_MODES, type InitFlags, type StartMode } from './types';

const USAGE = [
  'Usage: bun run project:init [--name <name>] [--slug <slug>] [--description <text>] [--repo <owner/repo>]',
  '                            [--start docker|prod|later] [--confirm-template <slug>]',
  'Without a terminal, --name, --slug and --start are required.',
].join('\n');

function parseFlags(argv: string[]): InitFlags {
  const { values } = parseArgs({
    args: argv,
    options: {
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      repo: { type: 'string' },
      start: { type: 'string' },
      'confirm-template': { type: 'string' },
    },
    strict: true,
  });
  if (values.start !== undefined && !START_MODES.includes(values.start as StartMode)) {
    throw new TypeError(`--start must be one of: ${START_MODES.join(', ')}.`);
  }
  return {
    name: values.name,
    slug: values.slug,
    description: values.description,
    repo: values.repo,
    start: values.start as StartMode | undefined,
    confirmTemplate: values['confirm-template'],
  };
}

async function main(): Promise<number> {
  let flags: InitFlags;
  try {
    flags = parseFlags(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
    return 2;
  }

  const context = createRealContext(process.cwd(), flags);
  if (context.terminal.interactive) clack.intro('Project init');
  try {
    const result = await runInit(context);
    if (context.terminal.interactive) clack.outro(result.warnings.length > 0 ? 'Done, with warnings above.' : 'Done.');
    return 0;
  } catch (error) {
    if (error instanceof InitCancelled) {
      process.stderr.write('Cancelled. Nothing was changed.\n');
    } else if (error instanceof InitError) {
      context.terminal.error(error.message);
    } else {
      process.stderr.write(`Unexpected error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    }
    return 1;
  }
}

process.exitCode = await main();
