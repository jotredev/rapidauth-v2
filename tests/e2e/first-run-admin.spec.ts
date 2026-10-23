import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { expect, test, type Page } from '@playwright/test';
import { createE2EEnvironment } from './helpers/e2e-environment';

// Prisma's adapter addresses the model schema explicitly, so search_path cannot isolate this flow.
// A disposable database keeps the globalSetup admin available to the rest of the suite.
const databaseName = 'rapidauth_first_run_admin';
const normalBaseURL = 'http://127.0.0.1:3110';
const expiredBaseURL = 'http://127.0.0.1:3111';
const normalDistDir = '.next-e2e-first-run';
const expiredDistDir = '.next-e2e-first-run-expired';
const databaseUrl = process.env.DATABASE_URL ??
  (process.env.CI === 'true'
    ? 'postgresql://rapidauth:rapidauth@127.0.0.1:5432/rapidauth?sslmode=disable'
    : 'postgresql://rapidauth:rapidauth@127.0.0.1:55432/rapidauth?sslmode=disable');
const isolatedDatabaseUrl = new URL(databaseUrl);
isolatedDatabaseUrl.pathname = `/${databaseName}`;
const isolatedUrl = isolatedDatabaseUrl.toString();

let server: ChildProcess | undefined;
async function queryDatabase(query: string) {
  const client = new Client({ connectionString: isolatedUrl });
  await client.connect();
  try {
    return await client.query(query);
  } finally {
    await client.end();
  }
}

async function resetIsolatedDatabase() {
  await queryDatabase(`
    DO $$
    DECLARE table_name text;
    BEGIN
      FOR table_name IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      LOOP
        EXECUTE format('TRUNCATE TABLE public.%I CASCADE', table_name);
      END LOOP;
    END $$;
  `);
}

function runPrismaDbPush() {
  const env = createE2EEnvironment(isolatedUrl);
  const result = spawnSync('bunx', ['prisma', 'db', 'push', '--accept-data-loss'], {
    cwd: process.cwd(),
    env: { ...env, DATABASE_URL: isolatedUrl },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('Prisma db push failed for the isolated E2E database.');
}

async function startServer(baseURL: string, distDir: string, windowMs: number) {
  const port = new URL(baseURL).port;
  const env = createE2EEnvironment(isolatedUrl);
  server = spawn(
    'bunx',
    ['next', 'dev', '--hostname', '127.0.0.1', '--port', port],
    {
      cwd: process.cwd(),
      stdio: 'ignore',
      env: {
        ...env,
        DATABASE_URL: isolatedUrl,
        BETTER_AUTH_URL: baseURL,
        BETTER_AUTH_SECRET:
          'e2e-only-secret-never-use-this-value-outside-local-tests-000000000000',
        EMAIL_DELIVERY: 'outbox',
        EMAIL_OUTBOX_DIR: resolve('.e2e-outbox'),
        SEED_ADMIN_EMAIL: 'admin@e2e.invalid',
        SEED_ADMIN_PASSWORD: 'E2e-Admin-Password-123!',
        GOOGLE_CLIENT_ID: 'e2e-google-client-id',
        GOOGLE_CLIENT_SECRET: 'e2e-google-client-secret',
        GITHUB_CLIENT_ID: 'e2e-github-client-id',
        GITHUB_CLIENT_SECRET: 'e2e-github-client-secret',
        TURNSTILE_SITE_KEY: '',
        TURNSTILE_SECRET_KEY: '',
        SUPPORT_EMAIL: 'support@e2e.invalid',
        CRON_SECRET: 'e2e-cron-secret-never-use-outside-local-tests-0000000000000000',
        RAPIDAUTH_FIRST_RUN_WINDOW_MS: String(windowMs),
        RAPIDAUTH_NEXT_DIST_DIR: distDir,
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_ENV: 'development',
      },
    },
  );

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`First-run E2E server exited with ${server.exitCode}.`);
    try {
      const response = await fetch(`${baseURL}/api/auth/ok`);
      if (response.ok) return;
    } catch {
      // The app is still starting.
    }
    await delay(250);
  }
  throw new Error(`First-run E2E server did not become ready at ${baseURL}.`);
}

async function stopServer() {
  if (!server) return;
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([new Promise<void>((resolveExit) => server?.once('exit', () => resolveExit())), delay(5000)]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
  server = undefined;
}

async function fillFirstAdminForm(page: Page, email: string) {
  await page.getByPlaceholder('John Doe').fill('E2E First Administrator');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Create a password').fill('E2e-First-Admin-123!');
  await page.getByPlaceholder('Confirm your password').fill('E2e-First-Admin-123!');
  await page.getByRole('checkbox').check();
}

test.describe('first-run administrator setup', () => {
  test.beforeAll(async () => {
    test.setTimeout(240_000);
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      await client.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await client.query(`CREATE DATABASE "${databaseName}"`);
    } finally {
      await client.end();
    }
    runPrismaDbPush();
    await startServer(normalBaseURL, normalDistDir, 15 * 60 * 1000);
  });

  test.afterAll(async () => {
    await stopServer();
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      await client.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    } finally {
      await client.end();
    }
  });

  test('shows setup without an admin, then creates one and redirects to login', async ({ page }) => {
    await resetIsolatedDatabase();
    await page.goto(`${normalBaseURL}/auth/setup`);
    await expect(page.getByRole('heading', { name: 'Create your admin account' })).toBeVisible();

    await fillFirstAdminForm(page, 'first-admin-created@e2e.invalid');
    await page.getByRole('button', { name: 'Create admin account' }).click();
    await expect(page).toHaveURL(/\/auth\/login\?notice=admin-created$/);

    await page.goto(`${normalBaseURL}/auth/setup`);
    await expect(page).toHaveURL(`${normalBaseURL}/auth/login`);
  });

  test('rejects the server action when an administrator already exists', async ({ page }) => {
    await resetIsolatedDatabase();
    await page.goto(`${normalBaseURL}/auth/setup`);
    await expect(page.getByRole('heading', { name: 'Create your admin account' })).toBeVisible();

    await queryDatabase(`
      INSERT INTO "user"
        ("id", "name", "email", "emailVerified", "role", "status", "updatedAt")
      VALUES
        ('e2e-existing-admin', 'Existing E2E Admin', 'existing-admin@e2e.invalid', true, 'admin', 'active', NOW())
    `);
    await fillFirstAdminForm(page, 'second-first-admin@e2e.invalid');
    await page.getByRole('button', { name: 'Create admin account' }).click();

    await expect(page.getByText('An administrator already exists.')).toBeVisible();
    const adminCount = await queryDatabase(
      `SELECT COUNT(*)::int AS count FROM "user" WHERE "role" = 'admin'`,
    );
    expect(adminCount.rows[0].count).toBe(1);
  });

  test('does not allow first-admin setup after the setup window has expired', async ({ page }) => {
    await resetIsolatedDatabase();
    await stopServer();
    await startServer(expiredBaseURL, expiredDistDir, 0);
    await page.goto(`${expiredBaseURL}/auth/setup`);

    await expect(page.getByRole('heading', { name: 'Setup window closed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create admin account' })).toHaveCount(0);
    const userCount = await queryDatabase('SELECT COUNT(*)::int AS count FROM "user"');
    expect(userCount.rows[0].count).toBe(0);
  });
});
