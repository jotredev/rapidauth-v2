import { expect, test, type Page } from '@playwright/test';
import {
  cleanE2EData,
  createTestUser,
  enableSeededAdminTwoFactor,
  installTestTurnstileWidget,
  prisma,
  signInWithPasswordAndTotp,
  submitPasswordSignIn,
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

async function signInAdmin(page: Page) {
  const admin = await enableSeededAdminTwoFactor();
  await signInWithPasswordAndTotp(page, admin.email, admin.password, admin.secret);
}

test('Ctrl+K opens the palette and navigates to an admin page', async ({ page }) => {
  await signInAdmin(page);
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Search pages and commands...').fill('logs');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dashboard\/logs/);
  await expect(page.getByRole('heading', { level: 1, name: 'System logs' })).toBeVisible();
});

test('the sidebar Go to item opens the palette and theme commands switch the theme', async ({ page }) => {
  await signInAdmin(page);
  await page.locator('aside').getByRole('button', { name: /Go to/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('option', { name: 'Light theme' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);

  await page.keyboard.press('Control+k');
  await page.getByRole('dialog').getByRole('option', { name: 'Dark theme' }).click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
});

test('a regular user does not see admin pages in the palette and can log out from it', async ({ page }) => {
  const account = await createTestUser();
  await submitPasswordSignIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('option', { name: 'Profile' })).toBeVisible();
  await expect(dialog.getByRole('option', { name: 'Support' })).toBeVisible();
  for (const name of ['Users', 'Activity', 'System logs']) {
    await expect(dialog.getByRole('option', { name, exact: true })).toHaveCount(0);
  }

  await dialog.getByRole('option', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
});
