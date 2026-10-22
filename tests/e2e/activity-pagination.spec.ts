import { expect, test, type Page } from '@playwright/test';
import {
  cleanE2EData,
  createTestUser,
  enableSeededAdminTwoFactor,
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

async function signInAdmin(page: Page) {
  const admin = await enableSeededAdminTwoFactor();
  await signInWithPasswordAndTotp(page, admin.email, admin.password, admin.secret);
}

test('activity paginates on the server, filters by action and searches by email', async ({ page }) => {
  const { user, email } = await createTestUser({ email: `e2e-activity-${Date.now()}@e2e.invalid` });
  const now = Date.now();
  for (let i = 0; i < 25; i++) {
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: i < 5 ? 'password_change' : 'login',
        ipAddress: `203.0.113.${i + 1}`,
        createdAt: new Date(now - i * 60_000),
      },
    });
  }
  await signInAdmin(page);

  await page.goto(`/dashboard/activity?q=${encodeURIComponent(email)}`);
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await expect(page.getByText('Showing 1–20 of 25 logs')).toBeVisible();
  await expect(page.getByText('Page 1 of 2')).toBeVisible();

  await page.getByRole('link', { name: 'Go to next page' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await expect(page.locator('tbody tr')).toHaveCount(5);

  await page.goto(`/dashboard/activity?q=${encodeURIComponent(email)}&pageSize=abc&page=99`);
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await expect(page.locator('tbody tr')).toHaveCount(5);

  await page.goto(`/dashboard/activity?q=${encodeURIComponent(email)}&action=password_change`);
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await expect(page.getByText('Showing 1–5 of 5 logs')).toBeVisible();

  await page.goto(`/dashboard/activity?q=203.0.113.25`);
  await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('typing in the search box updates the URL and the server results', async ({ page }) => {
  const { user, email } = await createTestUser({ email: `e2e-activity-search-${Date.now()}@e2e.invalid` });
  await prisma.activityLog.create({ data: { userId: user.id, action: 'register', ipAddress: '198.51.100.7' } });
  await signInAdmin(page);
  await page.goto('/dashboard/activity');

  await page.getByPlaceholder('Search by user, email, action, or IP...').fill(email);
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(email);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByText('Showing 1–1 of 1 logs')).toBeVisible();

  await page.locator('aside').getByRole('link', { name: 'Activity', exact: true }).click();
  await expect(page.getByPlaceholder('Search by user, email, action, or IP...')).toHaveValue('');
});
