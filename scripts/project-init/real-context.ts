import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import * as clack from '@clack/prompts';
import { checkDockerPrerequisites } from '../lib/docker';
import { canConnectToDatabase, runMigrateDeploy } from '../lib/migrations';
import { nodeFs } from './transaction';
import { InitCancelled, type CommandRunner, type GitRunner, type InitContext, type InitFlags, type Services, type Terminal } from './types';

export function createGitRunner(root: string, env: NodeJS.ProcessEnv = process.env): GitRunner {
  return (args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env, maxBuffer: 256 * 1024 * 1024 });
    return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr ?? result.error?.message ?? '' };
  };
}

export const runCommand: CommandRunner = (command, args, options) => {
  const result = spawnSync(command, args, { cwd: options.cwd, stdio: options.inherit ? 'inherit' : 'pipe', encoding: 'utf8' });
  return { status: result.status, error: result.error?.message };
};

function unwrap<T>(value: T): Exclude<T, symbol> {
  if (clack.isCancel(value)) throw new InitCancelled();
  return value as Exclude<T, symbol>;
}

export function createClackTerminal(): Terminal {
  return {
    interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    async text(prompt) {
      return unwrap(
        await clack.text({
          message: prompt.message,
          placeholder: prompt.placeholder,
          initialValue: prompt.initialValue,
          validate: prompt.validate ? (input) => prompt.validate?.(input ?? '') : undefined,
        }),
      );
    },
    async select(prompt) {
      return unwrap(await clack.select({ message: prompt.message, options: prompt.options as never })) as never;
    },
    info: (message) => clack.log.info(message),
    warn: (message) => clack.log.warn(message),
    error: (message) => clack.log.error(message),
    success: (message) => clack.log.success(message),
  };
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    // Docker publishes the database on 127.0.0.1 only, so that is the address that must be free.
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const realServices: Services = {
  dockerProblem: checkDockerPrerequisites,
  isPortFree,
  async waitForDatabase(databaseUrl) {
    const deadline = Date.now() + 60_000;
    let reason = 'timed out';
    while (Date.now() < deadline) {
      const check = await canConnectToDatabase(databaseUrl);
      if (check.ok) return { ok: true };
      reason = check.reason;
      await sleep(1_000);
    }
    return { ok: false, reason };
  },
  migrate: runMigrateDeploy,
};

export function createRealContext(root: string, flags: InitFlags): InitContext {
  return { root, flags, terminal: createClackTerminal(), git: createGitRunner(root), run: runCommand, services: realServices, fs: nodeFs };
}
