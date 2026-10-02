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

async function loginThroughUi(
  page: Page,
  credentials: { username: string; password: string },
) {
  await page.getByLabel('Email or username').fill(credentials.username);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Log in' }).click();
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
 * Milestone 20's full-critical-path suite (docs/IMPLEMENTATION_PLAN.md M20's
 * own explicit wording) — one continuous, realistic journey through every
 * feature this codebase has, chained end to end, rather than the isolated
 * per-feature smoke tests every other `apps/web-e2e` file already covers.
 * The point here isn't "does X work in isolation" (already proven
 * elsewhere) — it's "do these features actually compose for one real user
 * across a real session," which no existing file exercises.
 *
 * Three browser contexts, three distinct roles, matching the real-world
 * shape of the journey rather than forcing everything through one account:
 * `author` (registers, edits their profile, posts, later reads
 * notifications, changes their password, logs out), `follower` (follows
 * the author, then likes/comments/saves their post — three of this
 * codebase's four notification-producing actions), and `stranger` (finds
 * the author via search, then finds the author's post via explore — the
 * one role that must specifically *not* follow the author, since Explore
 * excludes posts from accounts the viewer already follows).
 *
 * `#currentPassword`/`#emailCurrentPassword` (not `getByLabel('Current
 * password')`): change-password's and change-email's own password fields
 * share that exact label text once both forms render together on
 * `/settings` (Milestone 19), which would make `getByLabel` ambiguous —
 * selecting by each form's own unique `id` instead.
 */
test.describe('critical path: one continuous journey across every feature', () => {
  test('register, log in, edit profile, upload avatar, follow, post, feed, like, comment, save, search, explore, notify, change password, log out', async ({
    browser,
  }) => {
    test.setTimeout(60_000);

    // ---- author: register, then log out and back in through the real
    // login form (not just register's own auto-login) ----
    const authorContext = await browser.newContext();
    const authorPage = await authorContext.newPage();
    const author = await registerThroughUi(authorPage);

    await authorPage.getByRole('button', { name: 'Log out' }).click();
    await authorPage.waitForURL('/login');
    await loginThroughUi(authorPage, author);
    await authorPage.waitForURL('/home');

    // ---- edit profile ----
    await authorPage.goto('/profile/edit');
    await authorPage.getByLabel('Name').fill('Critical Path Author');
    await authorPage.getByLabel('Bio').fill('Full journey, Milestone 20');
    await authorPage.getByRole('button', { name: 'Save' }).click();
    await authorPage.waitForURL(`/${author.username}`);
    await expect(authorPage.getByText('Critical Path Author')).toBeVisible();

    // ---- upload avatar ----
    await authorPage.goto('/profile/edit');
    await authorPage.getByLabel('Change photo').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: await fakePng({ r: 80, g: 80, b: 220 }),
    });
    await expect(authorPage.getByText('Photo updated.')).toBeVisible({
      timeout: 20_000,
    });

    // ---- create a post ----
    await authorPage.goto('/posts/new');
    await authorPage.getByLabel('Photos').setInputFiles({
      name: 'post.png',
      mimeType: 'image/png',
      buffer: await fakePng({ r: 220, g: 120, b: 40 }),
    });
    await expect(authorPage.getByText('Ready')).toBeVisible({
      timeout: 20_000,
    });
    await authorPage.getByLabel('Caption').fill('My critical-path post');
    await authorPage.getByRole('button', { name: 'Share' }).click();
    await authorPage.waitForURL(/\/p\/.+/);
    const postUrl = authorPage.url();

    // ---- follower: register, follow the author ----
    const followerContext = await browser.newContext();
    const followerPage = await followerContext.newPage();
    const follower = await registerThroughUi(followerPage);

    await followerPage.goto(`/${author.username}`);
    await followerPage.getByRole('button', { name: 'Follow' }).click();
    await expect(
      followerPage.getByRole('button', { name: 'Unfollow' }),
    ).toBeVisible();

    // ---- appear in follower's feed ----
    await followerPage.goto('/home');
    await expect(followerPage.getByText('My critical-path post')).toBeVisible();

    // ---- like, from the feed ----
    await followerPage.getByRole('button', { name: 'Like' }).click();
    await expect(
      followerPage.getByRole('button', { name: 'Unlike' }),
    ).toBeVisible();

    // ---- comment, from the post detail page ----
    await followerPage.goto(postUrl);
    await followerPage.getByLabel('Add a comment').fill('Nice post!');
    await followerPage
      .getByRole('button', { name: 'Post', exact: true })
      .click();
    await expect(followerPage.getByText('Nice post!')).toBeVisible();

    // ---- save, from the post detail page ----
    await followerPage.getByRole('button', { name: 'Save' }).click();
    await expect(
      followerPage.getByRole('button', { name: 'Unsave' }),
    ).toBeVisible();

    // ---- stranger: find the author via search, then via explore ----
    // (deliberately never follows the author — Explore excludes posts from
    // accounts the viewer already follows, so `follower`'s own explore
    // page would never show this post.)
    const strangerContext = await browser.newContext();
    const strangerPage = await strangerContext.newPage();
    await registerThroughUi(strangerPage);

    await strangerPage.goto('/search');
    await strangerPage
      .getByPlaceholder('Search by username or name')
      .fill(author.username);
    await expect(strangerPage.getByText(`@${author.username}`)).toBeVisible();
    await strangerPage.getByText(`@${author.username}`).click();
    await strangerPage.waitForURL(`/${author.username}`);

    await strangerPage.goto('/explore');
    await expect(
      strangerPage.getByRole('heading', { name: 'Explore' }),
    ).toBeVisible();
    await expect(strangerPage.locator('img').first()).toBeVisible();

    // ---- author: receive and read the notifications follower's follow/
    // like/comment actions produced ----
    await authorPage.goto('/home');
    await expect(authorPage.getByText(/Notifications \(\d+\)/)).toBeVisible();
    await authorPage.getByText(/Notifications \(\d+\)/).click();
    await authorPage.waitForURL('/notifications');
    await expect(
      authorPage.getByText(`@${follower.username} started following you.`),
    ).toBeVisible();
    await expect(
      authorPage.getByText(`@${follower.username} liked your post.`),
    ).toBeVisible();
    await expect(
      authorPage.getByText(`@${follower.username} commented: "Nice post!"`),
    ).toBeVisible();
    // Opening the screen marks everything read (docs/FEATURES.md #16).
    await authorPage.goto('/home');
    await expect(authorPage.getByText(/Notifications \(\d+\)/)).toHaveCount(0);

    // ---- change password ----
    await authorPage.goto('/settings');
    await authorPage.locator('#currentPassword').fill(author.password);
    await authorPage.locator('#newPassword').fill('NewPassword456!');
    await authorPage.getByRole('button', { name: 'Change password' }).click();
    await expect(authorPage.getByText('Password changed.')).toBeVisible();

    // ---- log out ----
    await authorPage.goto('/home');
    await authorPage.getByRole('button', { name: 'Log out' }).click();
    await authorPage.waitForURL('/login');

    // The old password is genuinely gone, and the new one genuinely works
    // — the same thing `apps/api-e2e/src/account-settings/account-settings
    // .spec.ts` already proves at the API level, exercised here through the
    // real browser session cookie end to end.
    await loginThroughUi(authorPage, author);
    await expect(authorPage.getByRole('alert')).toBeVisible();
    await expect(authorPage).toHaveURL('/login');

    // A fresh page load before retrying — not just a convenience. Found
    // during this test's own development: resubmitting `LoginForm` a
    // second time on the same, never-reloaded page never navigates even on
    // a genuinely correct retry, a reproducible Next.js App Router/
    // `useActionState` interaction independent of this codebase's own code
    // (confirmed with a minimal repro, independent of `redirect()` vs a
    // client-side `router.push`/`window.location` redirect, and independent
    // of dev vs. production builds) — see docs/PROGRESS.md Milestone 20's
    // Known Issues entry. A reload between attempts is both the reliable
    // workaround and a realistic thing a real stuck user would do anyway.
    await authorPage.reload();
    await loginThroughUi(authorPage, {
      ...author,
      password: 'NewPassword456!',
    });
    await authorPage.waitForURL('/home');
  });
});
