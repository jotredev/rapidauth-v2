import { expect, test } from '@playwright/test';
import { cleanE2EData, createTestUser, prisma, submitPasswordSignIn } from './helpers';

test.afterEach(async () => {
  await cleanE2EData();
});

test('profile activity and sessions paginate independently on the server', async ({ page }) => {
  const { user, email, password } = await createTestUser({ email: `e2e-profile-pages-${Date.now()}@e2e.invalid` });
  const now = Date.now();
  for (let i = 0; i < 25; i++) {
    await prisma.activityLog.create({
      data: { userId: user.id, action: 'profile_update', ipAddress: `198.51.100.${i + 1}`, createdAt: new Date(now - (i + 1) * 60_000) },
    });
  }
  for (let i = 0; i < 22; i++) {
    await prisma.session.create({
      data: {
        userId: user.id,
        token: `e2e-profile-session-${crypto.randomUUID()}`,
        ipAddress: `192.0.2.${i + 1}`,
        expiresAt: new Date(now + 60 * 60 * 1000),
        createdAt: new Date(now - (i + 1) * 60_000),
      },
    });
  }

  await submitPasswordSignIn(page, email, password);
  await expect(page).toHaveURL(/\/dashboard$/);

  // Sign-in adds one login entry and one current session: 26 activity entries, 23 sessions.
  await page.goto('/dashboard/profile?tab=activity&activityPage=2');
  await expect(page.getByRole('tab', { name: 'Activity' })).toHaveAttribute('data-state', 'active');
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await expect(page.getByText(/^198\.51\.100\.\d+$/)).toHaveCount(6);

  await page.getByRole('tab', { name: 'Sessions' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('sessions');
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.getByRole('link', { name: 'Go to next page' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('sessionsPage')).toBe('2');
  expect(new URL(page.url()).searchParams.get('activityPage')).toBe('2');
  await expect(page.getByText(/^192\.0\.2\.\d+$/)).toHaveCount(3);

  await page.goto('/dashboard/profile?tab=sessions&sessionsPage=99&pageSize=abc');
  await expect.poll(() => new URL(page.url()).searchParams.get('sessionsPage')).toBe('2');
});

test('legacy tab=notifications falls back to general and notifications tab is absent', async ({ page }) => {
  const { email, password } = await createTestUser({ email: `e2e-profile-notif-${Date.now()}@e2e.invalid` });
  await submitPasswordSignIn(page, email, password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/dashboard/profile?tab=notifications');
  await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Notifications' })).toHaveCount(0);
});
