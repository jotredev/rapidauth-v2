import { spawnSync } from 'node:child_process';

export const BASELINE_COMMAND = 'bunx prisma migrate resolve --applied 0_init';

/** Prisma returns P3005 when it finds tables but no _prisma_migrations, as in a database created with `db push`. */
export class BaselineRequiredError extends Error {
  constructor() {
    super('The database has tables but no migration history (Prisma P3005).');
    this.name = 'BaselineRequiredError';
  }
}

export function baselineMessage(): string {
  return [
    'This database already has tables but no migration history (Prisma error P3005).',
    'It was probably created with `prisma db push`. Nothing was changed.',
    'If its tables match the current schema, mark the initial migration as applied yourself:',
    `  ${BASELINE_COMMAND}`,
    'Then run the command again. Guide (English): docs/en/00-manual-setup.md',
    'Guía (español): docs/es/00-manual-setup.md',
    '',
  ].join('\n');
}

/**
 * Runs `prisma migrate deploy` (idempotent: it only applies pending migrations).
 * Pass the URL that was checked: prisma.config.ts never overrides process.env.
 * Throws BaselineRequiredError on P3005 and never resolves the baseline by itself.
 */
export function runMigrateDeploy(databaseUrl?: string): void {
  const result = spawnSync('bunx', ['prisma', 'migrate', 'deploy'], {
    encoding: 'utf8',
    env: databaseUrl ? { ...process.env, DATABASE_URL: databaseUrl } : process.env,
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.status === 0) return;
  if (/\bP3005\b/.test(`${result.stdout}${result.stderr}`)) throw new BaselineRequiredError();
  throw new Error(result.error?.message ?? `prisma migrate deploy failed with status ${result.status}`);
}
