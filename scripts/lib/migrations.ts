import { spawnSync } from 'node:child_process';
import { Pool } from 'pg';

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

export type MigrationStatusCheck =
  | { status: 'up-to-date' }
  | { status: 'pending' }
  | { status: 'baseline-required' }
  | { status: 'error'; reason: string };

/** Opens a read-only connection check without changing the database. */
export async function canConnectToDatabase(databaseUrl: string): Promise<boolean> {
  try {
    const url = new URL(databaseUrl);
    const sslMode = url.searchParams.get('sslmode');
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: sslMode === 'disable' ? false : sslMode ? { rejectUnauthorized: true } : undefined,
      connectionTimeoutMillis: 5_000,
    });
    try {
      await pool.query('SELECT 1');
      return true;
    } finally {
      await pool.end();
    }
  } catch {
    return false;
  }
}

/** Checks an external database without applying migrations. */
export async function checkMigrateStatus(databaseUrl: string): Promise<MigrationStatusCheck> {
  const result = spawnSync('bunx', ['prisma', 'migrate', 'status'], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  if (result.status === 0) return { status: 'up-to-date' };

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (/\bP3005\b/.test(output)) return { status: 'baseline-required' };

  if (/Following migration(?:s)? have not yet been applied/i.test(output)) {
    try {
      const url = new URL(databaseUrl);
      const sslMode = url.searchParams.get('sslmode');
      const pool = new Pool({
        connectionString: databaseUrl,
        ssl: sslMode === 'disable' ? false : sslMode ? { rejectUnauthorized: true } : undefined,
      });
      try {
        const tables = await pool.query<{ has_migration_history: boolean; has_application_tables: boolean }>(`
          SELECT
            EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = current_schema() AND table_name = '_prisma_migrations'
            ) AS has_migration_history,
            EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = current_schema()
                AND table_type = 'BASE TABLE'
                AND table_name <> '_prisma_migrations'
            ) AS has_application_tables
        `);
        const { has_migration_history, has_application_tables } = tables.rows[0];
        if (has_application_tables && !has_migration_history) return { status: 'baseline-required' };
        return { status: 'pending' };
      } finally {
        await pool.end();
      }
    } catch (error) {
      return { status: 'error', reason: shortError(error) };
    }
  }

  return { status: 'error', reason: shortError(result.error ?? output) };
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lines = message.split('\n').map((line) => line.trim()).filter(Boolean);
  const errorLine = lines.find((line) => /\b(?:Error:|P\d{4}:)/.test(line));
  return (errorLine?.replace(/^Error:\s*/, '') ?? lines.at(-1) ?? 'Unknown error').replace(/[.!?]+$/, '');
}
