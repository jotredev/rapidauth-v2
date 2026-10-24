import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import { parse } from 'dotenv';
import { formatEnvSummary, isDockerDatabaseUrl, resolveEnv } from '../lib/env';
import { BaselineRequiredError, baselineMessage, canConnectToDatabase, checkMigrateStatus, runMigrateDeploy } from './lib/migrations';

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

function checkMailpit(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: 'localhost', port: 1025 });
    const finish = (available: boolean) => {
      socket.destroy();
      resolve(available);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1_000, () => finish(false));
  });
}

/** Applies the pending migrations (prisma migrate deploy) to the local database; safe to run on every start. */
function applyMigrations(databaseUrl: string): boolean {
  process.stdout.write('Applying database migrations with prisma migrate deploy...\n');
  try {
    // Pass the URL that was checked as the Docker database: prisma.config.ts never overrides process.env.
    runMigrateDeploy(databaseUrl);
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      error instanceof BaselineRequiredError ? baselineMessage() : `Could not apply the migrations: ${reason}\n`,
    );
    process.exitCode = 1;
    return false;
  }
}

async function checkExternalMigrations(databaseUrl: string): Promise<void> {
  const result = await checkMigrateStatus(databaseUrl);
  if (result.status === 'up-to-date') return;
  if (result.status === 'baseline-required') {
    process.stderr.write(baselineMessage());
    return;
  }
  if (result.status === 'pending') {
    process.stderr.write(
      'Database migrations are missing. If this is a development database, run `bun run db:deploy`.\n',
    );
    return;
  }
  process.stderr.write(`Could not check database migrations: ${result.reason}.\n`);
}

async function main(): Promise<void> {
  if (!existsSync(envPath)) createLocalEnv();

  // Effective environment: variables already exported in the terminal win over .env, as in Next.js and Prisma.
  const env = { ...parse(readFileSync(envPath)), ...process.env };
  const databaseUrl = env.DATABASE_URL?.trim();
  const connection = databaseUrl ? await canConnectToDatabase(databaseUrl) : undefined;
  if (!databaseUrl || !connection?.ok) {
    process.stderr.write(
      [
        'Could not connect to DATABASE_URL.',
        `Reason: ${connection && !connection.ok ? connection.reason : 'DATABASE_URL is not set'}`,
        'Start the database and Mailpit with `docker compose up -d db mailpit`, or set an external DATABASE_URL in .env.',
        '',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  if (isDockerDatabaseUrl(databaseUrl, env.DB_PORT)) {
    if (!applyMigrations(databaseUrl)) return;
  } else {
    await checkExternalMigrations(databaseUrl);
  }

  if (!env.RESEND_API_KEY?.trim() && !(await checkMailpit())) {
    process.stderr.write('Mailpit is not responding on localhost:1025. Start it with `docker compose up -d db mailpit`.\n');
  }

  process.stdout.write(`\n${formatEnvSummary(resolveEnv(env).config)}\n`);
  process.stdout.write('To prepare production settings, run bun run setup:prod\n\n');
}

void main();
