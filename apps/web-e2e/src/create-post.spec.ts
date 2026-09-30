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

async function fakePng(color: {
  r: number;
  g: number;
  b: number;
}): Promise<Buffer> {
  return sharp({
    create: { width: 400, height: 300, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

/**
 * Exercises the real multi-image presign → direct-`PUT`-to-MinIO → complete →
 * poll → `POST /posts` flow through the browser UI (docs/ARCHITECTURE.md §8),
 * then confirms the created post shows up both on its own detail page and in
 * the author's profile grid — against the real API/MinIO/Redis, per
 * Milestone 11's test scope, not mocked.
 */
test.describe('posts: create with multiple images', () => {
  test('creates a post with 2 images and shows it on the profile grid', async ({
    page,
  }) => {
    const credentials = await registerThroughUi(page);
    const [imageA, imageB] = await Promise.all([
      fakePng({ r: 200, g: 50, b: 50 }),
      fakePng({ r: 50, g: 200, b: 50 }),
    ]);

    await page.goto('/posts/new');
    await page.getByLabel('Photos').setInputFiles([
      { name: 'photo-a.png', mimeType: 'image/png', buffer: imageA },
      { name: 'photo-b.png', mimeType: 'image/png', buffer: imageB },
    ]);

    await expect(page.getByText('Ready')).toHaveCount(2, { timeout: 20_000 });

    await page.getByLabel('Caption').fill('Two photos from Playwright');
    await page.getByLabel('Location').fill('Test City');
    await page.getByRole('button', { name: 'Share' }).click();

    await page.waitForURL(/\/p\/.+/);
    await expect(page.getByText('Two photos from Playwright')).toBeVisible();
    await expect(page.getByText('Test City')).toBeVisible();
    // Not `getByRole('img')` — these carousel images have no alt text
    // (`altText` is null), which gives them ARIA role "presentation", not
    // "img"; count the elements directly instead.
    await expect(page.locator('main img')).toHaveCount(2);

    await page.goto(`/${credentials.username}`);
    const gridLinks = page.locator('a[href^="/p/"]');
    await expect(gridLinks).toHaveCount(1);
    await expect(gridLinks.first().locator('img')).toBeVisible();
  });
});
