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

async function loginThroughUi(
  page: Page,
  credentials: { username: string; password: string },
) {
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(credentials.username);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('/home');
}

// `viewer` is registered once for the whole file and re-logged-in per test
// (a separate, unshared throttle from `/auth/register` — docs/API.md §1) —
// `target`/`otherFollower` still need fresh registrations per test, since
// each test's assertions depend on that account starting with zero
// followers. Keeps this file's own `/auth/register` budget to 4 calls total
// instead of 6+, consistent with the "register the minimum a file's tests
// actually need" discipline established for `apps/api-e2e` (docs/PROGRESS.md
// Milestone 8, bug #20).
let viewer: Awaited<ReturnType<typeof registerThroughUi>>;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  viewer = await registerThroughUi(page);
  await context.close();
});

test.describe('follows: follow/unfollow from a profile', () => {
  test('follows, sees the count and button update, then unfollows and it reverts', async ({
    page,
    browser,
  }) => {
    const targetContext = await browser.newContext();
    const targetPage = await targetContext.newPage();
    const target = await registerThroughUi(targetPage);
    await targetContext.close();

    await loginThroughUi(page, viewer);
    await page.goto(`/${target.username}`);
    await expect(page.getByText('0 followers')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Follow' })).toBeVisible();

    await page.getByRole('button', { name: 'Follow' }).click();
    await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible();
    await expect(page.getByText('1 followers')).toBeVisible();

    // Reload from scratch to prove it's persisted server-side.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible();
    await expect(page.getByText('1 followers')).toBeVisible();

    await page.getByRole('button', { name: 'Unfollow' }).click();
    await expect(page.getByRole('button', { name: 'Follow' })).toBeVisible();
    await expect(page.getByText('0 followers')).toBeVisible();
  });

  test('shows no follow button on your own profile, only an Edit profile link', async ({
    page,
  }) => {
    await loginThroughUi(page, viewer);

    await page.goto(`/${viewer.username}`);

    await expect(
      page.getByRole('link', { name: 'Edit profile' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Follow' })).toHaveCount(0);
  });

  test('shows the followers list with a working inline follow/unfollow button', async ({
    page,
    browser,
  }) => {
    // `target`'s followers list will contain both `viewer` and
    // `otherFollower` — `viewer` also follows `otherFollower`, so that
    // row's inline button reflects a real viewer-to-row relationship rather
    // than the row being `viewer`'s own entry (which would always show
    // "Follow", since isFollowedByMe on your own row is a self-check that's
    // never true — see docs/PROGRESS.md's Milestone 10 known-issues note).
    const targetContext = await browser.newContext();
    const targetPage = await targetContext.newPage();
    const target = await registerThroughUi(targetPage);
    await targetContext.close();

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    const otherFollower = await registerThroughUi(otherPage);
    await otherPage.goto(`/${target.username}`);
    await otherPage.getByRole('button', { name: 'Follow' }).click();
    await expect(
      otherPage.getByRole('button', { name: 'Unfollow' }),
    ).toBeVisible();
    await otherContext.close();

    await loginThroughUi(page, viewer);
    await page.goto(`/${target.username}`);
    await page.getByRole('button', { name: 'Follow' }).click();
    await page.goto(`/${otherFollower.username}`);
    await page.getByRole('button', { name: 'Follow' }).click();
    await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible();

    await page.goto(`/${target.username}/followers`);
    const row = page.getByText(`@${otherFollower.username}`).locator('..');
    await expect(row.getByRole('button', { name: 'Unfollow' })).toBeVisible();
  });
});
