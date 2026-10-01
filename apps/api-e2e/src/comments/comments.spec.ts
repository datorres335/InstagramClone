import axios from 'axios';
import sharp from 'sharp';

import { randomRegisterInput } from '../support/random-user';

/**
 * Exercises the real create/list/delete comment pipeline end to end against
 * the live Dockerized Postgres — real accounts, a real post, not mocked,
 * matching every milestone's testing discipline since Milestone 5.
 *
 * 3 accounts registered for the whole file (shared via `beforeAll`): owner
 * (the post's author, needed for the moderation-delete case), commenterA
 * (posts comments, deletes their own), commenterB (the third-party case —
 * neither the comment's author nor the post's author, must be rejected).
 * The throttle has real headroom (40/min/IP since Milestone 12, ~23/40 used
 * before this file per docs/PROGRESS.md's Milestone 13 Next Milestone note).
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
      background: { r: 30, g: 180, b: 180 },
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
let commenterA: Awaited<ReturnType<typeof registerUser>>;
let commenterB: Awaited<ReturnType<typeof registerUser>>;
let postId: string;

beforeAll(async () => {
  [owner, commenterA, commenterB] = await Promise.all([
    registerUser(),
    registerUser(),
    registerUser(),
  ]);
  const mediaId = await uploadReadyPostImage(owner.accessToken);
  const created = await axios.post(
    '/api/v1/posts',
    { caption: 'a commentable post', mediaIds: [mediaId] },
    authHeader(owner.accessToken),
  );
  postId = created.data.id;
}, 30_000);

describe('comments: POST /posts/:postId/comments', () => {
  it('creates a comment and returns the full comment shape', async () => {
    const res = await axios.post(
      `/api/v1/posts/${postId}/comments`,
      { body: 'Great shot!' },
      authHeader(commenterA.accessToken),
    );

    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({
      body: 'Great shot!',
      author: { username: commenterA.credentials.username },
    });
    expect(res.data.id).toBeDefined();
    expect(res.data.createdAt).toBeDefined();
  });

  it('rejects an empty body with a 400 validation error', async () => {
    await expect(
      axios.post(
        `/api/v1/posts/${postId}/comments`,
        { body: '' },
        authHeader(commenterA.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('rejects a body over 2200 characters with a 400 validation error', async () => {
    await expect(
      axios.post(
        `/api/v1/posts/${postId}/comments`,
        { body: 'a'.repeat(2201) },
        authHeader(commenterA.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('404s for a nonexistent post', async () => {
    await expect(
      axios.post(
        `/api/v1/posts/${crypto.randomUUID()}/comments`,
        { body: 'Hello' },
        authHeader(commenterA.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects an unauthenticated request with 401', async () => {
    await expect(
      axios.post(`/api/v1/posts/${postId}/comments`, { body: 'Hello' }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('comments: GET /posts/:postId/comments', () => {
  let orderedCommentIds: string[];

  beforeAll(async () => {
    const bodies = ['first comment', 'second comment', 'third comment'];
    orderedCommentIds = [];
    for (const body of bodies) {
      const res = await axios.post(
        `/api/v1/posts/${postId}/comments`,
        { body },
        authHeader(commenterA.accessToken),
      );
      orderedCommentIds.push(res.data.id);
    }
  });

  it('lists comments oldest-first, keyset-paginated', async () => {
    // Earlier describe blocks already posted comments on this same post, so
    // assert relative order among this block's own three comments, not
    // absolute position in the full list.
    const allIds: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await axios.get(
        `/api/v1/posts/${postId}/comments?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      allIds.push(...page.data.data.map((c: { id: string }) => c.id));
      cursor = page.data.meta.nextCursor;
    } while (cursor);

    const positions = orderedCommentIds.map((id) => allIds.indexOf(id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((p) => p >= 0)).toBe(true);
  });

  it('404s for a nonexistent post', async () => {
    await expect(
      axios.get(`/api/v1/posts/${crypto.randomUUID()}/comments`),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects a malformed cursor with 400', async () => {
    await expect(
      axios.get(`/api/v1/posts/${postId}/comments?cursor=not-a-real-cursor!!`),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('works anonymously', async () => {
    const res = await axios.get(`/api/v1/posts/${postId}/comments`);
    expect(res.status).toBe(200);
  });
});

describe('comments: DELETE /posts/:postId/comments/:commentId', () => {
  it('lets the comment author delete their own comment', async () => {
    const created = await axios.post(
      `/api/v1/posts/${postId}/comments`,
      { body: 'to be deleted by its author' },
      authHeader(commenterA.accessToken),
    );

    const deleteRes = await axios.delete(
      `/api/v1/posts/${postId}/comments/${created.data.id}`,
      authHeader(commenterA.accessToken),
    );
    expect(deleteRes.status).toBe(204);

    const list = await axios.get(`/api/v1/posts/${postId}/comments`);
    expect(
      list.data.data.some((c: { id: string }) => c.id === created.data.id),
    ).toBe(false);
  });

  it("lets the post's author moderate-delete someone else's comment", async () => {
    const created = await axios.post(
      `/api/v1/posts/${postId}/comments`,
      { body: 'to be moderated by the post author' },
      authHeader(commenterA.accessToken),
    );

    const deleteRes = await axios.delete(
      `/api/v1/posts/${postId}/comments/${created.data.id}`,
      authHeader(owner.accessToken),
    );
    expect(deleteRes.status).toBe(204);
  });

  it('rejects a third party (neither the comment author nor the post author) with 403', async () => {
    const created = await axios.post(
      `/api/v1/posts/${postId}/comments`,
      { body: 'not deletable by a third party' },
      authHeader(commenterA.accessToken),
    );

    await expect(
      axios.delete(
        `/api/v1/posts/${postId}/comments/${created.data.id}`,
        authHeader(commenterB.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it('404s for a nonexistent comment', async () => {
    await expect(
      axios.delete(
        `/api/v1/posts/${postId}/comments/${crypto.randomUUID()}`,
        authHeader(owner.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects an unauthenticated request with 401', async () => {
    const created = await axios.post(
      `/api/v1/posts/${postId}/comments`,
      { body: 'needs auth to delete' },
      authHeader(commenterA.accessToken),
    );

    await expect(
      axios.delete(`/api/v1/posts/${postId}/comments/${created.data.id}`),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('comments: PostResponse.commentsCount reflects real data', () => {
  it('GET /posts/:id reports the real comment count', async () => {
    const mediaId = await uploadReadyPostImage(owner.accessToken);
    const created = await axios.post(
      '/api/v1/posts',
      { mediaIds: [mediaId] },
      authHeader(owner.accessToken),
    );
    const freshPostId = created.data.id;

    await axios.post(
      `/api/v1/posts/${freshPostId}/comments`,
      { body: 'one' },
      authHeader(commenterA.accessToken),
    );
    await axios.post(
      `/api/v1/posts/${freshPostId}/comments`,
      { body: 'two' },
      authHeader(commenterA.accessToken),
    );

    const post = await axios.get(`/api/v1/posts/${freshPostId}`);
    expect(post.data.commentsCount).toBe(2);
  }, 30_000);

  it("includes the real comment count on a followed account's feed post", async () => {
    await axios.put(
      `/api/v1/users/${owner.credentials.username}/follow`,
      undefined,
      authHeader(commenterB.accessToken),
    );

    const feed = await axios.get(
      '/api/v1/feed',
      authHeader(commenterB.accessToken),
    );

    const post = feed.data.data.find((p: { id: string }) => p.id === postId);
    expect(post).toBeDefined();
    expect(post.commentsCount).toBeGreaterThan(0);
  }, 15_000);
});
