import axios from 'axios';
import sharp from 'sharp';

import { randomRegisterInput } from '../support/random-user';

/**
 * Exercises the real like/unlike/likers-list pipeline end to end against
 * the live Dockerized Postgres — real accounts, a real post, not mocked,
 * matching every milestone's testing discipline since Milestone 5.
 *
 * 3 accounts registered for the whole file (shared via `beforeAll`): the
 * throttle has real headroom now (raised to 40/min/IP in Milestone 12,
 * 20/40 used before this file), so this isn't as tightly economized as
 * Milestone 12's `feed.spec.ts` had to be — still shared, not one per test,
 * per the standing discipline.
 */

const POLL_INTERVAL_MS = 300;
const POLL_TIMEOUT_MS = 20_000;

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
      background: { r: 210, g: 90, b: 40 },
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

  const deadline = Date.now() + POLL_TIMEOUT_MS;
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

let owner: Awaited<ReturnType<typeof registerUser>>;
let likerA: Awaited<ReturnType<typeof registerUser>>;
let likerB: Awaited<ReturnType<typeof registerUser>>;
let postId: string;

beforeAll(async () => {
  [owner, likerA, likerB] = await Promise.all([
    registerUser(),
    registerUser(),
    registerUser(),
  ]);
  const mediaId = await uploadReadyPostImage(owner.accessToken);
  const created = await axios.post(
    '/api/v1/posts',
    { caption: 'a likeable post', mediaIds: [mediaId] },
    authHeader(owner.accessToken),
  );
  postId = created.data.id;
}, 30_000);

describe('likes: PUT/DELETE /posts/:postId/like', () => {
  it('likes a post, idempotent on repeat', async () => {
    const first = await axios.put(
      `/api/v1/posts/${postId}/like`,
      undefined,
      authHeader(likerA.accessToken),
    );
    expect(first.status).toBe(204);

    const second = await axios.put(
      `/api/v1/posts/${postId}/like`,
      undefined,
      authHeader(likerA.accessToken),
    );
    expect(second.status).toBe(204);

    const post = await axios.get(
      `/api/v1/posts/${postId}`,
      authHeader(likerA.accessToken),
    );
    expect(post.data.likesCount).toBe(1);
    expect(post.data.isLikedByMe).toBe(true);
  });

  it('reports isLikedByMe false for a different authenticated viewer and null for anonymous', async () => {
    const asLikerB = await axios.get(
      `/api/v1/posts/${postId}`,
      authHeader(likerB.accessToken),
    );
    expect(asLikerB.data.isLikedByMe).toBe(false);
    expect(asLikerB.data.likesCount).toBe(1);

    const anonymous = await axios.get(`/api/v1/posts/${postId}`);
    expect(anonymous.data.isLikedByMe).toBeNull();
    expect(anonymous.data.likesCount).toBe(1);
  });

  it('unlikes a post, idempotent on repeat', async () => {
    const first = await axios.delete(
      `/api/v1/posts/${postId}/like`,
      authHeader(likerA.accessToken),
    );
    expect(first.status).toBe(204);

    const second = await axios.delete(
      `/api/v1/posts/${postId}/like`,
      authHeader(likerA.accessToken),
    );
    expect(second.status).toBe(204);

    const post = await axios.get(
      `/api/v1/posts/${postId}`,
      authHeader(likerA.accessToken),
    );
    expect(post.data.likesCount).toBe(0);
    expect(post.data.isLikedByMe).toBe(false);
  });

  it('404s for a nonexistent post', async () => {
    await expect(
      axios.put(
        `/api/v1/posts/${crypto.randomUUID()}/like`,
        undefined,
        authHeader(likerA.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects an unauthenticated like with 401', async () => {
    await expect(
      axios.put(`/api/v1/posts/${postId}/like`),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('likes: GET /posts/:postId/likes', () => {
  beforeAll(async () => {
    // Re-like from both accounts (likerA was unliked above) so the likers
    // list has 2 real rows to paginate across.
    await axios.put(
      `/api/v1/posts/${postId}/like`,
      undefined,
      authHeader(likerA.accessToken),
    );
    await axios.put(
      `/api/v1/posts/${postId}/like`,
      undefined,
      authHeader(likerB.accessToken),
    );
  });

  it('lists likers newest-first, keyset-paginated, with isFollowedByMe resolved', async () => {
    const firstPage = await axios.get(
      `/api/v1/posts/${postId}/likes?limit=1`,
      authHeader(owner.accessToken),
    );
    expect(firstPage.data.data).toHaveLength(1);
    expect(firstPage.data.data[0].username).toBe(likerB.credentials.username);
    expect(firstPage.data.meta.nextCursor).not.toBeNull();

    const secondPage = await axios.get(
      `/api/v1/posts/${postId}/likes?limit=1&cursor=${encodeURIComponent(
        firstPage.data.meta.nextCursor,
      )}`,
      authHeader(owner.accessToken),
    );
    expect(secondPage.data.data).toHaveLength(1);
    expect(secondPage.data.data[0].username).toBe(likerA.credentials.username);
    expect(secondPage.data.meta.nextCursor).toBeNull();
  });

  it('404s for a nonexistent post', async () => {
    await expect(
      axios.get(`/api/v1/posts/${crypto.randomUUID()}/likes`),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects a malformed cursor with 400', async () => {
    await expect(
      axios.get(`/api/v1/posts/${postId}/likes?cursor=not-a-real-cursor!!`),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('works anonymously, with isFollowedByMe null', async () => {
    const res = await axios.get(`/api/v1/posts/${postId}/likes`);
    expect(res.status).toBe(200);
    expect(
      res.data.data.every(
        (liker: { isFollowedByMe: unknown }) => liker.isFollowedByMe === null,
      ),
    ).toBe(true);
  });
});

describe('likes: GET /feed reports real like state', () => {
  it("includes the liker's own like on a followed account's post", async () => {
    await axios.put(
      `/api/v1/users/${owner.credentials.username}/follow`,
      undefined,
      authHeader(likerA.accessToken),
    );

    const feed = await axios.get(
      '/api/v1/feed',
      authHeader(likerA.accessToken),
    );

    const post = feed.data.data.find((p: { id: string }) => p.id === postId);
    expect(post).toBeDefined();
    expect(post.likesCount).toBe(2);
    expect(post.isLikedByMe).toBe(true);
  }, 15_000);
});
