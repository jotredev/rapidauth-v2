import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import {
  cleanE2EData,
  createAdminWith2FA,
  createTestUser,
  E2E_PASSWORD,
  enableTestTwoFactor,
  getOutboxMessage,
  getOutboxMessages,
  prisma,
  signInWithPasswordAndTotp,
  submitPasswordSignIn,
} from './helpers';

test.beforeEach(async () => {
  await cleanE2EData();
});

test.afterEach(async () => {
  await cleanE2EData();
});

test('registration sends 6-digit code without url or links, and verifying leads to login without a session', async ({
  page,
}) => {
  const email = `e2e-reg-otp-${Date.now()}@e2e.invalid`;
  await page.goto('/auth/register');
  await page.getByPlaceholder('John Doe').fill('OTP Register User');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Create a password').fill(E2E_PASSWORD);
  await page.getByPlaceholder('Confirm your password').fill(E2E_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/auth/verify-email\\?email=${encodeURIComponent(email)}&sent=1`)
  );

  const message = await getOutboxMessage(email);
  expect(message.code).toMatch(/^\d{6}$/);
  expect(message.url).toBeUndefined();
  expect(message.html).not.toContain('href=');
  expect(message.html).not.toContain('<a ');

  await page.locator('input[data-input-otp]').fill(message.code!);
  await page.getByRole('button', { name: 'Verify email' }).click();

  await expect(page).toHaveURL(/\/auth\/login\?notice=email-verified/);
  await expect(page.getByText('Email verified. Sign in with your password.')).toBeVisible();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(user.emailVerified).toBe(true);
  expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
});

test('verification code is hashed and not stored in plain text in database', async ({
  page,
}) => {
  const email = `e2e-hash-${Date.now()}@e2e.invalid`;
  await page.goto('/auth/register');
  await page.getByPlaceholder('John Doe').fill('Hashed OTP User');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Create a password').fill(E2E_PASSWORD);
  await page.getByPlaceholder('Confirm your password').fill(E2E_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/auth\/verify-email/);
  const message = await getOutboxMessage(email);
  const code = message.code!;

  const verifications = await prisma.verification.findMany({
    where: { identifier: { contains: email } },
  });
  expect(verifications.length).toBeGreaterThan(0);
  for (const v of verifications) {
    expect(v.value).not.toContain(code);
  }
});

test('wrong code shows Invalid code and locks after 5 attempts', async ({
  page,
}) => {
  const email = `e2e-attempts-${Date.now()}@e2e.invalid`;
  await page.goto('/auth/register');
  await page.getByPlaceholder('John Doe').fill('Attempts User');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Create a password').fill(E2E_PASSWORD);
  await page.getByPlaceholder('Confirm your password').fill(E2E_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/auth\/verify-email/);
  const message = await getOutboxMessage(email);
  const validCode = message.code!;
  const wrongCode = validCode === '123456' ? '654321' : '123456';

  for (let attempt = 1; attempt <= 5; attempt++) {
    await page.locator('input[data-input-otp]').fill(wrongCode);
    await page.getByRole('button', { name: 'Verify email' }).click();
    await expect(page.getByText('Invalid code.')).toBeVisible();
  }

  // Attempt 6 with the REAL code: must be rejected with too many attempts
  await page.locator('input[data-input-otp]').fill(validCode);
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(
    page.getByText('Too many attempts. Request a new code.')
  ).toBeVisible();
});

test('expired code shows This code has expired message', async ({ page }) => {
  const email = `e2e-expired-${Date.now()}@e2e.invalid`;
  await page.goto('/auth/register');
  await page.getByPlaceholder('John Doe').fill('Expired OTP User');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Create a password').fill(E2E_PASSWORD);
  await page.getByPlaceholder('Confirm your password').fill(E2E_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/auth\/verify-email/);
  const message = await getOutboxMessage(email);

  await prisma.verification.updateMany({
    where: { identifier: { contains: email } },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });

  await page.locator('input[data-input-otp]').fill(message.code!);
  await page.getByRole('button', { name: 'Verify email' }).click();

  await expect(
    page.getByText('This code has expired. Request a new one.')
  ).toBeVisible();
});

test('unverified sign-in redirects to verify-email without sending new email or creating log', async ({
  page,
}) => {
  const { user, email, password } = await createTestUser({
    emailVerified: false,
  });
  await page.goto('/auth/login');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/auth/verify-email\\?email=${encodeURIComponent(email)}`)
  );
  await expect(
    page.getByText(
      'Your email is not verified yet. Enter the code we sent you or request a new one.'
    )
  ).toBeVisible();

  const outbox = await getOutboxMessages(email);
  expect(outbox).toHaveLength(0);

  const logs = await prisma.operationalLog.count({
    where: { userId: user.id },
  });
  expect(logs).toBe(0);
});

test('resend code has 60s cooldown, delivers working new code, and shows identical confirmation for nonexistent user', async ({
  page,
}) => {
  const email = `e2e-resend-${Date.now()}@e2e.invalid`;
  await page.goto('/auth/register');
  await page.getByPlaceholder('John Doe').fill('Resend Code User');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Create a password').fill(E2E_PASSWORD);
  await page.getByPlaceholder('Confirm your password').fill(E2E_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/auth/verify-email\\?email=${encodeURIComponent(email)}&sent=1`)
  );
  const firstMessage = await getOutboxMessage(email);

  const resendBtn = page.getByRole('button', { name: /Resend code in \d+s/ });
  await expect(resendBtn).toBeDisabled();

  await page.goto(`/auth/verify-email?email=${encodeURIComponent(email)}`);
  const activeResendBtn = page.getByRole('button', { name: 'Resend code' });
  await expect(activeResendBtn).toBeEnabled();

  await activeResendBtn.click();
  const confirmationText =
    "If an account exists for this email, we sent a code. If it doesn't arrive in a few minutes, contact support.";
  await expect(page.getByText(confirmationText)).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Resend code in \d+s/ })
  ).toBeDisabled();

  await expect.poll(async () => (await getOutboxMessages(email)).length).toBe(2);
  const messages = await getOutboxMessages(email);
  const secondMessage = messages[0]!;
  expect(secondMessage.code).toBeDefined();
  expect(secondMessage.code).not.toBe(firstMessage.code);

  await page.locator('input[data-input-otp]').fill(secondMessage.code!);
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page).toHaveURL(/\/auth\/login\?notice=email-verified/);

  // Non-existent account
  const nonexistent = `e2e-nonexistent-${Date.now()}@e2e.invalid`;
  await page.goto(`/auth/verify-email?email=${encodeURIComponent(nonexistent)}`);
  await page.getByRole('button', { name: 'Resend code' }).click();
  await expect(page.getByText(confirmationText)).toBeVisible();
  expect(await getOutboxMessages(nonexistent)).toHaveLength(0);
});

test('pending invited user requesting code sends nothing and shows identical message', async ({
  page,
}) => {
  const pendingUser = await createTestUser({
    status: 'pending',
    emailVerified: false,
  });

  await page.goto(
    `/auth/verify-email?email=${encodeURIComponent(pendingUser.email)}`
  );
  await page.getByRole('button', { name: 'Resend code' }).click();

  const confirmationText =
    "If an account exists for this email, we sent a code. If it doesn't arrive in a few minutes, contact support.";
  await expect(page.getByText(confirmationText)).toBeVisible();

  const messages = await getOutboxMessages(pendingUser.email);
  expect(messages).toHaveLength(0);
});

test('/auth/email-verified redirects to /auth/verify-email', async ({
  page,
}) => {
  await page.goto('/auth/email-verified?token=cualquiera');
  await expect(page).toHaveURL(/\/auth\/verify-email/);
});

test('pending user with direct verification code is blocked with invitation message and stays unverified without session', async ({
  page,
}) => {
  const pendingUser = await createTestUser({
    status: 'pending',
    emailVerified: false,
  });

  const code = '123456';
  const hash = createHash('sha256').update(code).digest('base64url');
  await prisma.verification.create({
    data: {
      identifier: `email-verification-otp-${pendingUser.email.toLowerCase()}`,
      value: `${hash}:0`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await page.goto(
    `/auth/verify-email?email=${encodeURIComponent(pendingUser.email)}`
  );
  await page.locator('input[data-input-otp]').fill(code);
  await page.getByRole('button', { name: 'Verify email' }).click();

  await expect(
    page.getByText('Accept your invitation from the email we sent you.')
  ).toBeVisible();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: pendingUser.user.id },
  });
  expect(user.emailVerified).toBe(false);
  expect(await prisma.session.count({ where: { userId: pendingUser.user.id } })).toBe(0);
});

test('admin email change on a 2FA user: verifying the new address does not sign in and login still requires 2FA', async ({
  page,
  browser,
}) => {
  const admin = await createAdminWith2FA({ name: 'E2E Email Change Admin' });
  const target = await createTestUser({ name: 'E2E Email Change Target' });
  await enableTestTwoFactor(target.user.id);
  const newEmail = `e2e-email-change-${Date.now()}@e2e.invalid`;

  await signInWithPasswordAndTotp(page, admin.email, admin.password, admin.secret);
  await page.goto(`/dashboard/users?q=${encodeURIComponent(target.email)}`);
  await page.getByRole('row').filter({ hasText: target.email }).getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Edit User' }).click();

  await page.getByRole('dialog').getByLabel('Email Address').fill(newEmail);
  await page.getByRole('dialog').getByRole('button', { name: 'Save Changes' }).click();

  await expect.poll(async () => {
    return prisma.user.findUnique({
      where: { id: target.user.id },
      select: { email: true, emailVerified: true },
    });
  }).toEqual({ email: newEmail, emailVerified: false });

  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(`/auth/verify-email?email=${encodeURIComponent(newEmail)}`);
  const message = await getOutboxMessage(newEmail);
  expect(message.code).toMatch(/^\d{6}$/);
  await other.locator('input[data-input-otp]').fill(message.code!);
  await other.getByRole('button', { name: 'Verify email' }).click();
  await expect(other).toHaveURL(/\/auth\/login\?notice=email-verified/);

  const updatedTarget = await prisma.user.findUniqueOrThrow({
    where: { id: target.user.id },
  });
  expect(updatedTarget.emailVerified).toBe(true);
  expect(await prisma.session.count({ where: { userId: target.user.id } })).toBe(0);

  await submitPasswordSignIn(other, newEmail, target.password);
  await expect(other).toHaveURL(/\/auth\/two-factor$/);

  await context.close();
});


