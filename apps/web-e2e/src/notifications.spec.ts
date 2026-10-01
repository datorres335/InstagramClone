import { expect, test, type Page } from '@playwright/test';

import { randomRegisterInput } from './support/random-user';

const API_BASE_URL = 'http://localhost:3000/api/v1';

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
 * Exercises seeing a real notification on the home badge and in the
 * dedicated list (docs/IMPLEMENTATION_PLAN.md M16's explicit Playwright
 * requirement) — via API-seeded setup, not two real browser sessions: the
 * triggering action (another user following the viewer) happens through
 * direct API calls with Playwright's `request` fixture, targeting the real
 * NestJS API directly (`API_BASE_URL`, not the web app's own `baseURL`),
 * while only the viewer gets a real browser page.
 */
test.describe('notifications: see a notification after another user follows you', () => {
  test('shows the unread badge, then the notification, then clears on open', async ({
    page,
    request,
  }) => {
    const owner = await registerThroughUi(page);

    const actorCredentials = randomRegisterInput();
    const actorRegisterRes = await request.post(
      `${API_BASE_URL}/auth/register`,
      { data: actorCredentials },
    );
    expect(actorRegisterRes.ok()).toBe(true);
    const actorAccessToken = (await actorRegisterRes.json())
      .accessToken as string;

    const followRes = await request.put(
      `${API_BASE_URL}/users/${owner.username}/follow`,
      { headers: { Authorization: `Bearer ${actorAccessToken}` } },
    );
    expect(followRes.ok()).toBe(true);

    // Reload /home: the badge is seeded from a fresh server-side unread-count
    // fetch on each render, so this doesn't need to wait for the 30s poll.
    await page.goto('/home');
    await expect(page.getByText('Notifications (1)')).toBeVisible();

    await page.getByText('Notifications (1)').click();
    await page.waitForURL('/notifications');
    await expect(
      page.getByText(`@${actorCredentials.username} started following you.`),
    ).toBeVisible();

    // Opening the page marks it read server-side; reloading /home should no
    // longer show a count.
    await page.goto('/home');
    await expect(page.getByText('Notifications')).toBeVisible();
    await expect(page.getByText(/Notifications \(\d+\)/)).toHaveCount(0);
  });
});
