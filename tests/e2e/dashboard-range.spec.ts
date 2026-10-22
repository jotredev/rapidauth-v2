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
import { getRangeWindow } from '../../lib/dashboard-range';

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

test('the date range changes the URL, the chart buckets and the new users metric', async ({ page }) => {
  const recent = await createTestUser({ email: `e2e-range-recent-${Date.now()}@e2e.invalid` });
  const older = await createTestUser({ email: `e2e-range-older-${Date.now()}@e2e.invalid` });
  const day = 24 * 60 * 60 * 1000;
  await prisma.user.update({ where: { id: recent.user.id }, data: { createdAt: new Date(Date.now() - 2 * day) } });
  await prisma.user.update({ where: { id: older.user.id }, data: { createdAt: new Date(Date.now() - 20 * day) } });
  await signInAdmin(page);

  await expect(page.getByRole('button', { name: 'Date range' })).toContainText('Past 30 days');
  await expect(page.locator('[data-slot="bar"]')).toHaveCount(30);

  await page.getByRole('button', { name: 'Date range' }).click();
  await page.getByRole('menuitemradio', { name: /Past 7 days/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('range')).toBe('7d');
  await expect(page.locator('[data-slot="bar"]')).toHaveCount(7);

  const start7d = getRangeWindow('7d', new Date()).start;
  const expectedNew = await prisma.user.count({ where: { createdAt: { gte: start7d } } });
  const newMetric = page.locator('[data-slot="metric"]', { hasText: 'New in period' });
  await expect(newMetric.locator('[data-slot="metric-value"]')).toHaveText(expectedNew.toLocaleString('en-US'));
  expect(expectedNew).toBeGreaterThanOrEqual(1);
  const withOlder = await prisma.user.count({ where: { createdAt: { gte: getRangeWindow('30d', new Date()).start } } });
  expect(withOlder).toBeGreaterThan(expectedNew);

  await page.goto('/dashboard?range=nonsense');
  await expect(page.getByRole('button', { name: 'Date range' })).toContainText('Past 30 days');
  await page.goto('/dashboard?range=12m');
  await expect(page.locator('[data-slot="bar"]')).toHaveCount(12);
  await page.goto('/dashboard?range=90d');
  await expect(page.getByText('New user registrations per week.')).toBeVisible();
});

test('a regular user does not see the date range', async ({ page }) => {
  const account = await createTestUser();
  await submitPasswordSignIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('button', { name: 'Date range' })).toHaveCount(0);
});
