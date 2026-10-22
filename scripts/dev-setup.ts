import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { formatEnvSummary, resolveDevServices, resolveEnv } from '../lib/env';
import {
  checkDockerPrerequisites,
  commandErrorOutput,
  countDockerDatabaseTables,
  ensureDockerDatabase,
  ensureDockerService,
} from './lib/docker';

const root = process.cwd();
const envPath = path.resolve(root, '.env');
const examplePath = path.resolve(root, '.env.example');

// Same credentials, database and default host port as docker/db.yaml.
const LOCAL_DATABASE_URL = 'postgresql://rapidauth:rapidauth@localhost:5432/rapidauth?sslmode=disable';

function setValue(content: string, key: string, value: string): string {
  const line = new RegExp(`^${key}=.*$`, 'm');
  const rendered = `${key}="${value}"`;
  return line.test(content) ? content.replace(line, () => rendered) : `${content.trimEnd()}\n${rendered}\n`;
}

/** Creates `.env` from `.env.example` with values that work on this computer. */
function createLocalEnv(): void {
  let content = readFileSync(examplePath, 'utf8').replace(/\r\n/g, '\n');
  content = setValue(content, 'DATABASE_URL', LOCAL_DATABASE_URL);
  content = setValue(content, 'BETTER_AUTH_SECRET', randomBytes(32).toString('hex'));
  content = setValue(content, 'BETTER_AUTH_URL', 'http://localhost:3000');
  content = setValue(content, 'SUPPORT_EMAIL', 'support@example.invalid');
  writeFileSync(envPath, content, { mode: 0o600 });
  process.stdout.write('Created .env with local development values (local PostgreSQL in Docker).\n');
}

function printDockerError(what: string, error: unknown): void {
  process.stderr.write(
    [
      `${what}, but Docker is not running or it could not start.`,
      'Open Docker Desktop, OrbStack, or Colima, start the Docker engine, then run `bun dev` again.',
      `Reason: ${commandErrorOutput(error)}`,
      'Guide: docs/en/03-docker.md (Spanish: docs/es/03-docker.md)',
      '',
    ].join('\n'),
  );
  process.exitCode = 1;
}

function runDockerStep(what: string, step: () => Promise<void> | void): Promise<boolean> {
  return Promise.resolve()
    .then(step)
    .then(() => true, (error: unknown) => {
      printDockerError(what, error);
      return false;
    });
}

/** Creates the tables with the current mechanism (prisma db push) when the local database is empty. */
function ensureTables(databaseUrl: string): void {
  if (countDockerDatabaseTables() > 0) return;
  process.stdout.write('The local database is empty. Creating the tables with prisma db push...\n');
  // Pass the URL that was checked as the Docker database: prisma.config.ts never overrides process.env.
  execFileSync('bunx', ['prisma', 'db', 'push'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

async function main(): Promise<void> {
  if (!existsSync(envPath)) createLocalEnv();

  // Effective environment: variables already exported in the terminal win over .env, as in Next.js and Prisma.
  const env = { ...parse(readFileSync(envPath)), ...process.env };
  const { dockerDatabase: useDockerDatabase, mailpit: useMailpit } = resolveDevServices(env);

  if (useDockerDatabase || useMailpit) {
    const prerequisiteError = checkDockerPrerequisites();
    if (prerequisiteError) {
      printDockerError(
        useDockerDatabase
          ? 'DATABASE_URL points to the local PostgreSQL in Docker'
          : 'RESEND_API_KEY is empty, so emails go to Mailpit in Docker',
        new Error(prerequisiteError),
      );
      return;
    }
  }

  if (useDockerDatabase) {
    const started = await runDockerStep(
      'DATABASE_URL points to the local PostgreSQL in Docker',
      async () => {
        await ensureDockerDatabase(env.DB_PORT);
        ensureTables(env.DATABASE_URL as string);
      },
    );
    if (!started) return;
  }

  if (useMailpit) {
    const started = await runDockerStep(
      'RESEND_API_KEY is empty, so emails go to Mailpit in Docker',
      () => ensureDockerService('mailpit', 'Mailpit'),
    );
    if (!started) return;
  }

  process.stdout.write(`\n${formatEnvSummary(resolveEnv(env).config)}\n`);
  process.stdout.write('For production, run bun run init:setup\n\n');
}

void main();
