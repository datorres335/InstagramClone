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
      background: { r: 200, g: 140, b: 20 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Exercises the real save/unsave round trip from the post detail page and
 * the dedicated `/saved` list (docs/IMPLEMENTATION_PLAN.md M15's explicit
 * Playwright requirement) — against the real API/Postgres, not mocked. A
 * single account, mirroring `comment-post.spec.ts`'s pattern: saving your
 * own post is allowed, and there's no "other viewer" dimension to saves the
 * way likes/follows need (saves are private to the saver).
 */
test.describe('saved posts: save a post and find it in the saved list', () => {
  test('saves a post, sees it in /saved, then unsaves it', async ({ page }) => {
    await registerThroughUi(page);

    const image = await fakePng();
    await page.goto('/posts/new');
    await page.getByLabel('Photos').setInputFiles({
      name: 'save-test.png',
      mimeType: 'image/png',
      buffer: image,
    });
    await expect(page.getByText('Ready')).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Caption').fill('save me for later');
    await page.getByRole('button', { name: 'Share' }).click();
    await page.waitForURL(/\/p\/.+/);

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Unsave' })).toBeVisible();

    await page.goto('/saved');
    await expect(page.getByText('save me for later')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unsave' })).toBeVisible();

    // Reload to prove it's persisted server-side, not just local button state.
    await page.reload();
    await expect(page.getByText('save me for later')).toBeVisible();

    await page.getByRole('button', { name: 'Unsave' }).click();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();

    // Reload /saved: the unsaved post should no longer be in the list
    // (SavedPostsList doesn't remove it locally on unsave, so this is the
    // real assertion that the server-side state actually changed).
    await page.reload();
    await expect(page.getByText('save me for later')).toHaveCount(0);
  });
});
