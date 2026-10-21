import { expect, test, type Page } from '@playwright/test';
import { siteConfig } from '../../config/site';
import { USER_INVITATION_PREFIX } from '../../lib/user-invitation-token';
import {
  cleanE2EData,
  createTestInvitation,
  createTestUser,
  E2E_PASSWORD,
  enableSeededAdminTwoFactor,
  prisma,
  signInWithPasswordAndTotp,
  submitPasswordSignIn,
} from './helpers';
import { getOutboxMessages, type OutboxMessage } from './helpers/outbox';

const ADMIN_EMAIL = 'admin@e2e.invalid';

test.beforeEach(async ({ page }) => {
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

async function createInvitedUserFromDashboard(page: Page, email: string) {
  await page.goto('/dashboard/users');
  await page.getByRole('button', { name: 'Add User' }).click();
  await page.getByPlaceholder('John Doe').fill('Invited E2E User');
  await page.getByPlaceholder('john@example.com').fill(email);
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(async () => (
    await getOutboxMessages(email)
  ).filter((message) => message.subject === "You're invited to RapidAuth").length).toBe(1);
}

function latestMessage(messages: OutboxMessage[]) {
  return [...messages].sort((first, second) =>
    second.sentAt.localeCompare(first.sentAt),
  )[0]!;
}

function getInvitationToken(url: string) {
  const token = new URL(url).searchParams.get('token');
  expect(token).toBeTruthy();
  return token!;
}

function getInvitationPath(token: string) {
  return `/auth/accept-invite?token=${encodeURIComponent(token)}`;
}

async function acceptInvitation(page: Page, token: string, password: string) {
  await page.goto(getInvitationPath(token));
  await page.getByPlaceholder('Create a password').fill(password);
  await page.getByPlaceholder('Confirm your password').fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page).toHaveURL(/\/auth\/login\?notice=invitation-accepted$/);
  await expect(page.getByText(
    'Invitation accepted. You can now sign in with your password.',
  )).toBeVisible();
}

test('admin-created user receives one invitation, accepts it, and signs in without a terms gate', async ({ page, browser }) => {
  const email = `e2e-invited-${Date.now()}@e2e.invalid`;
  const password = 'Invited-E2e-Password-123!';
  await signInAdmin(page);
  await createInvitedUserFromDashboard(page, email);

  const messages = (await getOutboxMessages(email)).filter(
    (message) => message.subject === "You're invited to RapidAuth",
  );
  expect(messages).toHaveLength(1);
  expect(messages[0]!.html).toContain('invited you to join RapidAuth');
  expect(messages[0]!.html).toContain('expires in 7 days');

  const invitePage = await browser.newPage();
  await acceptInvitation(invitePage, getInvitationToken(messages[0]!.url!), password);

  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    include: { accounts: true },
  });
  expect(user).toMatchObject({
    emailVerified: true,
    status: 'active',
    termsVersion: siteConfig.termsVersion,
  });
  expect(user.termsAcceptedAt).not.toBeNull();
  expect(user.accounts.some((account) => account.providerId === 'credential')).toBe(true);
  expect(await prisma.verification.count({
    where: { value: user.id, identifier: { startsWith: USER_INVITATION_PREFIX } },
  })).toBe(0);
  await expect.poll(() => prisma.activityLog.count({
    where: { userId: user.id, action: 'terms_accepted' },
  })).toBe(1);
  await expect.poll(() => prisma.activityLog.count({
    where: { userId: user.id, action: 'invitation_accepted' },
  })).toBe(1);

  await submitPasswordSignIn(invitePage, email, password);
  await expect(invitePage).toHaveURL(/\/dashboard$/);
  await expect(invitePage).not.toHaveURL(/accept-terms/);
  await invitePage.close();
});

test('used and expired invitation links do not show the password form', async ({ page }) => {
  const usedEmail = `e2e-used-invite-${Date.now()}@e2e.invalid`;
  const usedUser = await prisma.user.create({
    data: {
      name: 'Used Invitation',
      email: usedEmail,
      emailVerified: false,
      role: 'user',
      status: 'pending',
    },
  });
  const usedToken = await createTestInvitation(usedUser.id);
  const usedPath = getInvitationPath(usedToken);
  await acceptInvitation(page, usedToken, 'Used-Invite-Password-123!');

  await page.goto(usedPath);
  await expect(page.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible();
  await expect(page.getByPlaceholder('Create a password')).toHaveCount(0);

  const expiredUser = await prisma.user.create({
    data: {
      name: 'Expired Invitation',
      email: `e2e-expired-invite-${Date.now()}@e2e.invalid`,
      emailVerified: false,
      role: 'user',
      status: 'pending',
    },
  });
  const expiredToken = await createTestInvitation(expiredUser.id, {
    expiresAt: new Date(Date.now() - 60_000),
  });

  await page.goto(getInvitationPath(expiredToken));
  await expect(page.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'sign-in page' })).toHaveAttribute(
    'href',
    '/auth/login',
  );
});

test('resending an invitation invalidates the old link and is hidden for password users', async ({ page, browser }) => {
  const email = `e2e-resend-invite-${Date.now()}@e2e.invalid`;
  const passwordUser = await createTestUser();
  await signInAdmin(page);
  await createInvitedUserFromDashboard(page, email);
  const firstMessage = latestMessage(await getOutboxMessages(email));

  await page.goto(`/dashboard/users?q=${encodeURIComponent(email)}`);
  const invitedRow = page.getByRole('row').filter({ hasText: email });
  await invitedRow.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Resend Invitation' }).click();
  await expect(page.getByText(`Invitation resent to ${email}`)).toBeVisible();
  await expect.poll(async () => (
    await getOutboxMessages(email)
  ).filter((message) => message.subject === "You're invited to RapidAuth").length).toBe(2);
  const secondMessage = latestMessage(await getOutboxMessages(email));
  expect(secondMessage.url).not.toBe(firstMessage.url);

  const invitePage = await browser.newPage();
  await invitePage.goto(getInvitationPath(getInvitationToken(firstMessage.url!)));
  await expect(invitePage.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible();
  await invitePage.goto(getInvitationPath(getInvitationToken(secondMessage.url!)));
  await expect(invitePage.getByRole('heading', { name: 'Accept your invitation' })).toBeVisible();
  await invitePage.close();

  await page.goto(
    `/dashboard/users?q=${encodeURIComponent(passwordUser.email)}`,
  );
  const passwordRow = page.getByRole('row').filter({ hasText: passwordUser.email });
  await passwordRow.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Resend Invitation' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  expect(await prisma.verification.count({
    where: {
      value: (await prisma.user.findUniqueOrThrow({ where: { email } })).id,
      identifier: { startsWith: USER_INVITATION_PREFIX },
    },
  })).toBe(1);
  expect(passwordUser.password).toBe(E2E_PASSWORD);
});
