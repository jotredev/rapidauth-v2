import { expect, test } from '@playwright/test';
import {
  cleanE2EData,
  createAdminWith2FA,
  createTestSession,
  createTestUser,
  enableTestTwoFactor,
  enableSeededAdminTwoFactor,
  generateTotpForStoredSecret,
  prisma,
  signInWithPasswordAndTotp,
  submitPasswordSignIn,
} from './helpers';
import { getOutboxMessage, getOutboxMessages } from './helpers/outbox';

const ADMIN_EMAIL = 'admin@e2e.invalid';

test.beforeEach(async ({ page }) => {
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
  });
});

test.afterEach(async () => {
  await cleanE2EData();
  await prisma.session.deleteMany({ where: { user: { email: ADMIN_EMAIL } } });
});

async function signInAdmin(page: import('@playwright/test').Page) {
  const admin = await enableSeededAdminTwoFactor();
  await signInWithPasswordAndTotp(page, admin.email, admin.password, admin.secret);
}

async function openUsersForEmail(
  page: import('@playwright/test').Page,
  email: string,
) {
  await page.goto(`/dashboard/users?q=${encodeURIComponent(email)}`);
}

async function generateTemporaryPassword(
  page: import('@playwright/test').Page,
  email: string,
) {
  await openUsersForEmail(page, email);
  const row = page.getByRole('row').filter({ hasText: email });
  await row.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Reset Password' }).click();
  await page.getByRole('button', { name: /Generate Temporary Password/ }).click();
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  const temporaryPassword = (await page.getByRole('dialog').locator('code').textContent())?.trim();
  expect(temporaryPassword).toBeTruthy();
  await page.getByRole('button', { name: 'Done' }).click();
  return temporaryPassword!;
}

test('email reset clears temporary-password state and a manual password must be changed before dashboard access', async ({ page, browser }) => {
  const emailResetUser = await createTestUser({
    mustChangePassword: true,
    temporaryPasswordExpiresAt: new Date(Date.now() + 60_000),
  });
  const temporaryPasswordUser = await createTestUser();
  await createTestSession(temporaryPasswordUser.user.id);
  await signInAdmin(page);
  await openUsersForEmail(page, emailResetUser.email);

  const emailRow = page.getByRole('row').filter({ hasText: emailResetUser.email });
  await emailRow.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Reset Password' }).click();
  await page.getByRole('button', { name: 'Send Email' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const emailReset = await getOutboxMessage(emailResetUser.email);
  expect(emailReset.subject).toBe('Your password reset code');
  expect(emailReset.code).toMatch(/^\d{6}$/);
  const resetPage = await browser.newPage();
  await resetPage.goto(`/auth/reset-password?email=${encodeURIComponent(emailResetUser.email)}`);
  await resetPage.locator('input[data-input-otp]').fill(emailReset.code!);
  await resetPage.getByPlaceholder('Enter new password').fill('Admin-Email-Reset-456!');
  await resetPage.getByPlaceholder('Confirm new password').fill('Admin-Email-Reset-456!');
  await resetPage.getByRole('button', { name: 'Reset password' }).click();
  await expect(resetPage).toHaveURL(/\/auth\/login\?notice=password-reset/);
  expect(await prisma.user.findUniqueOrThrow({
    where: { id: emailResetUser.user.id },
    select: { mustChangePassword: true, temporaryPasswordExpiresAt: true },
  })).toEqual({ mustChangePassword: false, temporaryPasswordExpiresAt: null });
  await resetPage.close();

  await openUsersForEmail(page, temporaryPasswordUser.email);
  const manualRow = page.getByRole('row').filter({ hasText: temporaryPasswordUser.email });
  await manualRow.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Reset Password' }).click();
  await page.getByRole('button', { name: /Generate Temporary Password/ }).click();
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  const passwordText = page.getByRole('dialog').locator('code');
  const temporaryPassword = (await passwordText.textContent())?.trim();
  expect(temporaryPassword?.length).toBeGreaterThanOrEqual(12);
  expect(await prisma.session.count({ where: { userId: temporaryPasswordUser.user.id } })).toBe(0);
  const temporaryState = await prisma.user.findUniqueOrThrow({
    where: { id: temporaryPasswordUser.user.id },
    select: { mustChangePassword: true, temporaryPasswordExpiresAt: true },
  });
  expect(temporaryState.mustChangePassword).toBe(true);
  expect(temporaryState.temporaryPasswordExpiresAt?.getTime()).toBeGreaterThan(
    Date.now() + 71 * 60 * 60 * 1000,
  );
  const manualNotices = (await getOutboxMessages(temporaryPasswordUser.email))
    .filter((message) => message.subject === 'A temporary password was created for your account');
  expect(manualNotices).toHaveLength(1);
  expect(manualNotices[0]!.html).not.toContain(temporaryPassword ?? '');

  const client = await browser.newPage();
  await client.context().setExtraHTTPHeaders({ 'x-forwarded-for': `192.0.2.${Math.floor(Math.random() * 200) + 1}` });
  await client.goto('/auth/login');
  await client.getByPlaceholder('name@example.com').fill(temporaryPasswordUser.email);
  await client.getByPlaceholder('Enter your password').fill(temporaryPassword ?? '');
  await client.getByRole('button', { name: 'Sign in' }).click();
  await expect(client).toHaveURL(/\/auth\/change-password$/);
  await client.goto('/dashboard');
  await expect(client).toHaveURL(/\/auth\/change-password$/);
  const permanentPassword = 'Permanent-E2e-Password-456!';
  await client.getByPlaceholder('Enter temporary password').fill(temporaryPassword ?? '');
  await client.getByPlaceholder('Enter new password').fill(permanentPassword);
  await client.getByPlaceholder('Confirm new password').fill(permanentPassword);
  await client.getByRole('button', { name: 'Change password' }).click();
  await expect(client).toHaveURL(/\/dashboard$/);
  expect(await prisma.user.findUniqueOrThrow({
    where: { id: temporaryPasswordUser.user.id },
    select: { mustChangePassword: true, temporaryPasswordExpiresAt: true },
  })).toEqual({ mustChangePassword: false, temporaryPasswordExpiresAt: null });
  await client.close();

  const returningClient = await browser.newPage();
  await returningClient.context().setExtraHTTPHeaders({
    'x-forwarded-for': `192.0.2.${Math.floor(Math.random() * 200) + 1}`,
  });
  await returningClient.goto('/auth/login');
  await returningClient.getByPlaceholder('name@example.com').fill(temporaryPasswordUser.email);
  await returningClient.getByPlaceholder('Enter your password').fill(permanentPassword);
  await returningClient.getByRole('button', { name: 'Sign in' }).click();
  await expect(returningClient).toHaveURL(/\/dashboard$/);
  await returningClient.close();
});

test('admin manual reset is hidden and the server rejects a forged request for another admin', async ({ page, browser }) => {
  const targetAdmin = await createAdminWith2FA();
  const regularUser = await createTestUser();
  await signInAdmin(page);
  await openUsersForEmail(page, targetAdmin.email);
  const adminRow = page.getByRole('row').filter({ hasText: targetAdmin.email });
  await adminRow.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Reset Password' }).click();
  await expect(page.getByRole('button', { name: /Generate Temporary Password/ })).toHaveCount(0);
  await expect(page.getByText('Admin passwords can only be reset by email link.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await openUsersForEmail(page, regularUser.email);
  const regularRow = page.getByRole('row').filter({ hasText: regularUser.email });
  await regularRow.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Reset Password' }).click();
  await page.getByRole('button', { name: /Generate Temporary Password/ }).click();
  const originalRequestPromise = page.waitForRequest((request) =>
    request.method() === 'POST' && Boolean(request.headers()['next-action']),
  );
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  const originalRequest = await originalRequestPromise;
  await expect(page.getByRole('heading', { name: 'Temporary Password Generated' })).toBeVisible();
  const originalHeaders = originalRequest.headers();
  const response = await page.request.post(originalRequest.url(), {
    headers: {
      'next-action': originalHeaders['next-action']!,
      'next-router-state-tree': originalHeaders['next-router-state-tree'] ?? '',
      accept: 'text/x-component',
      'content-type': 'text/plain;charset=UTF-8',
    },
    data: JSON.stringify([targetAdmin.user.id, { method: 'manual' }]),
    maxRedirects: 0,
  });
  expect(await response.text()).toContain(
    "Admins can only reset another admin's password by email link",
  );

  const targetAccount = await prisma.account.findFirstOrThrow({
    where: { userId: targetAdmin.user.id, providerId: 'credential' },
    select: { password: true },
  });
  expect(targetAccount.password).not.toBeNull();
  const targetClient = await browser.newPage();
  await targetClient.goto('/auth/login');
  await targetClient.getByPlaceholder('name@example.com').fill(targetAdmin.email);
  await targetClient.getByPlaceholder('Enter your password').fill(targetAdmin.password);
  await targetClient.getByRole('button', { name: 'Sign in' }).click();
  await expect(targetClient).toHaveURL(/\/auth\/two-factor$/);
  await targetClient.close();

  await page.getByRole('button', { name: 'Done' }).click();
  await openUsersForEmail(page, targetAdmin.email);
  await adminRow.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Reset Password' }).click();
  await page.getByRole('button', { name: 'Send Email' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const resetEmails = (await getOutboxMessages(targetAdmin.email)).filter(
    (message) => message.subject === 'Your password reset code',
  );
  expect(resetEmails).toHaveLength(1);
});

test('expired temporary passwords reject correct credentials, preserve normal invalid-password errors, and expire open sessions', async ({ page, browser }) => {
  const account = await createTestUser();
  await signInAdmin(page);
  await page.goto('/dashboard/users');
  const firstTemporaryPassword = await generateTemporaryPassword(page, account.email);
  await prisma.user.update({
    where: { id: account.user.id },
    data: { temporaryPasswordExpiresAt: new Date(Date.now() - 60_000) },
  });

  const wrongPasswordClient = await browser.newPage();
  await wrongPasswordClient.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
  });
  await wrongPasswordClient.goto('/auth/login');
  await wrongPasswordClient.getByPlaceholder('name@example.com').fill(account.email);
  await wrongPasswordClient.getByPlaceholder('Enter your password').fill('Wrong-Password-123!');
  await wrongPasswordClient.getByRole('button', { name: 'Sign in' }).click();
  await expect(wrongPasswordClient.getByText(/invalid|incorrect/i)).toBeVisible();
  await expect(wrongPasswordClient.getByText(/temporary password has expired/i)).toHaveCount(0);
  await wrongPasswordClient.close();

  const expiredClient = await browser.newPage();
  await expiredClient.context().setExtraHTTPHeaders({
    'x-forwarded-for': `192.0.2.${Math.floor(Math.random() * 200) + 1}`,
  });
  await submitPasswordSignIn(expiredClient, account.email, firstTemporaryPassword);
  await expect(expiredClient.getByText(
    'Your temporary password has expired. Ask an administrator for a new one.',
  )).toBeVisible();
  await expect(expiredClient).toHaveURL(/\/auth\/login$/);
  expect(await prisma.session.count({ where: { userId: account.user.id } })).toBe(0);
  await expiredClient.close();

  const renewedTemporaryPassword = await generateTemporaryPassword(page, account.email);
  const renewedState = await prisma.user.findUniqueOrThrow({
    where: { id: account.user.id },
    select: { temporaryPasswordExpiresAt: true },
  });
  expect(renewedState.temporaryPasswordExpiresAt?.getTime()).toBeGreaterThan(Date.now());

  const activeClient = await browser.newPage();
  await activeClient.context().setExtraHTTPHeaders({
    'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
  });
  await submitPasswordSignIn(activeClient, account.email, renewedTemporaryPassword);
  await expect(activeClient).toHaveURL(/\/auth\/change-password$/);
  await prisma.user.update({
    where: { id: account.user.id },
    data: { temporaryPasswordExpiresAt: new Date(Date.now() - 60_000) },
  });
  await activeClient.getByPlaceholder('Enter temporary password').fill(renewedTemporaryPassword);
  await activeClient.getByPlaceholder('Enter new password').fill('Too-Late-Password-456!');
  await activeClient.getByPlaceholder('Confirm new password').fill('Too-Late-Password-456!');
  await activeClient.getByRole('button', { name: 'Change password' }).click();
  await expect(activeClient).toHaveURL(
    /\/auth\/login\?notice=temporary-password-expired$/,
  );
  await expect(activeClient.getByText(
    'Your temporary password has expired. Ask an administrator for a new one.',
  )).toBeVisible();
  expect(await prisma.session.count({ where: { userId: account.user.id } })).toBe(0);
  await activeClient.close();
});

test('temporary-password users with 2FA complete the challenge before the mandatory change page', async ({ page, browser }) => {
  const account = await createTestUser();
  const twoFactor = await enableTestTwoFactor(account.user.id);
  await signInAdmin(page);
  await page.goto('/dashboard/users');
  const temporaryPassword = await generateTemporaryPassword(page, account.email);

  const client = await browser.newPage();
  await submitPasswordSignIn(client, account.email, temporaryPassword);
  await expect(client).toHaveURL(/\/auth\/two-factor$/);
  await client.locator('input[data-input-otp]').fill(
    generateTotpForStoredSecret(twoFactor.secret),
  );
  await expect(client).toHaveURL(/\/auth\/change-password$/);
  await client.close();
});

test('login ignores free-form and unknown notices without rendering an empty alert', async ({ page }) => {
  await page.goto('/auth/login?message=Your%20account%20is%20locked');
  await expect(page.getByText('Your account is locked')).toHaveCount(0);
  await expect(page.locator('[data-slot="alert"]')).toHaveCount(0);

  await page.goto('/auth/login?notice=desconocido');
  await expect(page.getByText('desconocido')).toHaveCount(0);
  await expect(page.locator('[data-slot="alert"]')).toHaveCount(0);
});

test('main pages load without browser console or runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  for (const route of ['/', '/auth/login', '/auth/register', '/auth/forgot-password']) {
    await page.goto(route);
    await expect(page.locator('body')).not.toBeEmpty();
  }

  await signInAdmin(page);
  for (const route of ['/dashboard', '/dashboard/users', '/dashboard/activity', '/dashboard/profile']) {
    await page.goto(route);
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page).toHaveURL(new RegExp(route.replaceAll('/', '\\/')));
  }

  expect(errors).toEqual([]);
});
