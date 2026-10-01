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

/**
 * Exercises finding and navigating to a user via search
 * (docs/IMPLEMENTATION_PLAN.md M17's explicit Playwright requirement) —
 * against the real API/Postgres, not mocked. Two real browser sessions
 * (unlike `notifications.spec.ts`'s API-seeded approach, Milestone 16) —
 * search has no "another user's action triggers something for me" shape to
 * seed via a direct API call; the thing being tested is the viewer's own
 * search UI against a target account that genuinely needs to exist first.
 */
test.describe('search: find and navigate to a user via search', () => {
  test('finds a user by username and navigates to their profile', async ({
    browser,
  }) => {
    const targetContext = await browser.newContext();
    const targetPage = await targetContext.newPage();
    const target = await registerThroughUi(targetPage);

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await registerThroughUi(viewerPage);

    await viewerPage.goto('/search');
    await viewerPage
      .getByPlaceholder('Search by username or name')
      .fill(target.username);

    await expect(viewerPage.getByText(`@${target.username}`)).toBeVisible();

    await viewerPage.getByText(`@${target.username}`).click();
    await viewerPage.waitForURL(`/${target.username}`);
    await expect(
      viewerPage.getByRole('heading', { name: target.username }),
    ).toBeVisible();
  });

  test('shows no results for a query matching nobody', async ({ page }) => {
    await registerThroughUi(page);

    await page.goto('/search');
    await page
      .getByPlaceholder('Search by username or name')
      .fill('zzznomatchzzznomatch');

    await expect(page.getByText('No results found.')).toBeVisible();
  });
});
