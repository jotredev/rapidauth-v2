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

test('a non-admin who opens /dashboard/logs is redirected to /dashboard', async ({ page }) => {
  const account = await createTestUser();
  await submitPasswordSignIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/dashboard/logs');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('admin sees System logs in the sidebar and clicking navigates to /dashboard/logs', async ({ page }) => {
  await signInAdmin(page);
  await page.goto('/dashboard');
  const sidebarLink = page.locator('aside').getByRole('link', { name: 'System logs', exact: true });
  await expect(sidebarLink).toBeVisible();
  await sidebarLink.click();
  await expect(page).toHaveURL(/\/dashboard\/logs/);
  await expect(page.getByRole('heading', { name: 'System logs' })).toBeVisible();
});

test('pagination with 25 logs filtered by userId', async ({ page }) => {
  const account = await createTestUser({ email: `e2e-logs-page-${Date.now()}@e2e.invalid` });
  const now = Date.now();
  for (let i = 0; i < 25; i++) {
    await prisma.operationalLog.create({
      data: {
        level: 'info',
        source: 'emails',
        code: 'email.delivery.sent',
        userId: account.user.id,
        createdAt: new Date(now - (25 - i) * 1000),
        metadata: {
          template: `verification-${i + 1}`,
          durationMs: i + 1,
        },
      },
    });
  }

  await signInAdmin(page);
  await page.goto(`/dashboard/logs?userId=${account.user.id}`);

  await expect(page.locator('tbody tr')).toHaveCount(20);
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await expect(page.getByText('template: verification-25')).toBeVisible();

  await page.getByRole('link', { name: 'Go to next page' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await expect(page.getByText('template: verification-1')).toBeVisible();

  await page.goto(`/dashboard/logs?userId=${account.user.id}&page=99`);
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await expect(page.locator('tbody tr')).toHaveCount(5);

  await page.goto(`/dashboard/logs?userId=${account.user.id}&pageSize=50`);
  await expect(page.locator('tbody tr')).toHaveCount(25);
  await expect(page.getByText('Page 1 of 1')).toBeVisible();
});

test('filters by level, code, and userId chip removal', async ({ page }) => {
  const account = await createTestUser({ email: `e2e-logs-filt-${Date.now()}@e2e.invalid` });
  await prisma.operationalLog.create({
    data: {
      level: 'info',
      source: 'emails',
      code: 'email.delivery.sent',
      userId: account.user.id,
      metadata: { template: 'verification' },
    },
  });
  await prisma.operationalLog.create({
    data: {
      level: 'error',
      source: 'emails',
      code: 'email.delivery.failed',
      userId: account.user.id,
      metadata: { template: 'invitation', errorCode: 'forced_failure' },
    },
  });

  await signInAdmin(page);

  // Filter level=error
  await page.goto(`/dashboard/logs?userId=${account.user.id}&level=error`);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').getByText('email.delivery.failed')).toBeVisible();

  // Filter code=email.delivery.sent
  await page.goto(`/dashboard/logs?userId=${account.user.id}&code=email.delivery.sent`);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').getByText('email.delivery.sent')).toBeVisible();

  // userId shows chip with user email
  await page.goto(`/dashboard/logs?userId=${account.user.id}`);
  const chip = page.getByText(`User: ${account.user.name} (${account.email})`);
  await expect(chip).toBeVisible();

  // Removing it leaves URL without userId
  await page.getByRole('button', { name: 'Remove user filter' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has('userId')).toBe(false);
});

test('from /dashboard/users, Email logs action leads to /dashboard/logs with userId and source and displays chip', async ({ page }) => {
  const account = await createTestUser({ email: `e2e-user-action-${Date.now()}@e2e.invalid` });
  await signInAdmin(page);
  await page.goto(`/dashboard/users?q=${encodeURIComponent(account.email)}`);

  const row = page.getByRole('row').filter({ hasText: account.email });
  await row.getByRole('button', { name: 'Open menu' }).click();
  const emailLogsItem = page.getByRole('menuitem', { name: 'Email logs' });
  await expect(emailLogsItem).toBeVisible();
  await emailLogsItem.click();

  await expect(page).toHaveURL(new RegExp(`/dashboard/logs\\?userId=${account.user.id}&source=emails`));
  await expect(page.getByText(`User: ${account.user.name} (${account.email})`)).toBeVisible();
});

test('Details column displays template and errorCode, and no email addresses leaked in page other than chip and User column', async ({ page }) => {
  const account = await createTestUser({ email: `e2e-details-check-${Date.now()}@e2e.invalid` });
  await prisma.operationalLog.create({
    data: {
      level: 'error',
      source: 'emails',
      code: 'email.delivery.failed',
      userId: account.user.id,
      metadata: {
        template: 'password-reset',
        durationMs: 42,
        errorCode: 'outbox_forced_failure',
      },
    },
  });

  await signInAdmin(page);
  await page.goto(`/dashboard/logs?userId=${account.user.id}`);

  const row = page.locator('tbody tr').first();
  await expect(row.getByText('template: password-reset')).toBeVisible();
  await expect(row.getByText('errorCode: outbox_forced_failure')).toBeVisible();

  const pageText = await page.innerText('body');
  const emails = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
  const allowedEmails = new Set([
    account.email.toLowerCase(),
    ADMIN_EMAIL.toLowerCase(),
    'admin@example.com',
  ]);
  for (const email of emails) {
    expect(allowedEmails.has(email.toLowerCase())).toBe(true);
  }
});
