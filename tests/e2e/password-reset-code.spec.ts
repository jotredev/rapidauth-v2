import { test, expect } from '@playwright/test';
import {
  cleanE2EData,
  createTestInvitation,
  createTestSession,
  createTestUser,
  getOutboxMessage,
  getOutboxMessages,
  installTestTurnstileWidget,
  prisma,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await installTestTurnstileWidget(page);
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
  });
  await cleanE2EData();
});

test.afterEach(async () => {
  await cleanE2EData();
});

test('happy path: forgot password sends 6-digit code without link, resets password, revokes previous sessions, shows notice and sends security email', async ({
  page,
}) => {
  const { user, email, password: oldPassword } = await createTestUser();
  await createTestSession(user.id);
  expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);

  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByRole('button', { name: 'Send reset code' }).click();

  await expect(page).toHaveURL(
    new RegExp(
      `/auth/reset-password\\?email=${encodeURIComponent(email)}&sent=1`
    )
  );

  const message = await getOutboxMessage(email);
  expect(message.code).toMatch(/^\d{6}$/);
  expect(message.url).toBeUndefined();
  expect(message.html).not.toContain('href=');
  expect(message.html).not.toContain('<a ');

  const newPassword = 'New-Password-123!';
  await page.locator('input[data-input-otp]').fill(message.code!);
  await page.getByPlaceholder('Enter new password').fill(newPassword);
  await page.getByPlaceholder('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Reset password' }).click();

  await expect(page).toHaveURL(/\/auth\/login\?notice=password-reset/);
  await expect(
    page.getByText('Password reset. Sign in with your new password.')
  ).toBeVisible();

  // Previous sessions revoked
  expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);

  // Security notice email
  const notices = (await getOutboxMessages(email)).filter(
    (m) => m.subject === 'Your password was reset'
  );
  expect(notices).toHaveLength(1);
  expect(notices[0]!.html).toContain('UTC');

  // Sign in with new password
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(newPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Old password no longer works: stays on /auth/login with an error
  await page.context().clearCookies();
  await page.goto('/auth/login');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(oldPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByText(/invalid/i)).toBeVisible();

  // Reusing the same code on /auth/reset-password gives "Invalid code."
  await page.goto(`/auth/reset-password?email=${encodeURIComponent(email)}`);
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.locator('input[data-input-otp]').fill(message.code!);
  await page.getByPlaceholder('Enter new password').fill('Another-Password-123!');
  await page.getByPlaceholder('Confirm new password').fill('Another-Password-123!');
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page.getByText('Invalid code.')).toBeVisible();
});

test('wrong code shows Invalid code and locks after 5 failed attempts', async ({
  page,
}) => {
  const { email } = await createTestUser();
  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page).toHaveURL(/\/auth\/reset-password/);

  const message = await getOutboxMessage(email);
  const validCode = message.code!;
  const wrongCode = validCode === '123456' ? '654321' : '123456';
  const newPassword = 'New-Password-123!';

  await page.getByPlaceholder('Enter new password').fill(newPassword);
  await page.getByPlaceholder('Confirm new password').fill(newPassword);

  for (let attempt = 1; attempt <= 5; attempt++) {
    await page.locator('input[data-input-otp]').fill(wrongCode);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByText('Invalid code.')).toBeVisible();
  }

  // Attempt 6 with the REAL code: must be rejected with too many attempts
  await page.locator('input[data-input-otp]').fill(validCode);
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(
    page.getByText('Too many attempts. Request a new code.')
  ).toBeVisible();
});

test('expired code shows This code has expired message', async ({ page }) => {
  const { email } = await createTestUser();
  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page).toHaveURL(/\/auth\/reset-password/);

  const message = await getOutboxMessage(email);

  await prisma.verification.updateMany({
    where: { identifier: { contains: email } },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });

  const newPassword = 'New-Password-123!';
  await page.locator('input[data-input-otp]').fill(message.code!);
  await page.getByPlaceholder('Enter new password').fill(newPassword);
  await page.getByPlaceholder('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Reset password' }).click();

  await expect(
    page.getByText('This code has expired. Request a new one.')
  ).toBeVisible();
});

test('nonexistent account shows identical message and sends no email', async ({
  page,
}) => {
  const nonExistentEmail = `e2e-nonexistent-${Date.now()}@e2e.invalid`;
  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(nonExistentEmail);
  await page.getByRole('button', { name: 'Send reset code' }).click();

  await expect(page).toHaveURL(
    new RegExp(
      `/auth/reset-password\\?email=${encodeURIComponent(nonExistentEmail)}&sent=1`
    )
  );

  const expectedText =
    "If an account exists for this email, we sent a code. If it doesn't arrive in a few minutes, contact support.";
  await expect(page.getByText(expectedText)).toBeVisible();

  const messages = await getOutboxMessages(nonExistentEmail);
  expect(messages).toHaveLength(0);
});

test('code is hashed and not stored in plain text in database', async ({
  page,
}) => {
  const { email } = await createTestUser();
  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page).toHaveURL(/\/auth\/reset-password/);

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

test('unverified user who resets password becomes emailVerified true', async ({
  page,
}) => {
  const { user, email } = await createTestUser({ emailVerified: false });
  expect(user.emailVerified).toBe(false);

  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page).toHaveURL(/\/auth\/reset-password/);

  const message = await getOutboxMessage(email);
  const newPassword = 'New-Password-123!';
  await page.locator('input[data-input-otp]').fill(message.code!);
  await page.getByPlaceholder('Enter new password').fill(newPassword);
  await page.getByPlaceholder('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Reset password' }).click();

  await expect(page).toHaveURL(/\/auth\/login\?notice=password-reset/);

  const updatedUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
  });
  expect(updatedUser.emailVerified).toBe(true);
});

test('pending invited user with expired invitation resets with code, becomes active and verified, deletes invitation rows and can sign in', async ({
  page,
}) => {
  const pendingUser = await createTestUser({
    status: 'pending',
    emailVerified: false,
  });

  // Create expired invitation
  await createTestInvitation(pendingUser.user.id, {
    expiresAt: new Date(Date.now() - 60_000),
  });

  const initialInvites = await prisma.verification.findMany({
    where: {
      value: pendingUser.user.id,
      identifier: { startsWith: 'user-invite:' },
    },
  });
  expect(initialInvites.length).toBeGreaterThan(0);

  // Forgot password flow
  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(pendingUser.email);
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page).toHaveURL(/\/auth\/reset-password/);

  const message = await getOutboxMessage(pendingUser.email);
  const newPassword = 'New-Password-123!';
  await page.locator('input[data-input-otp]').fill(message.code!);
  await page.getByPlaceholder('Enter new password').fill(newPassword);
  await page.getByPlaceholder('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Reset password' }).click();

  await expect(page).toHaveURL(/\/auth\/login\?notice=password-reset/);

  const updatedUser = await prisma.user.findUniqueOrThrow({
    where: { id: pendingUser.user.id },
  });
  expect(updatedUser.status).toBe('active');
  expect(updatedUser.emailVerified).toBe(true);

  // Invitation rows deleted
  const remainingInvites = await prisma.verification.findMany({
    where: {
      value: pendingUser.user.id,
      identifier: { startsWith: 'user-invite:' },
    },
  });
  expect(remainingInvites).toHaveLength(0);

  // Can sign in
  await page.getByPlaceholder('name@example.com').fill(pendingUser.email);
  await page.getByPlaceholder('Enter your password').fill(newPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/(dashboard|auth\/accept-terms)/);
});

test('pending invited user with a valid invitation resets with code and the invitation stops working', async ({
  page,
}) => {
  const pendingUser = await createTestUser({
    status: 'pending',
    emailVerified: false,
  });

  // Create valid invitation (expires in 7 days)
  const token = await createTestInvitation(pendingUser.user.id, {
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const initialInvites = await prisma.verification.findMany({
    where: {
      value: pendingUser.user.id,
      identifier: { startsWith: 'user-invite:' },
    },
  });
  expect(initialInvites.length).toBeGreaterThan(0);

  // Forgot password flow
  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(pendingUser.email);
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page).toHaveURL(/\/auth\/reset-password/);

  const message = await getOutboxMessage(pendingUser.email);
  const newPassword = 'New-Password-123!';
  await page.locator('input[data-input-otp]').fill(message.code!);
  await page.getByPlaceholder('Enter new password').fill(newPassword);
  await page.getByPlaceholder('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Reset password' }).click();

  await expect(page).toHaveURL(/\/auth\/login\?notice=password-reset/);

  // Invitation rows deleted
  const remainingInvites = await prisma.verification.findMany({
    where: {
      value: pendingUser.user.id,
      identifier: { startsWith: 'user-invite:' },
    },
  });
  expect(remainingInvites).toHaveLength(0);

  // Invitation link no longer works and shows invalid invitation message
  await page.goto(`/auth/accept-invite?token=${encodeURIComponent(token)}`);
  await expect(
    page.getByText(
      'This invitation link is invalid, expired, or has already been used.'
    )
  ).toBeVisible();
});

test('old link with ?token= redirects to /auth/forgot-password', async ({
  page,
}) => {
  await page.goto('/auth/reset-password?token=cualquiera');
  await expect(page).toHaveURL(/\/auth\/forgot-password/);
});

test('resend code: with sent=1 button is disabled with visible countdown, without sent is active, and resending delivers new code', async ({
  page,
}) => {
  const { email } = await createTestUser();
  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByRole('button', { name: 'Send reset code' }).click();

  await expect(page).toHaveURL(
    new RegExp(
      `/auth/reset-password\\?email=${encodeURIComponent(email)}&sent=1`
    )
  );
  const firstMessage = await getOutboxMessage(email);

  // With sent=1, button is disabled with visible countdown
  const resendBtn = page.getByRole('button', { name: /Resend code in \d+s/ });
  await expect(resendBtn).toBeDisabled();

  // Without sent, button is active from the start
  await page.goto(`/auth/reset-password?email=${encodeURIComponent(email)}`);
  const activeResendBtn = page.getByRole('button', { name: 'Resend code' });
  await expect(activeResendBtn).toBeEnabled();

  // Click resend
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

  const newPassword = 'New-Password-123!';
  await page.locator('input[data-input-otp]').fill(secondMessage.code!);
  await page.getByPlaceholder('Enter new password').fill(newPassword);
  await page.getByPlaceholder('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Reset password' }).click();

  await expect(page).toHaveURL(/\/auth\/login\?notice=password-reset/);
});
