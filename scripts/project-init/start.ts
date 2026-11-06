import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createLocalEnv, setEnvValue } from '../lib/local-env';
import { projectForms } from '../template/forms';
import type { ProjectAnswers } from '../template/metadata';
import type { InitContext, StartMode } from './types';

export const DEFAULT_DB_PORT = 5432;
const PORT_SEARCH_LIMIT = 50;

export interface StartOutcome {
  mode: StartMode;
  /** True when the chosen way of starting finished; the init itself is complete either way. */
  ready: boolean;
}

/** First free host port at or after `preferred`, or null when none is free in the search window. */
export async function pickDatabasePort(context: InitContext, preferred = DEFAULT_DB_PORT): Promise<number | null> {
  for (let port = preferred; port < preferred + PORT_SEARCH_LIMIT; port++) {
    if (await context.services.isPortFree(port)) return port;
  }
  return null;
}

/** Same credentials and database name as docker/db.yaml, for the host port in use. */
export function localDatabaseUrl(answers: ProjectAnswers, port: number): string {
  const name = projectForms(answers).snake;
  return `postgresql://${name}:${name}@localhost:${port}/${name}?sslmode=disable`;
}

function setDockerPort(dockerEnvPath: string, port: number): void {
  const current = existsSync(dockerEnvPath) ? readFileSync(dockerEnvPath, 'utf8') : '';
  writeFileSync(dockerEnvPath, setEnvValue(current, 'DB_PORT', String(port)).replace(/^\n+/, ''), { mode: 0o600 });
}

const COMPOSE_COMMAND = 'cd docker && docker compose up -d db mailpit';

function laterSteps(): string[] {
  return [
    'To start locally with Docker:',
    `  ${COMPOSE_COMMAND}`,
    '  bun dev',
    'To use your own production values:',
    '  bun run setup:prod',
  ];
}

async function startDocker(context: InitContext, answers: ProjectAnswers): Promise<StartOutcome> {
  const { terminal, root } = context;
  const outcome: StartOutcome = { mode: 'docker', ready: false };

  const problem = context.services.dockerProblem();
  if (problem) {
    terminal.warn(`${problem} The project is ready, but the local services were not started.`);
    terminal.info(['When Docker is running:', `  ${COMPOSE_COMMAND}`, '  bun run db:deploy', '  bun dev'].join('\n'));
    return outcome;
  }

  const envPath = path.join(root, '.env');
  if (existsSync(envPath)) {
    terminal.warn('A .env file already exists, so it was left untouched and Docker was not started.');
    terminal.info('Point DATABASE_URL at your database, or move the file away and run this step again by hand:\n  ' + COMPOSE_COMMAND);
    return outcome;
  }

  const port = await pickDatabasePort(context);
  if (port === null) {
    terminal.warn(`No free port found from ${DEFAULT_DB_PORT} to ${DEFAULT_DB_PORT + PORT_SEARCH_LIMIT - 1} for PostgreSQL. Free one and start it by hand.`);
    terminal.info(laterSteps().join('\n'));
    return outcome;
  }
  if (port !== DEFAULT_DB_PORT) {
    terminal.warn(`Port ${DEFAULT_DB_PORT} is busy; PostgreSQL will use port ${port}.`);
  }

  const databaseUrl = localDatabaseUrl(answers, port);
  createLocalEnv(path.join(root, '.env.example'), envPath, {
    databaseUrl,
    extra: port === DEFAULT_DB_PORT ? {} : { DB_PORT: String(port) },
  });
  // dev-setup reads DB_PORT from the root .env; Compose reads it only from docker/.env.
  if (port !== DEFAULT_DB_PORT) setDockerPort(path.join(root, 'docker', '.env'), port);
  terminal.success('Created .env with local development values.');

  terminal.info('Starting PostgreSQL and Mailpit with Docker...');
  const up = context.run('docker', ['compose', 'up', '-d', 'db', 'mailpit'], { cwd: path.join(root, 'docker'), inherit: true });
  if (up.status !== 0) {
    terminal.warn(`Docker could not start the services${up.error ? `: ${up.error}` : ''}. Try:\n  ${COMPOSE_COMMAND}`);
    return outcome;
  }

  terminal.info('Waiting for the database...');
  const ready = await context.services.waitForDatabase(databaseUrl);
  if (!ready.ok) {
    terminal.warn(`The database did not accept connections: ${ready.reason}. Check it with: cd docker && docker compose logs db`);
    return outcome;
  }

  terminal.info('Applying database migrations...');
  try {
    context.services.migrate(databaseUrl);
  } catch (error) {
    terminal.warn(`Could not apply the migrations: ${error instanceof Error ? error.message : String(error)}\nRun \`bun run db:deploy\` once the database is reachable.`);
    return outcome;
  }

  terminal.success('Local database ready. Run `bun dev` and open http://localhost:3000');
  return { mode: 'docker', ready: true };
}

function startProduction(context: InitContext): StartOutcome {
  const { terminal, root } = context;
  terminal.warn('The database you configure now is the one the app will use on this computer too, also with `bun dev`.');
  const result = context.run('bun', ['run', 'setup:prod'], { cwd: root, inherit: true });
  if (result.status !== 0) {
    terminal.warn('The production setup did not finish. Run it again when you are ready:\n  bun run setup:prod');
    return { mode: 'prod', ready: false };
  }
  return { mode: 'prod', ready: true };
}

/** Runs the start mode the person chose after the project was initialized. Never throws for an environment problem. */
export async function startProject(context: InitContext, mode: StartMode, answers: ProjectAnswers): Promise<StartOutcome> {
  if (mode === 'docker') return startDocker(context, answers);
  if (mode === 'prod') return startProduction(context);
  context.terminal.info(['Your .env was not touched.', ...laterSteps()].join('\n'));
  return { mode: 'later', ready: true };
}
