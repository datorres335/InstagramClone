import axios from 'axios';
import sharp from 'sharp';

import { randomRegisterInput } from '../support/random-user';

/**
 * Exercises the real save/unsave/`GET /me/saved` pipeline end to end against
 * the live Dockerized Postgres — real accounts, real posts, not mocked,
 * matching every milestone's testing discipline since Milestone 5.
 *
 * 3 accounts registered for the whole file (shared via `beforeAll`), the
 * same budget-conscious count `likes.spec.ts`/`comments.spec.ts` used.
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
      background: { r: 40, g: 120, b: 200 },
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

async function createPost(accessToken: string, caption: string) {
  const mediaId = await uploadReadyPostImage(accessToken);
  const created = await axios.post(
    '/api/v1/posts',
    { caption, mediaIds: [mediaId] },
    authHeader(accessToken),
  );
  return created.data.id as string;
}

let owner: Awaited<ReturnType<typeof registerUser>>;
let saver: Awaited<ReturnType<typeof registerUser>>;
let otherUser: Awaited<ReturnType<typeof registerUser>>;
let postIdA: string;
let postIdB: string;

beforeAll(async () => {
  [owner, saver, otherUser] = await Promise.all([
    registerUser(),
    registerUser(),
    registerUser(),
  ]);
  [postIdA, postIdB] = await Promise.all([
    createPost(owner.accessToken, 'a savable post'),
    createPost(owner.accessToken, 'another savable post'),
  ]);
}, 30_000);

describe('saved posts: PUT/DELETE /posts/:postId/save', () => {
  it('saves a post, idempotent on repeat', async () => {
    const first = await axios.put(
      `/api/v1/posts/${postIdA}/save`,
      undefined,
      authHeader(saver.accessToken),
    );
    expect(first.status).toBe(204);

    const second = await axios.put(
      `/api/v1/posts/${postIdA}/save`,
      undefined,
      authHeader(saver.accessToken),
    );
    expect(second.status).toBe(204);

    const post = await axios.get(
      `/api/v1/posts/${postIdA}`,
      authHeader(saver.accessToken),
    );
    expect(post.data.isSavedByMe).toBe(true);
  });

  it('reports isSavedByMe false for a different authenticated viewer and null for anonymous', async () => {
    const asOtherUser = await axios.get(
      `/api/v1/posts/${postIdA}`,
      authHeader(otherUser.accessToken),
    );
    expect(asOtherUser.data.isSavedByMe).toBe(false);

    const anonymous = await axios.get(`/api/v1/posts/${postIdA}`);
    expect(anonymous.data.isSavedByMe).toBeNull();
  });

  it('unsaves a post, idempotent on repeat', async () => {
    const first = await axios.delete(
      `/api/v1/posts/${postIdA}/save`,
      authHeader(saver.accessToken),
    );
    expect(first.status).toBe(204);

    const second = await axios.delete(
      `/api/v1/posts/${postIdA}/save`,
      authHeader(saver.accessToken),
    );
    expect(second.status).toBe(204);

    const post = await axios.get(
      `/api/v1/posts/${postIdA}`,
      authHeader(saver.accessToken),
    );
    expect(post.data.isSavedByMe).toBe(false);
  });

  it('404s for a nonexistent post', async () => {
    await expect(
      axios.put(
        `/api/v1/posts/${crypto.randomUUID()}/save`,
        undefined,
        authHeader(saver.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects an unauthenticated save with 401', async () => {
    await expect(
      axios.put(`/api/v1/posts/${postIdA}/save`),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('saved posts: GET /me/saved', () => {
  beforeAll(async () => {
    // Re-save postIdA (unsaved above) and save postIdB, so the saved list
    // has 2 real rows to paginate across, newest-save-first.
    await axios.put(
      `/api/v1/posts/${postIdA}/save`,
      undefined,
      authHeader(saver.accessToken),
    );
    await axios.put(
      `/api/v1/posts/${postIdB}/save`,
      undefined,
      authHeader(saver.accessToken),
    );
  });

  it("lists only the caller's own saved posts, newest-saved-first, keyset-paginated", async () => {
    const firstPage = await axios.get(
      '/api/v1/me/saved?limit=1',
      authHeader(saver.accessToken),
    );
    expect(firstPage.data.data).toHaveLength(1);
    expect(firstPage.data.data[0].id).toBe(postIdB);
    expect(firstPage.data.data[0].isSavedByMe).toBe(true);
    expect(firstPage.data.meta.nextCursor).not.toBeNull();

    const secondPage = await axios.get(
      `/api/v1/me/saved?limit=1&cursor=${encodeURIComponent(
        firstPage.data.meta.nextCursor,
      )}`,
      authHeader(saver.accessToken),
    );
    expect(secondPage.data.data).toHaveLength(1);
    expect(secondPage.data.data[0].id).toBe(postIdA);
    expect(secondPage.data.meta.nextCursor).toBeNull();
  });

  it("never leaks another user's saved posts", async () => {
    const res = await axios.get(
      '/api/v1/me/saved',
      authHeader(otherUser.accessToken),
    );
    expect(res.data.data).toEqual([]);
  });

  it('rejects an unauthenticated request with 401', async () => {
    await expect(axios.get('/api/v1/me/saved')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it('rejects a malformed cursor with 400', async () => {
    await expect(
      axios.get('/api/v1/me/saved?cursor=not-a-real-cursor!!', {
        headers: { Authorization: `Bearer ${saver.accessToken}` },
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
});
