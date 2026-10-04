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
      background: { r: 90, g: 60, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Exercises the real like/unlike round trip from the home feed
 * (docs/IMPLEMENTATION_PLAN.md M13's explicit Playwright requirement) —
 * against the real API/Postgres, not mocked, matching every milestone's
 * testing discipline.
 */
test.describe('likes: like a post from the feed', () => {
  test('likes and unlikes a post, reflecting the count on the feed', async ({
    browser,
  }) => {
    const authorContext = await browser.newContext();
    const authorPage = await authorContext.newPage();
    const author = await registerThroughUi(authorPage);

    const image = await fakePng();
    await authorPage.goto('/posts/new');
    await authorPage.getByLabel('Photos').setInputFiles({
      name: 'like-test.png',
      mimeType: 'image/png',
      buffer: image,
    });
    await expect(authorPage.getByText('Ready')).toBeVisible({
      timeout: 20_000,
    });
    await authorPage.getByLabel('Caption').fill('like me please');
    await authorPage.getByRole('button', { name: 'Share' }).click();
    await authorPage.waitForURL(/\/p\/.+/);

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await registerThroughUi(viewerPage);
    await viewerPage.goto(`/${author.username}`);
    await viewerPage.getByRole('button', { name: /follow/i }).click();
    // `FollowButton` fires `router.refresh()` as a fire-and-forget
    // background fetch after a successful toggle — navigating away
    // immediately can collide with that still-in-flight request. Firefox/
    // WebKit abort the collision; Chromium tolerates it (see
    // critical-path.spec.ts for the full explanation). Settle first.
    await viewerPage.waitForTimeout(500);

    await viewerPage.goto('/home');
    await expect(viewerPage.getByText('like me please')).toBeVisible();
    await expect(viewerPage.getByText('0 likes')).toBeVisible();

    await viewerPage.getByRole('button', { name: 'Like' }).click();
    await expect(
      viewerPage.getByRole('button', { name: 'Unlike' }),
    ).toBeVisible();
    await expect(viewerPage.getByText('1 likes')).toBeVisible();

    // Reload to prove it's persisted server-side, not just local button state.
    await viewerPage.reload();
    await expect(
      viewerPage.getByRole('button', { name: 'Unlike' }),
    ).toBeVisible();
    await expect(viewerPage.getByText('1 likes')).toBeVisible();

    await viewerPage.getByRole('button', { name: 'Unlike' }).click();
    await expect(
      viewerPage.getByRole('button', { name: 'Like' }),
    ).toBeVisible();
    await expect(viewerPage.getByText('0 likes')).toBeVisible();
  });
});
