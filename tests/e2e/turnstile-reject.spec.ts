import { expect, test } from '@playwright/test';
import { cleanE2EData, createTestUser, installTestTurnstileWidget, prisma } from './helpers';
import { getOutboxMessages } from './helpers/outbox';

test.beforeEach(async ({ page }) => {
  await installTestTurnstileWidget(page);
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `192.0.2.${Math.floor(Math.random() * 200) + 1}`,
  });
});

test.afterEach(async () => {
  await cleanE2EData();
});

test('scheduled cleanup is disabled without CRON_SECRET', async ({ request }) => {
  const verification = await prisma.verification.create({
    data: {
      identifier: `e2e-disabled-cleanup-${crypto.randomUUID()}`,
      value: 'expired',
      expiresAt: new Date(Date.now() - 60_000),
    },
  });

  const response = await request.get('/api/cron/cleanup');
  expect(response.status()).toBe(404);
  expect(
    await prisma.verification.findUnique({ where: { id: verification.id } }),
  ).not.toBeNull();
});

test('the browser does not contact Sentry when no DSN is configured', async ({ page }) => {
  const sentryRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('127.0.0.1:3102')) sentryRequests.push(request.url());
  });

  await page.goto('/auth/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(sentryRequests).toEqual([]);
});

test('rejecting Turnstile blocks registration without creating a user or email', async ({ page }) => {
  const email = `e2e-turnstile-signup-${Date.now()}@e2e.invalid`;
  await page.goto('/auth/register');
  await page.getByPlaceholder('John Doe').fill('Rejected Signup');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Create a password').fill('E2e-User-Password-123!');
  await page.getByPlaceholder('Confirm your password').fill('E2e-User-Password-123!');
  await page.getByRole('checkbox').check();
  const button = page.getByRole('button', { name: 'Create account' });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByText('Captcha verification failed. Please try again.')).toBeVisible();

  expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  expect(await getOutboxMessages(email)).toEqual([]);
});

test('rejecting Turnstile blocks password recovery without sending email', async ({ page }) => {
  const { email } = await createTestUser();
  const usersBefore = await prisma.user.count();
  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(email);
  const button = page.getByRole('button', { name: 'Send reset code' });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByText('Captcha verification failed. Please try again.')).toBeVisible();

  expect(await prisma.user.count()).toBe(usersBefore);
  expect(await getOutboxMessages(email)).toEqual([]);
});
