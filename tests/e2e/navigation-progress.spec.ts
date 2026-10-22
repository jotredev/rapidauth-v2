import { expect, test } from '@playwright/test';
import {
  cleanE2EData,
  createTestUser,
  installTestTurnstileWidget,
  submitPasswordSignIn,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await installTestTurnstileWidget(page);
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
  });
});

test.afterEach(async () => {
  await cleanE2EData();
});

test('the progress bar shows while the dashboard loads after signing in', async ({ page }) => {
  const account = await createTestUser();
  await page.route(/\/dashboard(\?.*)?$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await submitPasswordSignIn(page, account.email, account.password);
  await expect(page.locator('#nprogress')).toBeAttached();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.unroute(/\/dashboard(\?.*)?$/);
});

test('the dashboard has no sample notifications', async ({ page }) => {
  const account = await createTestUser();
  await submitPasswordSignIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('button', { name: 'Toggle theme' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications' })).toHaveCount(0);
  await expect(page.getByText('Profile Settings', { exact: true })).toBeVisible();
  await expect(page.getByText('Notifications', { exact: true })).toHaveCount(0);
});
