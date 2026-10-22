import { expect, test, type Page } from '@playwright/test';
import {
  cleanE2EData,
  createTestUser,
  enableSeededAdminTwoFactor,
  signInWithPasswordAndTotp,
  submitPasswordSignIn,
} from './helpers';

test.afterEach(async () => {
  await cleanE2EData();
});

async function signInAdmin(page: Page) {
  const admin = await enableSeededAdminTwoFactor();
  await signInWithPasswordAndTotp(page, admin.email, admin.password, admin.secret);
}

test('admin sidebar shows the brand, the admin links, Support and the breadcrumb', async ({ page }) => {
  await signInAdmin(page);
  await page.goto('/dashboard/users');

  const sidebar = page.locator('aside');
  await expect(sidebar.getByText('rapidauth', { exact: true })).toBeVisible();
  await expect(sidebar.getByText(/^v\d+\.\d+\.\d+$/)).toBeVisible();
  for (const name of ['Dashboard', 'Users', 'Activity', 'System logs', 'Profile', 'Support']) {
    await expect(sidebar.getByRole('link', { name, exact: true })).toBeVisible();
  }

  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(breadcrumb).toContainText('RapidAuth');
  await expect(breadcrumb).toContainText('Users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
});

test('a regular user sees no admin links in the sidebar', async ({ page }) => {
  const account = await createTestUser();
  await submitPasswordSignIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  const sidebar = page.locator('aside');
  await expect(sidebar.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Support', exact: true })).toBeVisible();
  for (const name of ['Users', 'Activity', 'System logs']) {
    await expect(sidebar.getByRole('link', { name, exact: true })).toHaveCount(0);
  }
  await expect(sidebar.getByText('Menu', { exact: true })).toHaveCount(0);
});

test('the sidebar collapses to icons and its links still navigate', async ({ page }) => {
  await signInAdmin(page);

  const toggle = page.getByRole('button', { name: 'Toggle sidebar' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  const sidebar = page.locator('aside');
  await expect(sidebar.getByText('rapidauth', { exact: true })).toHaveCount(0);
  await sidebar.getByRole('link', { name: 'System logs', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/logs/);
  await expect(page.getByRole('heading', { level: 1, name: 'System logs' })).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(sidebar.getByText('rapidauth', { exact: true })).toBeVisible();
});

test('Support in the sidebar opens the support page', async ({ page }) => {
  const account = await createTestUser();
  await submitPasswordSignIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.locator('aside').getByRole('link', { name: 'Support', exact: true }).click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Support' })).toBeVisible();
});

test('the user menu is as wide as the sidebar button', async ({ page }) => {
  await signInAdmin(page);

  const trigger = page.locator('aside').getByRole('button', { name: /Administrator/ });
  // Radix hides the rest of the page from the accessibility tree while the menu is open.
  const t = await trigger.boundingBox();
  await trigger.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  // The menu opens with a zoom-in animation, so poll until it reaches its final width.
  await expect
    .poll(async () => Math.round((await menu.boundingBox())!.width))
    .toBe(Math.round(t!.width));
});
