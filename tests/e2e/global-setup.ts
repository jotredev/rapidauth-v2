import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';
import { Client } from 'pg';
import { createTestUser } from './helpers/database';
import { createE2EEnvironment } from './helpers/e2e-environment';

const WARMUP_TIMEOUT = 180_000;
const PUBLIC_ROUTES = [
  '/',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/terms',
  '/privacy',
];

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  }
}

// Start every run from an empty database so a failed run cannot leave the admin changed.
async function resetDatabase(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      DO $$
      DECLARE table_name text;
      BEGIN
        FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
          EXECUTE format('TRUNCATE TABLE %I CASCADE', table_name);
        END LOOP;
      END $$;
    `);
  } finally {
    await client.end();
  }
}

async function resetDatabaseAndSeed(databaseUrl: string, env: NodeJS.ProcessEnv) {
  await resetDatabase(databaseUrl);
  run('bun', ['run', 'db:seed'], env);
}

async function resetOutbox() {
  await rm(resolve('.e2e-outbox'), { recursive: true, force: true });
  await mkdir(resolve('.e2e-outbox'), { recursive: true });
}

function getProjectBaseURL(config: FullConfig, projectName: string) {
  const baseURL = config.projects.find(({ name }) => name === projectName)?.use.baseURL;
  if (typeof baseURL !== 'string') {
    throw new Error(`Playwright project ${projectName} must define a baseURL.`);
  }
  return baseURL;
}

async function warmServer(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  baseURL: string,
  credentials: { email: string; password: string },
) {
  const context = await browser.newContext({ baseURL });
  context.setDefaultTimeout(WARMUP_TIMEOUT);
  context.setDefaultNavigationTimeout(WARMUP_TIMEOUT);

  try {
    const page = await context.newPage();
    for (const route of PUBLIC_ROUTES) {
      await page.goto(route);
    }

    await page.goto('/auth/login');
    await page.getByPlaceholder('name@example.com').fill(credentials.email);
    await page.getByPlaceholder('Enter your password').fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(({ pathname }) => pathname === '/dashboard');
  } finally {
    await context.close();
  }
}

async function warmServers(config: FullConfig) {
  const credentials = await createTestUser({
    name: 'E2E Warmup User',
    email: 'e2e-warmup@e2e.invalid',
  });
  const browser = await chromium.launch();

  try {
    await warmServer(browser, getProjectBaseURL(config, 'chromium'), credentials);
    await warmServer(browser, getProjectBaseURL(config, 'turnstile-reject'), credentials);
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig) {
  const databaseUrl = process.env.CI
    ? process.env.DATABASE_URL ??
      'postgresql://rapidauth:rapidauth@127.0.0.1:5432/rapidauth?sslmode=disable'
    : 'postgresql://rapidauth:rapidauth@127.0.0.1:55432/rapidauth?sslmode=disable';
  const env = createE2EEnvironment(databaseUrl);

  run('bunx', ['prisma', 'migrate', 'deploy'], env);
  await resetDatabaseAndSeed(databaseUrl, env);
  await resetOutbox();

  try {
    await warmServers(config);
  } finally {
    await resetDatabaseAndSeed(databaseUrl, env);
    await resetOutbox();
  }
}
