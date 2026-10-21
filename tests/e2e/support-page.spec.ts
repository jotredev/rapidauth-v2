import { expect, test } from '@playwright/test';

test('/support renders without session, shows support email and spam advice, and links to legal pages', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/support');
  await expect(page.getByRole('heading', { name: 'Support', exact: true })).toBeVisible();

  const mailtoLink = page.getByRole('link', { name: 'support@e2e.invalid' });
  await expect(mailtoLink).toBeVisible();
  await expect(mailtoLink).toHaveAttribute('href', 'mailto:support@e2e.invalid');

  await expect(page.getByText(/spam|junk/i)).toBeVisible();

  const footer = page.locator('footer');
  await footer.getByRole('link', { name: 'Terms of Service' }).click();
  await expect(page).toHaveURL(/\/terms$/);

  await page.goto('/support');
  await footer.getByRole('link', { name: 'Privacy Policy' }).click();
  await expect(page).toHaveURL(/\/privacy$/);

  expect(errors).toEqual([]);
});

test('auth pages link to /support', async ({ page }) => {
  const routes = [
    '/auth/login',
    '/auth/register',
    '/auth/verify-email',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/reset-password?email=dummy@e2e.invalid',
  ];

  for (const route of routes) {
    await page.goto(route);
    const supportLink = page.getByRole('link', { name: 'Contact support' });
    await expect(supportLink).toBeVisible();
    await supportLink.click();
    await expect(page).toHaveURL(/\/support$/);
  }
});
