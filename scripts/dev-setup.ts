import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { isDockerDatabaseUrl } from '../lib/env';
import {
  checkDockerPrerequisites,
  commandErrorOutput,
  ensureDockerDatabase,
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

async function main(): Promise<void> {
  if (!existsSync(envPath)) createLocalEnv();

  const env = parse(readFileSync(envPath));
  if (!isDockerDatabaseUrl(env.DATABASE_URL, env.DB_PORT)) return;

  try {
    const prerequisiteError = checkDockerPrerequisites();
    if (prerequisiteError) throw new Error(prerequisiteError);
    await ensureDockerDatabase(env.DB_PORT);
  } catch (error) {
    const reason = commandErrorOutput(error);
    process.stderr.write(
      [
        'DATABASE_URL points to the local PostgreSQL in Docker, but Docker is not running or the database could not start.',
        'Open Docker Desktop, OrbStack, or Colima, start the Docker engine, then run `bun dev` again.',
        `Reason: ${reason}`,
        'Guide: docs/en/03-docker.md (Spanish: docs/es/03-docker.md)',
        '',
      ].join('\n'),
    );
    process.exitCode = 1;
  }
}

void main();
