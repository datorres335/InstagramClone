import { expect, test, type Page } from '@playwright/test';

import { randomRegisterInput } from './support/random-user';

async function registerThroughUi(page: Page) {
  const credentials = randomRegisterInput();
  await page.goto('/register');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Username').fill(credentials.username);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('/home');
  return credentials;
}

test.describe('profile: view own profile', () => {
  test('shows the empty-state profile and links to it from /home', async ({
    page,
  }) => {
    const credentials = await registerThroughUi(page);

    await page.getByRole('link', { name: 'View profile' }).click();
    await page.waitForURL(`/${credentials.username}`);

    await expect(
      page.getByRole('heading', { name: credentials.username }),
    ).toBeVisible();
    await expect(page.getByText('0 posts')).toBeVisible();
    await expect(page.getByText('0 followers')).toBeVisible();
    await expect(page.getByText('0 following')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Edit profile' }),
    ).toBeVisible();
  });
});

test.describe('profile: edit own profile', () => {
  test('edits and persists name/bio/website/isPrivate, then reflects them on the profile page', async ({
    page,
  }) => {
    const credentials = await registerThroughUi(page);

    await page.goto('/profile/edit');
    await page.getByLabel('Name').fill('Playwright Person');
    await page.getByLabel('Bio').fill('Hello from an e2e test');
    await page.getByLabel('Website').fill('https://example.com');
    await page.getByLabel('Private account').check();
    await page.getByRole('button', { name: 'Save' }).click();

    await page.waitForURL(`/${credentials.username}`);
    await expect(page.getByText('Playwright Person')).toBeVisible();
    await expect(page.getByText('Hello from an e2e test')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'https://example.com' }),
    ).toBeVisible();

    // Reload from scratch to prove the change was actually persisted server-side, not just local form state.
    await page.reload();
    await expect(page.getByText('Playwright Person')).toBeVisible();
  });

  test('pre-fills the form with the current values on a second visit', async ({
    page,
  }) => {
    await registerThroughUi(page);

    await page.goto('/profile/edit');
    await page.getByLabel('Bio').fill('First save');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL(/\/[^/]+$/);

    await page.goto('/profile/edit');
    await expect(page.getByLabel('Bio')).toHaveValue('First save');
  });

  test('redirects an unauthenticated visitor away from the edit page', async ({
    page,
  }) => {
    await page.goto('/profile/edit');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('profile: viewing another user', () => {
  test("shows another user's profile read-only, with no edit link", async ({
    page,
    browser,
  }) => {
    const otherCredentials = await registerThroughUi(page);
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL('/login');

    // A second, unauthenticated context views the first user's profile.
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await viewerPage.goto(`/${otherCredentials.username}`);

    await expect(
      viewerPage.getByRole('heading', { name: otherCredentials.username }),
    ).toBeVisible();
    await expect(
      viewerPage.getByRole('link', { name: 'Edit profile' }),
    ).toHaveCount(0);

    await viewerContext.close();
  });

  test('shows a 404 for a username that does not exist', async ({ page }) => {
    const response = await page.goto('/no-such-user-e2e-profile');
    expect(response?.status()).toBe(404);
  });
});
