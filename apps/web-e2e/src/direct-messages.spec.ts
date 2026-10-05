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
 * Exercises starting a conversation, sending a message, and seeing the
 * other participant's reply (docs/API.md §17, docs/IMPLEMENTATION_PLAN.md
 * M21) — mirrors `notifications.spec.ts`'s API-seeded-other-user pattern:
 * only the viewer (alice) gets a real browser page, bob's side of the
 * conversation is driven directly against the API.
 */
test.describe('direct messages: start a conversation, send a message, see a reply', () => {
  test('alice messages bob, bob replies, alice sees it after reloading', async ({
    page,
    request,
  }) => {
    const alice = await registerThroughUi(page);

    const bobCredentials = randomRegisterInput();
    const bobRegisterRes = await request.post(`${API_BASE_URL}/auth/register`, {
      data: bobCredentials,
    });
    expect(bobRegisterRes.ok()).toBe(true);
    const bobAccessToken = (await bobRegisterRes.json()).accessToken as string;

    await page.goto('/messages');
    // WebKit/Firefox hydration-lag race (docs/PROGRESS.md Known Issues):
    // `.fill()`'s input event can fire before React attaches `onChange`
    // right after a hard navigation, leaving the controlled input (and so
    // the submit button) stuck in its initial disabled state.
    await page.waitForTimeout(500);
    await page.getByLabel('New message to').fill(bobCredentials.username);
    await page.getByRole('button', { name: 'Chat' }).click();
    await page.waitForURL(/\/messages\/.+/);

    await expect(
      page.getByRole('heading', { name: `@${bobCredentials.username}` }),
    ).toBeVisible();

    await page.getByLabel('Message').fill('Hey Bob, welcome!');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Hey Bob, welcome!')).toBeVisible();

    // A deliberate gap before bob's reply: `Conversation.lastMessageAt`/the
    // "last message" relation query are ordered by `createdAt`, the same
    // timestamp-based ordering every list in this codebase uses (feed,
    // notifications, comments, ...) — correct in general, but measured
    // directly against this dev box: `docker compose exec postgres psql
    // -c "SELECT now();"` vs. the host clock showed ~390ms of drift
    // between the Postgres container's clock and the host/API server's,
    // consistent with Docker Desktop's documented WSL2 clock-jitter on
    // Windows. A 100ms gap wasn't enough margin and the DB-ordered
    // assertion below flaked (bob's reply landing an *earlier*
    // `created_at` than alice's message despite being sent after it,
    // confirmed by inspecting `messages` directly). Real users are never
    // this millisecond-close; 1s comfortably clears the measured drift
    // without depending on sub-tick precision between two different
    // request paths.
    await page.waitForTimeout(1_000);

    const conversationId = page.url().split('/messages/')[1];
    const replyRes = await request.post(
      `${API_BASE_URL}/conversations/${conversationId}/messages`,
      {
        data: { body: 'Thanks Alice!' },
        headers: { Authorization: `Bearer ${bobAccessToken}` },
      },
    );
    expect(replyRes.ok()).toBe(true);

    // Milestone 22 retrofit: the thread is pushed bob's reply over SSE, so
    // this no longer needs a reload to see it.
    await expect(page.getByText('Thanks Alice!')).toBeVisible();

    await page.goto('/messages');
    await expect(
      page.getByText(`@${bobCredentials.username}: Thanks Alice!`),
    ).toBeVisible();
  });

  /**
   * Milestone 22's realtime push for the inbox specifically (`ConversationsList`,
   * distinct from the thread view the test above covers): alice stays on
   * `/messages` the whole time — bob starting a brand new conversation and
   * messaging her must surface it there from the pushed `message` event
   * alone, with no reload/navigation.
   */
  test('a new conversation and message from someone else appears live in the inbox', async ({
    page,
    request,
  }) => {
    const alice = await registerThroughUi(page);
    await page.goto('/messages');
    await expect(page.getByText('No conversations yet.')).toBeVisible();

    const bobCredentials = randomRegisterInput();
    const bobRegisterRes = await request.post(`${API_BASE_URL}/auth/register`, {
      data: bobCredentials,
    });
    expect(bobRegisterRes.ok()).toBe(true);
    const bobAccessToken = (await bobRegisterRes.json()).accessToken as string;

    const startRes = await request.post(`${API_BASE_URL}/conversations`, {
      data: { username: alice.username },
      headers: { Authorization: `Bearer ${bobAccessToken}` },
    });
    expect(startRes.ok()).toBe(true);
    const conversationId = (await startRes.json()).id as string;

    const messageRes = await request.post(
      `${API_BASE_URL}/conversations/${conversationId}/messages`,
      {
        data: { body: 'hi alice, out of the blue' },
        headers: { Authorization: `Bearer ${bobAccessToken}` },
      },
    );
    expect(messageRes.ok()).toBe(true);

    await expect(
      page.getByText(`@${bobCredentials.username}: hi alice, out of the blue`),
    ).toBeVisible();
  });

  test('messaging yourself is rejected', async ({ page }) => {
    const alice = await registerThroughUi(page);

    await page.goto('/messages');
    // Same WebKit/Firefox hydration-lag race as the test above.
    await page.waitForTimeout(500);
    await page.getByLabel('New message to').fill(alice.username);
    await page.getByRole('button', { name: 'Chat' }).click();

    await expect(
      page.getByText(
        'Could not start a conversation with that user. Please check the username and try again.',
      ),
    ).toBeVisible();
  });
});
