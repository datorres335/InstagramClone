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
      width: 400,
      height: 300,
      channels: 3,
      background: { r: 50, g: 120, b: 220 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Exercises the real presign → direct-`PUT`-to-MinIO → complete → poll →
 * `PATCH /me/avatar` flow through the browser UI (docs/ARCHITECTURE.md §8) —
 * against the real API/MinIO/Redis, per Milestone 9's test scope, not mocked.
 */
test.describe('profile: avatar upload', () => {
  test('uploads a photo and shows it as the avatar after processing finishes', async ({
    page,
  }) => {
    const credentials = await registerThroughUi(page);
    const image = await fakePng();

    await page.goto('/profile/edit');
    await page
      .getByLabel('Change photo')
      .setInputFiles({
        name: 'avatar.png',
        mimeType: 'image/png',
        buffer: image,
      });

    await expect(page.getByText('Photo updated.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('img', { name: 'Your avatar' })).toBeVisible();

    // Reload from scratch to prove it's persisted server-side (`PATCH
    // /me/avatar` + `GET /users/:username`), not just local upload-flow
    // state — same discipline as `profile.spec.ts`'s equivalent check.
    await page.reload();
    const avatarSrc = await page
      .getByRole('img', { name: 'Your avatar' })
      .getAttribute('src');
    expect(avatarSrc).toContain('thumbnail.webp');
  });

  test('rejects a non-image file client-side before ever calling the API', async ({
    page,
  }) => {
    await registerThroughUi(page);

    await page.goto('/profile/edit');
    await page.getByLabel('Change photo').setInputFiles({
      name: 'not-an-image.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });

    await expect(
      page.getByText('Please choose a JPEG, PNG, or WebP image.'),
    ).toBeVisible();
  });
});
