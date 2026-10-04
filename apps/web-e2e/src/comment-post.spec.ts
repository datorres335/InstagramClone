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
      background: { r: 40, g: 180, b: 90 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Exercises the real comment create/delete round trip on the post detail
 * page (docs/IMPLEMENTATION_PLAN.md M14's explicit Playwright requirement)
 * — against the real API/Postgres, not mocked.
 */
test.describe('comments: comment on a post', () => {
  test('posts a comment, sees it persist, then deletes it', async ({
    page,
  }) => {
    await registerThroughUi(page);

    const image = await fakePng();
    await page.goto('/posts/new');
    await page.getByLabel('Photos').setInputFiles({
      name: 'comment-test.png',
      mimeType: 'image/png',
      buffer: image,
    });
    await expect(page.getByText('Ready')).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Caption').fill('comment on me');
    await page.getByRole('button', { name: 'Share' }).click();
    await page.waitForURL(/\/p\/.+/);

    await expect(page.getByText('0 comments')).toBeVisible();

    await page.getByLabel('Add a comment').fill('Great shot!');
    // `exact: true` — plain `{ name: 'Post' }` substring-matches both this
    // button and the post's own "Delete post" button.
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByText('Great shot!')).toBeVisible();

    // Reload to prove it's persisted server-side, not just local state.
    await page.reload();
    // Same family of WebKit-specific settle issue documented in
    // critical-path.spec.ts — kept here even though this isn't a form
    // `fill()` case, since `toBeVisible()`'s own 5s auto-retry wasn't
    // enough on its own (confirmed via repeated local WebKit runs).
    await page.waitForTimeout(500);
    await expect(page.getByText('Great shot!')).toBeVisible();
    await expect(page.getByText('1 comments')).toBeVisible();

    // `exact: true` — same ambiguity as the "Post" button above, against
    // the post's own "Delete post" button.
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Great shot!')).toHaveCount(0);
  });
});
