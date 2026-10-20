import { expect, test } from '@playwright/test';
import {
  cleanE2EData,
  createTestSession,
  createTestUser,
  E2E_CRON_SECRET,
  prisma,
} from './helpers';

test.afterEach(async () => {
  await cleanE2EData();
});

async function createAgedUser(
  daysOld: number,
  options: { emailVerified?: boolean; role?: string; status?: string } = {},
) {
  const account = await createTestUser({
    emailVerified: options.emailVerified ?? false,
    role: options.role,
    status: options.status,
  });
  await prisma.user.update({
    where: { id: account.user.id },
    data: { createdAt: new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000) },
  });
  return account;
}

test('protected cleanup deletes only expired eligible rows and is idempotent', async ({ request }) => {
  const staleUser = await createAgedUser(8);
  const staleSession = await createTestSession(staleUser.user.id);
  const recentUser = await createAgedUser(6);
  const pendingUser = await createAgedUser(30, { status: 'pending' });
  const adminUser = await createAgedUser(30, { role: 'admin' });
  const verifiedUser = await createAgedUser(30, { emailVerified: true });

  const expiredVerification = await prisma.verification.create({
    data: {
      identifier: `e2e-expired-${crypto.randomUUID()}`,
      value: 'expired',
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  const currentVerification = await prisma.verification.create({
    data: {
      identifier: `e2e-current-${crypto.randomUUID()}`,
      value: 'current',
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const oldRateLimit = await prisma.rateLimit.create({
    data: {
      key: `e2e-old-${crypto.randomUUID()}`,
      count: 1,
      lastRequest: BigInt(Date.now() - 25 * 60 * 60 * 1000),
    },
  });
  const recentRateLimit = await prisma.rateLimit.create({
    data: {
      key: `e2e-recent-${crypto.randomUUID()}`,
      count: 1,
      lastRequest: BigInt(Date.now()),
    },
  });
  const oldOperationalLog = await prisma.operationalLog.create({
    data: {
      level: 'info',
      source: 'emails',
      code: 'email.delivery.sent',
      createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
    },
  });
  const recentOperationalLog = await prisma.operationalLog.create({
    data: {
      level: 'info',
      source: 'emails',
      code: 'email.delivery.sent',
      createdAt: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000),
    },
  });

  expect((await request.get('/api/cron/cleanup')).status()).toBe(401);
  expect(
    (
      await request.get('/api/cron/cleanup', {
        headers: { authorization: 'Bearer incorrect-secret-value' },
      })
    ).status(),
  ).toBe(401);
  expect(await prisma.user.findUnique({ where: { id: staleUser.user.id } })).not.toBeNull();
  expect(
    await prisma.verification.findUnique({ where: { id: expiredVerification.id } }),
  ).not.toBeNull();
  expect(
    await prisma.rateLimit.findUnique({ where: { id: oldRateLimit.id } }),
  ).not.toBeNull();

  const response = await request.get('/api/cron/cleanup', {
    headers: { authorization: `Bearer ${E2E_CRON_SECRET}` },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  const counts = (await response.json()) as {
    rateLimits: number;
    verifications: number;
    unverifiedUsers: number;
    operationalLogs: number;
  };
  expect(counts.rateLimits).toBeGreaterThanOrEqual(1);
  expect(counts.verifications).toBeGreaterThanOrEqual(1);
  expect(counts.unverifiedUsers).toBe(1);
  expect(counts.operationalLogs).toBeGreaterThanOrEqual(1);

  expect(await prisma.user.findUnique({ where: { id: staleUser.user.id } })).toBeNull();
  expect(await prisma.session.findUnique({ where: { id: staleSession.id } })).toBeNull();
  expect(await prisma.account.count({ where: { userId: staleUser.user.id } })).toBe(0);
  for (const account of [recentUser, pendingUser, adminUser, verifiedUser]) {
    expect(await prisma.user.findUnique({ where: { id: account.user.id } })).not.toBeNull();
  }
  expect(
    await prisma.verification.findUnique({ where: { id: expiredVerification.id } }),
  ).toBeNull();
  expect(
    await prisma.verification.findUnique({ where: { id: currentVerification.id } }),
  ).not.toBeNull();
  expect(await prisma.rateLimit.findUnique({ where: { id: oldRateLimit.id } })).toBeNull();
  expect(
    await prisma.rateLimit.findUnique({ where: { id: recentRateLimit.id } }),
  ).not.toBeNull();
  expect(
    await prisma.operationalLog.findUnique({ where: { id: oldOperationalLog.id } }),
  ).toBeNull();
  expect(
    await prisma.operationalLog.findUnique({ where: { id: recentOperationalLog.id } }),
  ).not.toBeNull();

  const secondResponse = await request.get('/api/cron/cleanup', {
    headers: { authorization: `Bearer ${E2E_CRON_SECRET}` },
  });
  expect(secondResponse.status()).toBe(200);
  expect(await secondResponse.json()).toEqual({
    rateLimits: 0,
    verifications: 0,
    unverifiedUsers: 0,
    operationalLogs: 0,
  });
});
