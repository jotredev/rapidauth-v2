import { expect, test } from '@playwright/test';
import {
  cleanE2EData,
  createTestUser,
  E2E_PASSWORD,
  enableSeededAdminTwoFactor,
  getOutboxMessages,
  installTestTurnstileWidget,
  prisma,
  signInWithPasswordAndTotp,
} from './helpers';

const ADMIN_EMAIL = 'admin@e2e.invalid';

test.beforeEach(async ({ page }) => {
  await installTestTurnstileWidget(page);
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
  });
});

test.afterEach(async () => {
  await cleanE2EData();
  await prisma.session.deleteMany({ where: { user: { email: ADMIN_EMAIL } } });
});

test('successful registration records operational log without email or secrets in metadata', async ({ page }) => {
  const email = `e2e-reg-${Date.now()}@e2e.invalid`;
  await page.goto('/auth/register');
  await page.getByPlaceholder('John Doe').fill('Operational Log User');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Create a password').fill(E2E_PASSWORD);
  await page.getByPlaceholder('Confirm your password').fill(E2E_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/auth\/verify-email/);

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await expect.poll(async () =>
    prisma.operationalLog.count({
      where: {
        userId: user.id,
        level: 'info',
        code: 'email.delivery.sent',
      },
    })
  ).toBe(1);

  const log = await prisma.operationalLog.findFirstOrThrow({
    where: {
      userId: user.id,
      code: 'email.delivery.sent',
    },
  });

  expect(log.level).toBe('info');
  expect(log.source).toBe('emails');
  expect(log.code).toBe('email.delivery.sent');
  expect(log.userId).toBe(user.id);

  const metadata = log.metadata as Record<string, unknown>;
  expect(metadata.template).toBe('verification-code');
  expect(typeof metadata.durationMs).toBe('number');
  expect(metadata.durationMs).toBeGreaterThanOrEqual(0);

  expect(JSON.stringify(metadata)).not.toContain('@');
  expect(log.code).not.toContain('@');
  expect(log.level).not.toContain('@');
  expect(log.source).not.toContain('@');
});

test('registration with +delivery-fail preserves unverified user, shows error with support link, and records failed log', async ({ page }) => {
  const email = `e2e-reg-${Date.now()}+delivery-fail@e2e.invalid`;
  await page.goto('/auth/register');
  await page.getByPlaceholder('John Doe').fill('Failed Delivery User');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Create a password').fill(E2E_PASSWORD);
  await page.getByPlaceholder('Confirm your password').fill(E2E_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/delivery=failed/);

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(user.emailVerified).toBe(false);

  const alert = page
    .getByRole('alert')
    .filter({ hasText: "We couldn't send the verification email" });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("We couldn't send the verification email. Try again in a few minutes or contact support.");
  const supportLink = alert.getByRole('link', { name: 'contact support' });
  await expect(supportLink).toHaveAttribute('href', '/support');

  await expect.poll(async () =>
    prisma.operationalLog.count({
      where: {
        userId: user.id,
        level: 'error',
        code: 'email.delivery.failed',
      },
    })
  ).toBe(1);

  const log = await prisma.operationalLog.findFirstOrThrow({
    where: {
      userId: user.id,
      code: 'email.delivery.failed',
    },
  });

  expect(log.level).toBe('error');
  expect(log.source).toBe('emails');
  const metadata = log.metadata as Record<string, unknown>;
  expect(metadata.template).toBe('verification-code');
  expect(metadata.errorCode).toBe('outbox_forced_failure');
});

test('forgot password shows identical message for non-existent, good delivery, and failed delivery accounts', async ({ page }) => {
  const expectedText =
    "If an account exists for this email, we sent a code. If it doesn't arrive in a few minutes, contact support.";

  // Case 1: Non-existent account
  const nonExistentEmail = `e2e-nonexistent-${Date.now()}@e2e.invalid`;
  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(nonExistentEmail);
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page).toHaveURL(/\/auth\/reset-password/);
  await expect(page.getByText(expectedText)).toBeVisible();
  await expect(page.getByText(expectedText).getByRole('link', { name: 'contact support' })).toHaveAttribute('href', '/support');

  // Case 2: Good delivery account
  const goodUser = await createTestUser();
  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(goodUser.email);
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page).toHaveURL(/\/auth\/reset-password/);
  await expect(page.getByText(expectedText)).toBeVisible();
  await expect(page.getByText(expectedText).getByRole('link', { name: 'contact support' })).toHaveAttribute('href', '/support');

  // Case 3: Failed delivery account (+delivery-fail)
  const failEmail = `e2e-fail-${Date.now()}+delivery-fail@e2e.invalid`;
  const failUser = await createTestUser({ email: failEmail });
  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(failUser.email);
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page).toHaveURL(/\/auth\/reset-password/);
  await expect(page.getByText(expectedText)).toBeVisible();
  await expect(page.getByText(expectedText).getByRole('link', { name: 'contact support' })).toHaveAttribute('href', '/support');

  // Non-existent: no operational logs created for this email or password-reset
  await expect.poll(async () =>
    prisma.operationalLog.count({
      where: {
        userId: goodUser.user.id,
        level: 'info',
        code: 'email.delivery.sent',
      },
    })
  ).toBe(1);
  const goodLog = await prisma.operationalLog.findFirstOrThrow({
    where: { userId: goodUser.user.id, code: 'email.delivery.sent' },
  });
  expect((goodLog.metadata as Record<string, unknown>).template).toBe('password-reset-code');

  await expect.poll(async () =>
    prisma.operationalLog.count({
      where: {
        userId: failUser.user.id,
        level: 'error',
        code: 'email.delivery.failed',
      },
    })
  ).toBe(1);
  const failLog = await prisma.operationalLog.findFirstOrThrow({
    where: { userId: failUser.user.id, code: 'email.delivery.failed' },
  });
  expect((failLog.metadata as Record<string, unknown>).template).toBe('password-reset-code');
  expect((failLog.metadata as Record<string, unknown>).errorCode).toBe('outbox_forced_failure');
});

test('resend verification shows identical message for non-existent, good delivery, and failed delivery unverified accounts', async ({ page }) => {
  const expectedText =
    "If an account exists for this email, we sent a code. If it doesn't arrive in a few minutes, contact support.";

  // Case 1: Non-existent account
  const nonExistentEmail = `e2e-unverified-none-${Date.now()}@e2e.invalid`;
  await page.goto(`/auth/verify-email?email=${encodeURIComponent(nonExistentEmail)}`);
  await page.getByRole('button', { name: 'Resend code' }).click();
  await expect(page.getByText(expectedText)).toBeVisible();
  await expect(page.getByText(expectedText).getByRole('link', { name: 'contact support' })).toHaveAttribute('href', '/support');

  // Case 2: Good delivery unverified account
  const goodAccount = await createTestUser({ emailVerified: false });
  await page.goto(`/auth/verify-email?email=${encodeURIComponent(goodAccount.email)}`);
  await page.getByRole('button', { name: 'Resend code' }).click();
  await expect(page.getByText(expectedText)).toBeVisible();
  await expect(page.getByText(expectedText).getByRole('link', { name: 'contact support' })).toHaveAttribute('href', '/support');

  // Case 3: Failed delivery unverified account (+delivery-fail)
  const failEmail = `e2e-unverified-${Date.now()}+delivery-fail@e2e.invalid`;
  const failAccount = await createTestUser({ email: failEmail, emailVerified: false });
  await page.goto(`/auth/verify-email?email=${encodeURIComponent(failAccount.email)}`);
  await page.getByRole('button', { name: 'Resend code' }).click();
  await expect(page.getByText(expectedText)).toBeVisible();
  await expect(page.getByText(expectedText).getByRole('link', { name: 'contact support' })).toHaveAttribute('href', '/support');

  await expect.poll(async () =>
    prisma.operationalLog.count({
      where: {
        userId: goodAccount.user.id,
        level: 'info',
        code: 'email.delivery.sent',
      },
    })
  ).toBe(1);
  const goodLog = await prisma.operationalLog.findFirstOrThrow({
    where: { userId: goodAccount.user.id, code: 'email.delivery.sent' },
  });
  expect((goodLog.metadata as Record<string, unknown>).template).toBe('verification-code');

  await expect.poll(async () =>
    prisma.operationalLog.count({
      where: {
        userId: failAccount.user.id,
        level: 'error',
        code: 'email.delivery.failed',
      },
    })
  ).toBe(1);
  const failLog = await prisma.operationalLog.findFirstOrThrow({
    where: { userId: failAccount.user.id, code: 'email.delivery.failed' },
  });
  expect((failLog.metadata as Record<string, unknown>).template).toBe('verification-code');
  expect((failLog.metadata as Record<string, unknown>).errorCode).toBe('outbox_forced_failure');
});

test('admin user invitation with +delivery-fail shows failure notice and records failed log', async ({ page }) => {
  const admin = await enableSeededAdminTwoFactor();
  await signInWithPasswordAndTotp(page, admin.email, admin.password, admin.secret);

  const failEmail = `e2e-invite-${Date.now()}+delivery-fail@e2e.invalid`;
  await page.goto('/dashboard/users');
  await page.getByRole('button', { name: 'Add User' }).click();
  await page.getByPlaceholder('John Doe').fill('Failed Invite User');
  await page.getByPlaceholder('john@example.com').fill(failEmail);
  await page.getByRole('button', { name: 'Create User' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(
    page.getByText('User created, but the invitation email could not be sent. Use Resend invitation')
  ).toBeVisible();

  const invitedUser = await prisma.user.findUniqueOrThrow({ where: { email: failEmail } });
  expect(invitedUser.status).toBe('pending');

  await expect.poll(async () =>
    prisma.operationalLog.count({
      where: {
        userId: invitedUser.id,
        level: 'error',
        code: 'email.delivery.failed',
      },
    })
  ).toBe(1);

  const log = await prisma.operationalLog.findFirstOrThrow({
    where: {
      userId: invitedUser.id,
      code: 'email.delivery.failed',
    },
  });

  expect(log.level).toBe('error');
  expect(log.source).toBe('emails');
  const metadata = log.metadata as Record<string, unknown>;
  expect(metadata.template).toBe('invitation');
  expect(metadata.errorCode).toBe('outbox_forced_failure');
});

test('registering with an already existing unverified account does not send verification email or create log', async ({ page }) => {
  const existingUser = await createTestUser({ emailVerified: false });
  await page.goto('/auth/register');
  await page.getByPlaceholder('John Doe').fill('Existing Unverified User');
  await page.getByPlaceholder('name@example.com').fill(existingUser.email);
  await page.getByPlaceholder('Create a password').fill(E2E_PASSWORD);
  await page.getByPlaceholder('Confirm your password').fill(E2E_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/auth\/verify-email/);
  expect(page.url()).not.toContain('delivery=failed');

  const outboxMessages = await getOutboxMessages(existingUser.email);
  expect(outboxMessages).toHaveLength(0);

  const logCount = await prisma.operationalLog.count({
    where: { userId: existingUser.user.id },
  });
  expect(logCount).toBe(0);
});
