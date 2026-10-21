import { expect, test } from '@playwright/test';

import {
  cleanE2EData,
  createTestUser,
  installTestTurnstileWidget,
  submitPasswordSignIn,
} from './helpers';
import { getOutboxMessage, getOutboxMessages } from './helpers/outbox';

test.afterEach(async () => {
  await cleanE2EData();
});

test('changing a password from Profile sends one security notice', async ({ page }) => {
  const account = await createTestUser();
  await submitPasswordSignIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/dashboard/profile');
  await page.getByRole('tab', { name: 'Security' }).click();
  await page.getByPlaceholder('Enter current password').fill(account.password);
  await page.getByPlaceholder('Enter new password').fill('E2e-Changed-Password-456!');
  await page.getByPlaceholder('Confirm new password').fill('E2e-Changed-Password-456!');
  await page.getByRole('button', { name: 'Update Password' }).click();
  await expect(page.getByText('Password changed successfully')).toBeVisible();

  const notices = (await getOutboxMessages(account.email))
    .filter((message) => message.subject === 'Your password was changed');
  expect(notices).toHaveLength(1);
  expect(notices[0]!.html).toContain('UTC');
  expect(notices[0]!.html).toContain('support@e2e.invalid');
  expect(notices[0]!.html).not.toContain('REPLACE_WITH_CONTACT_EMAIL');
});

test('resetting a password with a code sends one security notice', async ({ page }) => {
  await installTestTurnstileWidget(page);
  const account = await createTestUser();
  await page.goto('/auth/forgot-password');
  await page.getByPlaceholder('name@example.com').fill(account.email);
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page).toHaveURL(/\/auth\/reset-password/);
  const resetMessage = await getOutboxMessage(account.email);
  await page.locator('input[data-input-otp]').fill(resetMessage.code!);
  await page.getByPlaceholder('Enter new password').fill('E2e-Reset-Password-456!');
  await page.getByPlaceholder('Confirm new password').fill('E2e-Reset-Password-456!');
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page).toHaveURL(/\/auth\/login\?notice=password-reset/);

  const notices = (await getOutboxMessages(account.email))
    .filter((message) => message.subject === 'Your password was reset');
  expect(notices).toHaveLength(1);
  expect(notices[0]!.html).toContain('UTC');
  expect(notices[0]!.html).toContain('support@e2e.invalid');
  expect(notices[0]!.html).not.toContain('REPLACE_WITH_CONTACT_EMAIL');
});
