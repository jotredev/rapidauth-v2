import { expect, test, type Page } from '@playwright/test';
import {
  buildUsersWhere,
  getDisplayedAuthProvider,
  parseUserListSearchParams,
} from '../../lib/user-list-query';
import {
  cleanE2EData,
  createTestUser,
  createTestUsers,
  enableSeededAdminTwoFactor,
  prisma,
  signInWithPasswordAndTotp,
  submitPasswordSignIn,
} from './helpers';

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

async function expectEmails(page: Page, expectedEmails: string[]) {
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(expectedEmails.length);
  for (const email of expectedEmails) {
    await expect(page.getByRole('row').filter({ hasText: email })).toBeVisible();
  }
}

test('search paginates on the server, preserves filters, redirects invalid pages, and clears selection', async ({ page }) => {
  const prefix = `e2e-pagination-${Date.now()}`;
  await createTestUsers(
    Array.from({ length: 23 }, (_, index) => ({
      name: `Pagination User ${index + 1}`,
      email: `${prefix}-${String(index + 1).padStart(2, '0')}@e2e.invalid`,
    })),
  );
  await signInAdmin(page);
  await page.goto('/dashboard/users');
  await page.getByPlaceholder('Search by name or email...').fill(prefix);

  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(prefix);
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await expect(page.getByText('Showing 1–20 of 23 users')).toBeVisible();
  await expect(page.getByText('Page 1 of 2')).toBeVisible();

  await page.locator('thead [role="checkbox"]').click();
  await expect(page.getByText('20 selected')).toBeVisible();
  await page.getByRole('link', { name: 'Go to next page' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.getByText('Showing 21–23 of 23 users')).toBeVisible();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await expect(page.getByText('20 selected')).toHaveCount(0);

  await page.goto(`/dashboard/users?page=999&q=${encodeURIComponent(prefix)}`);
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(prefix);
  await expect(page.getByText('Showing 21–23 of 23 users')).toBeVisible();

  await page.goto(
    `/dashboard/users?page=abc&q=${encodeURIComponent(prefix)}&role=invented`,
  );
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await expect(page.getByText('Showing 1–20 of 23 users')).toBeVisible();

  await page.goto('/dashboard/users?page=999&q=e2e-pagination-no-results');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');
  await expect(page.getByText('Showing 0 of 0 users')).toBeVisible();
});

test('status, role, and provider filters match the displayed values exactly', async ({ page }) => {
  const prefix = `e2e-pagination-filters-${Date.now()}`;
  const users = {
    unverifiedActive: `${prefix}-unverified-active@e2e.invalid`,
    verifiedPending: `${prefix}-verified-pending@e2e.invalid`,
    googleAndGithub: `${prefix}-google-github@e2e.invalid`,
    githubOnly: `${prefix}-github@e2e.invalid`,
    emailOnly: `${prefix}-email@e2e.invalid`,
  };

  await createTestUsers([
    {
      email: users.unverifiedActive,
      role: 'user',
      status: 'active',
      emailVerified: false,
    },
    {
      email: users.verifiedPending,
      role: 'moderator',
      status: 'pending',
      providers: ['credential', 'google'],
    },
    {
      email: users.googleAndGithub,
      role: 'admin',
      providers: ['credential', 'github', 'google'],
    },
    {
      email: users.githubOnly,
      role: 'user',
      status: 'inactive',
      providers: ['credential', 'github'],
    },
    {
      email: users.emailOnly,
      role: 'moderator',
    },
  ]);
  await signInAdmin(page);

  const openFiltered = async (filter: string) => {
    await page.goto(
      `/dashboard/users?q=${encodeURIComponent(prefix)}&${filter}`,
    );
  };

  await openFiltered('status=pending');
  await expectEmails(page, [users.unverifiedActive, users.verifiedPending]);
  await expect(
    page.getByRole('row').filter({ hasText: users.unverifiedActive }).getByText('Pending'),
  ).toBeVisible();

  await openFiltered('status=active');
  await expectEmails(page, [users.googleAndGithub, users.emailOnly]);

  await openFiltered('status=inactive');
  await expectEmails(page, [users.githubOnly]);

  await openFiltered('provider=google');
  await expectEmails(page, [users.verifiedPending, users.googleAndGithub]);
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: users.googleAndGithub })
      .locator('[title="Signed in with Google"]'),
  ).toBeVisible();

  await openFiltered('provider=github');
  await expectEmails(page, [users.githubOnly]);

  await openFiltered('provider=email');
  await expectEmails(page, [users.unverifiedActive, users.emailOnly]);

  await openFiltered('role=admin');
  await expectEmails(page, [users.googleAndGithub]);

  await openFiltered('role=user&role=moderator');
  await expectEmails(page, [
    users.unverifiedActive,
    users.verifiedPending,
    users.githubOnly,
    users.emailOnly,
  ]);
});

test('a non-admin with a page parameter is redirected as before', async ({ page }) => {
  const account = await createTestUser();
  await submitPasswordSignIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/dashboard/users?page=2');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('search keeps its focus and complete text across debounced URL updates', async ({ page }) => {
  await signInAdmin(page);
  await page.goto('/dashboard/users');
  const searchInput = page.getByPlaceholder('Search by name or email...');

  await searchInput.pressSequentially('e2e-probe');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('e2e-probe');
  await expect(page.getByText('Showing 0 of 0 users')).toBeVisible();
  await expect(searchInput).toBeFocused();

  await searchInput.pressSequentially('-continued');
  await expect(searchInput).toHaveValue('e2e-probe-continued');
  await expect(searchInput).toBeFocused();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(
    'e2e-probe-continued',
  );
});

test('changing search or filters clears the current selection', async ({ page }) => {
  const prefix = `e2e-selection-${Date.now()}`;
  await createTestUsers([
    { email: `${prefix}-first@e2e.invalid` },
    { email: `${prefix}-second@e2e.invalid` },
  ]);
  await signInAdmin(page);
  await page.goto(`/dashboard/users?q=${encodeURIComponent(prefix)}`);
  const searchInput = page.getByPlaceholder('Search by name or email...');

  await page.locator('thead [role="checkbox"]').click();
  await expect(page.getByText('2 selected')).toBeVisible();
  await searchInput.fill(`${prefix}-first`);
  await expect(page.getByText('2 selected')).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(
    `${prefix}-first`,
  );

  await searchInput.fill(prefix);
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(prefix);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.locator('thead [role="checkbox"]').click();
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('button', { name: 'user', exact: true }).click();
  await expect(page.getByText('2 selected')).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('role')).toBe('user');
});

test('the Users sidebar link clears search state from the input and URL', async ({ page }) => {
  await signInAdmin(page);
  await page.goto('/dashboard/users?q=e2e-sidebar-search');
  const searchInput = page.getByPlaceholder('Search by name or email...');
  await expect(searchInput).toHaveValue('e2e-sidebar-search');

  await page.locator('aside').getByRole('link', { name: 'Users', exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard\/users(?:\?page=1)?$/);
  await expect(searchInput).toHaveValue('');
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);
});

test('a row action preserves the current search and page', async ({ page }) => {
  const prefix = `e2e-action-page-${Date.now()}`;
  await createTestUsers(
    Array.from({ length: 21 }, (_, index) => ({
      email: `${prefix}-${String(index + 1).padStart(2, '0')}@e2e.invalid`,
    })),
  );
  await signInAdmin(page);
  await page.goto(`/dashboard/users?page=2&q=${encodeURIComponent(prefix)}`);
  await expect(page.getByText('Page 2 of 2')).toBeVisible();

  const row = page.locator('tbody tr').first();
  await row.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: 'Deactivate' }).click();
  await page.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(row.getByText('Inactive')).toBeVisible();

  const url = new URL(page.url());
  expect(url.searchParams.get('page')).toBe('2');
  expect(url.searchParams.get('q')).toBe(prefix);
});

test('query parsing and where translation ignore invalid values and encode display precedence', () => {
  const params = parseUserListSearchParams({
    page: 'invalid',
    q: `  ${'a'.repeat(120)}  `,
    role: ['admin', 'invented'],
    status: ['pending', 'active', 'invented'],
    provider: ['google', 'github', 'invented'],
  });

  expect(params).toEqual({
    page: 1,
    pageSize: 20,
    q: 'a'.repeat(100),
    roles: ['admin'],
    statuses: ['pending', 'active'],
    providers: ['google', 'github'],
  });
  expect(buildUsersWhere(params)).toEqual({
    AND: [
      {
        OR: [
          { name: { contains: 'a'.repeat(100), mode: 'insensitive' } },
          { email: { contains: 'a'.repeat(100), mode: 'insensitive' } },
        ],
      },
      { role: { in: ['admin'] } },
      {
        OR: [
          { OR: [{ emailVerified: false }, { status: 'pending' }] },
          { emailVerified: true, status: 'active' },
        ],
      },
      {
        OR: [
          { accounts: { some: { providerId: 'google' } } },
          {
            AND: [
              { accounts: { none: { providerId: 'google' } } },
              { accounts: { some: { providerId: 'github' } } },
            ],
          },
        ],
      },
    ],
  });
  expect(getDisplayedAuthProvider(['github', 'google'])).toBe('google');
  expect(getDisplayedAuthProvider(['github'])).toBe('github');
  expect(getDisplayedAuthProvider(['credential'])).toBe('email');
});

test('rows per page changes the page size on the server and invalid sizes fall back to 20', async ({ page }) => {
  const prefix = `e2e-page-size-${Date.now()}`;
  await createTestUsers(
    Array.from({ length: 55 }, (_, index) => ({
      name: `Page Size User ${index + 1}`,
      email: `${prefix}-${String(index + 1).padStart(2, '0')}@e2e.invalid`,
    })),
  );
  await signInAdmin(page);
  await page.goto(`/dashboard/users?q=${encodeURIComponent(prefix)}`);
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await expect(page.getByText('Page 1 of 3')).toBeVisible();

  await page.getByRole('combobox', { name: 'Rows per page' }).click();
  await page.getByRole('option', { name: '50' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('pageSize')).toBe('50');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');
  await expect(page.locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText('Showing 1–50 of 55 users')).toBeVisible();
  await expect(page.getByText('Page 1 of 2')).toBeVisible();

  await page.getByRole('link', { name: 'Go to last page' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  expect(new URL(page.url()).searchParams.get('q')).toBe(prefix);

  await page.goto(`/dashboard/users?q=${encodeURIComponent(prefix)}&pageSize=7`);
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await expect(page.getByText('Page 1 of 3')).toBeVisible();
});

test('columns can be hidden, stay hidden after reload, and required columns cannot be hidden', async ({ page }) => {
  await signInAdmin(page);
  await page.goto('/dashboard/users');
  const header = page.locator('thead');
  await expect(header.getByText('Last Active', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^Columns/ }).click();
  await expect(page.getByRole('menuitemcheckbox', { name: 'User' })).toBeDisabled();
  await page.getByRole('menuitemcheckbox', { name: 'Last Active' }).click();
  await page.keyboard.press('Escape');

  await expect(header.getByText('Last Active', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Columns/ })).toContainText('4/5');

  await page.reload();
  await expect(header.getByText('Last Active', { exact: true })).toHaveCount(0);
  await expect(header.getByText('Role', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^Columns/ }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Last Active' }).click();
  await page.keyboard.press('Escape');
  await expect(header.getByText('Last Active', { exact: true })).toBeVisible();
});

