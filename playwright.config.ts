import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { E2E_CRON_SECRET } from './tests/e2e/helpers/e2e-environment';

const port = 3100;
const rejectPort = 3101;
const sentryCollectorPort = 3102;
const baseURL = `http://127.0.0.1:${port}`;
const rejectBaseURL = `http://127.0.0.1:${rejectPort}`;
const databaseUrl = process.env.CI
  ? process.env.DATABASE_URL ??
    'postgresql://rapidauth:rapidauth@127.0.0.1:5432/rapidauth?sslmode=disable'
  : 'postgresql://rapidauth:rapidauth@127.0.0.1:55432/rapidauth?sslmode=disable';
process.env.DATABASE_URL = databaseUrl;
const outboxDir = resolve('.e2e-outbox');

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  outputDir: 'test-results',
  // next dev compiles each route on first visit; on CI runners a cold multi-page test exceeds the defaults.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/turnstile-reject.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL },
    },
    {
      name: 'turnstile-reject',
      testMatch: '**/turnstile-reject.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: rejectBaseURL },
    },
  ],
  webServer: [
    {
      command: 'bun run tests/e2e/helpers/sentry-collector-server.ts',
      url: `http://127.0.0.1:${sentryCollectorPort}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        SENTRY_COLLECTOR_PORT: String(sentryCollectorPort),
      },
    },
    {
      command: `bunx next dev --hostname 127.0.0.1 --port ${port}`,
      url: baseURL,
      // Never reuse an unrelated server that may be connected to another database.
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_URL: baseURL,
        BETTER_AUTH_SECRET:
          'e2e-only-secret-never-use-this-value-outside-local-tests-000000000000',
        EMAIL_DELIVERY: 'outbox',
        EMAIL_OUTBOX_DIR: outboxDir,
        SEED_ADMIN_EMAIL: 'admin@e2e.invalid',
        SEED_ADMIN_PASSWORD: 'E2e-Admin-Password-123!',
        GOOGLE_CLIENT_ID: 'e2e-google-client-id',
        GOOGLE_CLIENT_SECRET: 'e2e-google-client-secret',
        GITHUB_CLIENT_ID: 'e2e-github-client-id',
        GITHUB_CLIENT_SECRET: 'e2e-github-client-secret',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
        NEXT_PUBLIC_SENTRY_DSN: `http://public@127.0.0.1:${sentryCollectorPort}/1`,
        TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
        SUPPORT_EMAIL: 'support@e2e.invalid',
        CRON_SECRET: E2E_CRON_SECRET,
        RAPIDAUTH_NEXT_DIST_DIR: '.next-e2e-normal',
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_ENV: 'development',
        RAPIDAUTH_E2E_ERROR_REPORTING: 'true',
      },
    },
    {
      command: `bunx next dev --hostname 127.0.0.1 --port ${rejectPort}`,
      url: rejectBaseURL,
      // Never reuse an unrelated server that may be connected to another database.
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_URL: rejectBaseURL,
        BETTER_AUTH_SECRET:
          'e2e-only-secret-never-use-this-value-outside-local-tests-000000000000',
        EMAIL_DELIVERY: 'outbox',
        EMAIL_OUTBOX_DIR: outboxDir,
        SEED_ADMIN_EMAIL: 'admin@e2e.invalid',
        SEED_ADMIN_PASSWORD: 'E2e-Admin-Password-123!',
        GOOGLE_CLIENT_ID: 'e2e-google-client-id',
        GOOGLE_CLIENT_SECRET: 'e2e-google-client-secret',
        GITHUB_CLIENT_ID: 'e2e-github-client-id',
        GITHUB_CLIENT_SECRET: 'e2e-github-client-secret',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
        TURNSTILE_SECRET_KEY: '2x0000000000000000000000000000000AA',
        SUPPORT_EMAIL: 'support@e2e.invalid',
        CRON_SECRET: '',
        RAPIDAUTH_NEXT_DIST_DIR: '.next-e2e-reject',
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_ENV: 'development',
      },
    },
  ],
});
