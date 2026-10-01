import axios from 'axios';
import sharp from 'sharp';

import { randomRegisterInput } from '../support/random-user';

/**
 * Exercises the real notification pipeline end to end against the live
 * Dockerized Postgres and the real in-process BullMQ worker — real
 * accounts, real posts, not mocked. Notifications are created
 * asynchronously (docs/ARCHITECTURE.md risk #10), so every assertion that
 * depends on one existing polls `GET /notifications` for up to
 * `POLL_TIMEOUT_MS`, the same discipline `media-pipeline.spec.ts` already
 * established for its own async BullMQ job (Milestone 9).
 *
 * 2 accounts registered for the whole file (shared via `beforeAll`), the
 * same budget-conscious count every prior milestone's e2e file used.
 */

const POLL_INTERVAL_MS = 300;
const POLL_TIMEOUT_MS = 10_000;

async function registerUser() {
  const credentials = randomRegisterInput();
  const res = await axios.post('/api/v1/auth/register', credentials);
  return {
    credentials,
    accessToken: res.data.accessToken as string,
    user: res.data.user,
  };
}

function authHeader(accessToken: string) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

async function fakeImage(): Promise<Buffer> {
  return sharp({
    create: {
      width: 400,
      height: 300,
      channels: 3,
      background: { r: 160, g: 60, b: 180 },
    },
  })
    .png()
    .toBuffer();
}

async function uploadReadyPostImage(accessToken: string): Promise<string> {
  const image = await fakeImage();
  const presignRes = await axios.post(
    '/api/v1/media/presign',
    { purpose: 'POST_IMAGE', contentType: 'image/png', byteSize: image.length },
    authHeader(accessToken),
  );
  const { mediaId, uploadUrl } = presignRes.data;

  await axios.put(uploadUrl, image, {
    headers: { 'Content-Type': 'image/png' },
  });
  await axios.post(
    `/api/v1/media/${mediaId}/complete`,
    undefined,
    authHeader(accessToken),
  );

  const deadline = Date.now() + POLL_TIMEOUT_MS * 2;
  for (;;) {
    const res = await axios.get(
      `/api/v1/media/${mediaId}`,
      authHeader(accessToken),
    );
    if (res.data.status === 'READY') return mediaId;
    if (res.data.status === 'FAILED') {
      throw new Error(
        `Media ${mediaId} failed to process: ${res.data.failureReason}`,
      );
    }
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for media processing to finish.');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function createPost(accessToken: string, caption: string) {
  const mediaId = await uploadReadyPostImage(accessToken);
  const created = await axios.post(
    '/api/v1/posts',
    { caption, mediaIds: [mediaId] },
    authHeader(accessToken),
  );
  return created.data.id as string;
}

/** Polls `GET /notifications` until a notification matching `predicate` appears, or throws on timeout. */
async function waitForNotification(
  accessToken: string,
  predicate: (notification: {
    type: string;
    actorId?: string;
    actor: { id: string };
  }) => boolean,
) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const res = await axios.get(
      '/api/v1/notifications',
      authHeader(accessToken),
    );
    const found = res.data.data.find(predicate);
    if (found) return found;
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for the expected notification.');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/** Confirms a notification matching `predicate` never appears within a short window — used for self-action tests. */
async function expectNoNotification(
  accessToken: string,
  predicate: (notification: { type: string; actor: { id: string } }) => boolean,
) {
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  const res = await axios.get('/api/v1/notifications', authHeader(accessToken));
  expect(res.data.data.find(predicate)).toBeUndefined();
}

let owner: Awaited<ReturnType<typeof registerUser>>;
let actor: Awaited<ReturnType<typeof registerUser>>;

beforeAll(async () => {
  [owner, actor] = await Promise.all([registerUser(), registerUser()]);
}, 30_000);

describe('notifications: FOLLOW', () => {
  it('notifies the followed user, but never the follower themselves', async () => {
    await axios.put(
      `/api/v1/users/${owner.credentials.username}/follow`,
      undefined,
      authHeader(actor.accessToken),
    );

    const notification = await waitForNotification(
      owner.accessToken,
      (n) => n.type === 'FOLLOW' && n.actor.id === actor.user.id,
    );
    expect(notification).toBeDefined();

    await expectNoNotification(
      actor.accessToken,
      (n) => n.type === 'FOLLOW' && n.actor.id === actor.user.id,
    );

    // Clean up so later tests in this file don't depend on this follow edge.
    await axios.delete(
      `/api/v1/users/${owner.credentials.username}/follow`,
      authHeader(actor.accessToken),
    );
  }, 15_000);
});

describe('notifications: LIKE', () => {
  it('notifies the post author, but never when liking your own post', async () => {
    const postId = await createPost(owner.accessToken, 'a likeable post');

    await axios.put(
      `/api/v1/posts/${postId}/like`,
      undefined,
      authHeader(actor.accessToken),
    );
    const notification = await waitForNotification(
      owner.accessToken,
      (n) => n.type === 'LIKE' && n.actor.id === actor.user.id,
    );
    expect(notification).toBeDefined();

    await axios.put(
      `/api/v1/posts/${postId}/like`,
      undefined,
      authHeader(owner.accessToken),
    );
    await expectNoNotification(
      owner.accessToken,
      (n) => n.type === 'LIKE' && n.actor.id === owner.user.id,
    );
  }, 20_000);
});

describe('notifications: COMMENT', () => {
  it('notifies the post author, but never when commenting on your own post', async () => {
    const postId = await createPost(owner.accessToken, 'a commentable post');

    await axios.post(
      `/api/v1/posts/${postId}/comments`,
      { body: 'Nice!' },
      authHeader(actor.accessToken),
    );
    const notification = await waitForNotification(
      owner.accessToken,
      (n) => n.type === 'COMMENT' && n.actor.id === actor.user.id,
    );
    expect(notification).toBeDefined();

    await axios.post(
      `/api/v1/posts/${postId}/comments`,
      { body: 'Replying to myself' },
      authHeader(owner.accessToken),
    );
    await expectNoNotification(
      owner.accessToken,
      (n) => n.type === 'COMMENT' && n.actor.id === owner.user.id,
    );
  }, 20_000);
});

describe('notifications: GET /notifications/unread-count and POST /notifications/mark-read', () => {
  it('reflects unread notifications and clears them on mark-read', async () => {
    const postId = await createPost(owner.accessToken, 'another post');
    await axios.put(
      `/api/v1/posts/${postId}/like`,
      undefined,
      authHeader(actor.accessToken),
    );
    await waitForNotification(
      owner.accessToken,
      (n) => n.type === 'LIKE' && n.actor.id === actor.user.id,
    );

    const before = await axios.get(
      '/api/v1/notifications/unread-count',
      authHeader(owner.accessToken),
    );
    expect(before.data.count).toBeGreaterThan(0);

    const markRead = await axios.post(
      '/api/v1/notifications/mark-read',
      undefined,
      authHeader(owner.accessToken),
    );
    expect(markRead.status).toBe(204);

    const after = await axios.get(
      '/api/v1/notifications/unread-count',
      authHeader(owner.accessToken),
    );
    expect(after.data.count).toBe(0);
  }, 20_000);

  it("never leaks another user's notifications", async () => {
    // `actor` was always the triggering actor, never the recipient, in
    // every test in this file — their own notification list should
    // therefore be empty, even though `owner` has real LIKE/COMMENT/FOLLOW
    // rows generated by `actor`'s own actions.
    const res = await axios.get(
      '/api/v1/notifications',
      authHeader(actor.accessToken),
    );
    expect(res.data.data).toEqual([]);
  });
});

describe('notifications: auth and validation', () => {
  it('rejects unauthenticated requests to all three endpoints with 401', async () => {
    await expect(axios.get('/api/v1/notifications')).rejects.toMatchObject({
      response: { status: 401 },
    });
    await expect(
      axios.get('/api/v1/notifications/unread-count'),
    ).rejects.toMatchObject({ response: { status: 401 } });
    await expect(
      axios.post('/api/v1/notifications/mark-read'),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('rejects a malformed cursor with 400', async () => {
    await expect(
      axios.get('/api/v1/notifications?cursor=not-a-real-cursor!!', {
        headers: { Authorization: `Bearer ${owner.accessToken}` },
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
});
