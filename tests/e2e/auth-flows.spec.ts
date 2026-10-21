import { expect, test } from '@playwright/test';
import {
  cleanE2EData,
  createTestUser,
  E2E_PASSWORD,
  installTestTurnstileWidget,
  prisma,
  submitPasswordSignIn,
} from './helpers';
import { getOutboxMessage } from './helpers/outbox';
import { siteConfig } from '../../config/site';

test.beforeEach(async ({ page }) => {
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
  });
});

test.afterEach(async () => {
  await cleanE2EData();
});

test('registration sends verification code; submitting code verifies email and leads to login without a session', async ({ page }) => {
  const email = `e2e-register-${Date.now()}@e2e.invalid`;
  await page.goto('/auth/register');
  await page.getByPlaceholder('John Doe').fill('Registration Test');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Create a password').fill(E2E_PASSWORD);
  await page.getByPlaceholder('Confirm your password').fill(E2E_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/auth\/verify-email/);

  const message = await getOutboxMessage(email);
  expect(message.subject).toBe('Your verification code');
  expect(message.code).toMatch(/^\d{6}$/);
  expect(message.url).toBeUndefined();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(user.emailVerified).toBe(false);
  expect(user.termsAcceptedAt).not.toBeNull();
  expect(user.termsVersion).toBe(siteConfig.termsVersion);
  await expect.poll(() => prisma.activityLog.count({
    where: { userId: user.id, action: 'terms_accepted' },
  })).toBe(1);

  await page.locator('input[data-input-otp]').fill(message.code!);
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page).toHaveURL(/\/auth\/login\?notice=email-verified/);
  expect((await prisma.user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(true);
  expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  await submitPasswordSignIn(page, email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard/);
});

test('social registration requires terms in the interface and starts Google only after acceptance', async ({ page }) => {
  await page.goto('/auth/register');
  const google = page.getByRole('button', { name: 'Google' });
  const github = page.getByRole('button', { name: 'GitHub' });

  await expect(google).toBeDisabled();
  await expect(github).toBeDisabled();
  await expect(page.getByText('Accept the Terms of Service and Privacy Policy to continue with Google or GitHub.')).toBeVisible();

  await page.getByRole('checkbox').check();
  await expect(google).toBeEnabled();
  await expect(github).toBeEnabled();

  const googleRequest = page.waitForRequest((request) =>
    new URL(request.url()).hostname === 'accounts.google.com'
  );
  await page.route('https://accounts.google.com/**', (route) => route.abort());
  await google.click();
  await googleRequest;
});

test('social registration server action rejects a replayed request without terms', async ({ page }) => {
  await page.route('https://accounts.google.com/**', (route) => route.abort());
  await page.goto('/auth/register');
  await page.getByRole('checkbox').check();

  const originalRequestPromise = page.waitForRequest((request) =>
    request.method() === 'POST' && Boolean(request.headers()['next-action'])
  );
  await page.getByRole('button', { name: 'Google' }).click();
  const originalRequest = await originalRequestPromise;
  const originalHeaders = originalRequest.headers();
  const nextAction = originalHeaders['next-action'];

  expect(nextAction).toBeTruthy();
  const response = await page.request.post(originalRequest.url(), {
    headers: {
      'next-action': nextAction!,
      'next-router-state-tree': originalHeaders['next-router-state-tree'] ?? '',
      accept: 'text/x-component',
      'content-type': 'text/plain;charset=UTF-8',
    },
    data: JSON.stringify([{ acceptTerms: false }]),
    maxRedirects: 0,
  });

  expect(response.headers()['x-action-redirect'] ?? '').not.toContain('accounts.google.com');
  expect(await response.text()).toContain('You must accept the terms and conditions');
});

test.describe('Google OAuth state', () => {
  test.beforeEach(async ({ page }) => {
    await prisma.verification.deleteMany({
      where: { identifier: { startsWith: 'auth-state:' } },
    });
    await page.route('https://accounts.google.com/**', (route) => route.abort());
  });

  test('social registration stores accepted terms in the Google OAuth state', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByRole('checkbox').check();

    const googleRequest = page.waitForRequest((request) =>
      new URL(request.url()).hostname === 'accounts.google.com'
    );
    await page.getByRole('button', { name: 'Google' }).click();
    await googleRequest;

    const row = await prisma.verification.findFirst({
      where: { identifier: { startsWith: 'auth-state:' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).not.toBeNull();
    const state = JSON.parse(row!.value) as {
      requestSignUp?: boolean;
      serverContext?: { termsAccepted?: boolean };
    };

    expect(state.requestSignUp).toBe(true);
    expect(state.serverContext?.termsAccepted).toBe(true);
  });

  test('social login does not store accepted terms in the Google OAuth state', async ({ page }) => {
    await page.goto('/auth/login');

    const googleRequest = page.waitForRequest((request) =>
      new URL(request.url()).hostname === 'accounts.google.com'
    );
    await page.getByRole('button', { name: 'Google' }).click();
    await googleRequest;

    const row = await prisma.verification.findFirst({
      where: { identifier: { startsWith: 'auth-state:' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).not.toBeNull();
    const state = JSON.parse(row!.value) as {
      requestSignUp?: boolean;
      serverContext?: { termsAccepted?: boolean };
    };

    expect(state.requestSignUp).not.toBe(true);
    expect(state.serverContext?.termsAccepted).toBeUndefined();
  });
});

test('login explains disabled OAuth sign-up and links to registration', async ({ page }) => {
  await page.goto('/auth/login?provider=google&error=signup_disabled');

  await expect(page.getByText('No account found for this Google account. Create one first.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create one first' })).toHaveAttribute('href', '/auth/register');
});

test('registration and password recovery submit buttons wait for a Turnstile token', async ({ page }) => {
  await installTestTurnstileWidget(page);
  await page.goto('/auth/register');
  const registerButton = page.getByRole('button', { name: 'Create account' });
  await expect(registerButton).toBeDisabled();
  await expect(registerButton).toBeEnabled();

  await page.goto('/auth/forgot-password');
  const resetButton = page.getByRole('button', { name: 'Send reset code' });
  await expect(resetButton).toBeDisabled();
  await expect(resetButton).toBeEnabled();
});

test('/auth/email-verified redirects to /auth/verify-email', async ({ page }) => {
  await page.goto('/auth/email-verified?token=not-a-valid-jwt');
  await expect(page).toHaveURL(/\/auth\/verify-email/);
});

test('inactive accounts cannot sign in', async ({ page }) => {
  const { email, password } = await createTestUser({ status: 'inactive' });
  await page.goto('/auth/login');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(/deactivated|inactive/i)).toBeVisible();
  await expect(page).not.toHaveURL(/\/dashboard/);
});

test('HTTP auth routes stay closed except for ok and error', async ({ request }) => {
  expect((await request.get('/api/auth/ok')).status()).toBe(200);
  expect((await request.get('/api/auth/error')).status()).not.toBe(404);
  for (const path of [
    '/api/auth/sign-up/email',
    '/api/auth/sign-in/email',
    '/api/auth/get-session',
    '/api/auth/request-password-reset',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    '/api/auth/send-verification-email',
    '/api/auth/two-factor/verify-totp',
    '/api/auth/list-sessions',
    '/api/auth/sign-out',
    '/api/auth/delete-user',
    '/api/auth/delete-user/callback',
  ]) {
    const response = path.endsWith('/get-session') || path.endsWith('/delete-user/callback')
      ? await request.get(path)
      : await request.post(path, { data: {} });
    expect(response.status(), `${path} must stay closed`).toBe(404);
  }
});
