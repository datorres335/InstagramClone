import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

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

async function fakePng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 300,
      height: 300,
      channels: 3,
      background: { r: 20, g: 160, b: 90 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Smoke test only (docs/IMPLEMENTATION_PLAN.md M18's explicit, deliberately
 * lower-bar Playwright requirement — "the page loading with content," not a
 * full ranking journey like `search.spec.ts`'s user-finding flow). A fresh
 * stranger account creates a post through the UI so the test doesn't depend
 * on this dev database's pre-existing leftover posts, then a second, fresh
 * viewer visits `/explore` and should see real grid content load — the
 * ranking/exclusion semantics themselves are already covered thoroughly by
 * `apps/api-e2e/src/explore/explore.spec.ts`.
 */
test.describe('explore: the explore page loads with content', () => {
  test('shows grid content after a stranger creates a post', async ({
    browser,
  }) => {
    const authorContext = await browser.newContext();
    const authorPage = await authorContext.newPage();
    await registerThroughUi(authorPage);

    const image = await fakePng();
    await authorPage.goto('/posts/new');
    await authorPage.getByLabel('Photos').setInputFiles({
      name: 'explore-test.png',
      mimeType: 'image/png',
      buffer: image,
    });
    await expect(authorPage.getByText('Ready')).toBeVisible({
      timeout: 20_000,
    });
    await authorPage.getByLabel('Caption').fill('explore me please');
    await authorPage.getByRole('button', { name: 'Share' }).click();
    await authorPage.waitForURL(/\/p\/.+/);

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await registerThroughUi(viewerPage);

    await viewerPage.goto('/explore');
    await expect(
      viewerPage.getByRole('heading', { name: 'Explore' }),
    ).toBeVisible();
    await expect(viewerPage.locator('img').first()).toBeVisible();
  });
});
