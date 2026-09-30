import axios from 'axios';
import sharp from 'sharp';

import { randomRegisterInput } from '../support/random-user';

/**
 * Exercises the real presign → upload → complete → BullMQ-processed →
 * attach-to-post pipeline end to end — real MinIO/Redis, nothing mocked,
 * matching the same discipline `media-pipeline.spec.ts` (Milestone 9) and
 * `follows.spec.ts` (Milestone 10) established.
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

async function fakeImage(width = 400, height = 300): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 90, g: 40, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

/** Uploads one real image and waits for it to reach `READY`, returning its `mediaId`. */
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

// Registered once for the whole file, not per test — `POST /auth/register`
// is a shared, limited budget across the entire api-e2e run (see
// `apps/api-e2e/src/users/profile.spec.ts`'s identical note).
let owner: Awaited<ReturnType<typeof registerUser>>;
let otherUser: Awaited<ReturnType<typeof registerUser>>;

beforeAll(async () => {
  [owner, otherUser] = await Promise.all([registerUser(), registerUser()]);
});

describe('posts: POST /posts', () => {
  it('creates a single-image post and returns the full post shape', async () => {
    const mediaId = await uploadReadyPostImage(owner.accessToken);

    const res = await axios.post(
      '/api/v1/posts',
      {
        caption: 'Hello world',
        location: 'San Francisco',
        mediaIds: [mediaId],
      },
      authHeader(owner.accessToken),
    );

    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({
      caption: 'Hello world',
      location: 'San Francisco',
      author: { username: owner.credentials.username },
      likesCount: 0,
      commentsCount: 0,
      isLikedByMe: false,
      isSavedByMe: false,
    });
    expect(res.data.media).toHaveLength(1);
    expect(res.data.media[0]).toMatchObject({ id: mediaId, position: 0 });
    expect(res.data.media[0].url).toMatch(/^http/);
    expect(res.data.media[0].thumbnailUrl).toMatch(/^http/);
  }, 30_000);

  it('creates a multi-image post preserving array order as carousel position', async () => {
    const [mediaA, mediaB, mediaC] = await Promise.all([
      uploadReadyPostImage(owner.accessToken),
      uploadReadyPostImage(owner.accessToken),
      uploadReadyPostImage(owner.accessToken),
    ]);

    const res = await axios.post(
      '/api/v1/posts',
      { mediaIds: [mediaB, mediaC, mediaA] },
      authHeader(owner.accessToken),
    );

    expect(res.data.media.map((m: { id: string }) => m.id)).toEqual([
      mediaB,
      mediaC,
      mediaA,
    ]);
    expect(res.data.media.map((m: { position: number }) => m.position)).toEqual(
      [0, 1, 2],
    );
  }, 30_000);

  it('rejects zero images with a 400 validation error', async () => {
    await expect(
      axios.post(
        '/api/v1/posts',
        { mediaIds: [] },
        authHeader(owner.accessToken),
      ),
    ).rejects.toMatchObject({
      response: {
        status: 400,
        data: {
          type: 'https://api.instagram-clone.dev/errors/validation-failed',
        },
      },
    });
  });

  it('rejects more than 10 images with a 400 validation error', async () => {
    const mediaIds = Array.from({ length: 11 }, () => crypto.randomUUID());
    await expect(
      axios.post('/api/v1/posts', { mediaIds }, authHeader(owner.accessToken)),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('rejects a still-PENDING media with 422 media-not-ready', async () => {
    const image = await fakeImage();
    const presignRes = await axios.post(
      '/api/v1/media/presign',
      {
        purpose: 'POST_IMAGE',
        contentType: 'image/png',
        byteSize: image.length,
      },
      authHeader(owner.accessToken),
    );

    await expect(
      axios.post(
        '/api/v1/posts',
        { mediaIds: [presignRes.data.mediaId] },
        authHeader(owner.accessToken),
      ),
    ).rejects.toMatchObject({
      response: {
        status: 422,
        data: {
          type: 'https://api.instagram-clone.dev/errors/media-not-ready',
        },
      },
    });
  });

  it('rejects an AVATAR-purpose media with 422 media-not-ready', async () => {
    const image = await fakeImage();
    const presignRes = await axios.post(
      '/api/v1/media/presign',
      { purpose: 'AVATAR', contentType: 'image/png', byteSize: image.length },
      authHeader(owner.accessToken),
    );
    const { mediaId, uploadUrl } = presignRes.data;
    await axios.put(uploadUrl, image, {
      headers: { 'Content-Type': 'image/png' },
    });
    await axios.post(
      `/api/v1/media/${mediaId}/complete`,
      undefined,
      authHeader(owner.accessToken),
    );

    await expect(
      axios.post(
        '/api/v1/posts',
        { mediaIds: [mediaId] },
        authHeader(owner.accessToken),
      ),
    ).rejects.toMatchObject({
      response: {
        status: 422,
        data: {
          type: 'https://api.instagram-clone.dev/errors/media-not-ready',
        },
      },
    });
  });

  it("rejects someone else's media with 403", async () => {
    const mediaId = await uploadReadyPostImage(otherUser.accessToken);

    await expect(
      axios.post(
        '/api/v1/posts',
        { mediaIds: [mediaId] },
        authHeader(owner.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it('rejects the same mediaId listed twice in one request with 409', async () => {
    const mediaId = await uploadReadyPostImage(owner.accessToken);

    await expect(
      axios.post(
        '/api/v1/posts',
        { mediaIds: [mediaId, mediaId] },
        authHeader(owner.accessToken),
      ),
    ).rejects.toMatchObject({
      response: {
        status: 409,
        data: { type: 'https://api.instagram-clone.dev/errors/conflict' },
      },
    });
  });

  it('rejects reusing a media that is already attached to another post with 409', async () => {
    const mediaId = await uploadReadyPostImage(owner.accessToken);
    await axios.post(
      '/api/v1/posts',
      { mediaIds: [mediaId] },
      authHeader(owner.accessToken),
    );

    await expect(
      axios.post(
        '/api/v1/posts',
        { mediaIds: [mediaId] },
        authHeader(owner.accessToken),
      ),
    ).rejects.toMatchObject({
      response: {
        status: 409,
        data: { type: 'https://api.instagram-clone.dev/errors/conflict' },
      },
    });
  });

  it('rejects an unauthenticated request with 401', async () => {
    await expect(
      axios.post('/api/v1/posts', { mediaIds: [crypto.randomUUID()] }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('posts: GET/DELETE /posts/:id', () => {
  it('fetches a post anonymously with isLikedByMe/isSavedByMe null', async () => {
    const mediaId = await uploadReadyPostImage(owner.accessToken);
    const created = await axios.post(
      '/api/v1/posts',
      { mediaIds: [mediaId] },
      authHeader(owner.accessToken),
    );

    const res = await axios.get(`/api/v1/posts/${created.data.id}`);

    expect(res.status).toBe(200);
    expect(res.data.isLikedByMe).toBeNull();
    expect(res.data.isSavedByMe).toBeNull();
  }, 30_000);

  it('404s for a nonexistent post', async () => {
    await expect(
      axios.get(`/api/v1/posts/${crypto.randomUUID()}`),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it("rejects deleting someone else's post with 403", async () => {
    const mediaId = await uploadReadyPostImage(owner.accessToken);
    const created = await axios.post(
      '/api/v1/posts',
      { mediaIds: [mediaId] },
      authHeader(owner.accessToken),
    );

    await expect(
      axios.delete(
        `/api/v1/posts/${created.data.id}`,
        authHeader(otherUser.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 403 } });
  }, 30_000);

  it('deletes (soft) the post as its author, then 404s on a subsequent fetch', async () => {
    const mediaId = await uploadReadyPostImage(owner.accessToken);
    const created = await axios.post(
      '/api/v1/posts',
      { mediaIds: [mediaId] },
      authHeader(owner.accessToken),
    );

    const deleteRes = await axios.delete(
      `/api/v1/posts/${created.data.id}`,
      authHeader(owner.accessToken),
    );
    expect(deleteRes.status).toBe(204);

    await expect(
      axios.get(`/api/v1/posts/${created.data.id}`),
    ).rejects.toMatchObject({ response: { status: 404 } });
  }, 30_000);
});

describe('posts: GET /users/:username/posts (profile grid)', () => {
  it('lists a real, keyset-paginated grid, newest first, with resolved thumbnails', async () => {
    const gridOwner = await registerUser();
    const mediaIds = await Promise.all([
      uploadReadyPostImage(gridOwner.accessToken),
      uploadReadyPostImage(gridOwner.accessToken),
      uploadReadyPostImage(gridOwner.accessToken),
    ]);
    const createdPosts = [];
    for (const mediaId of mediaIds) {
      const res = await axios.post(
        '/api/v1/posts',
        { mediaIds: [mediaId] },
        authHeader(gridOwner.accessToken),
      );
      createdPosts.push(res.data.id);
    }
    // Newest-first: the last-created post should lead the grid.
    const expectedOrder = [...createdPosts].reverse();

    const firstPage = await axios.get(
      `/api/v1/users/${gridOwner.credentials.username}/posts?limit=2`,
    );
    expect(firstPage.data.data).toHaveLength(2);
    expect(firstPage.data.data.map((p: { id: string }) => p.id)).toEqual(
      expectedOrder.slice(0, 2),
    );
    expect(firstPage.data.data[0].thumbnailUrl).toMatch(/^http/);
    expect(firstPage.data.meta.nextCursor).not.toBeNull();

    const secondPage = await axios.get(
      `/api/v1/users/${gridOwner.credentials.username}/posts?limit=2&cursor=${encodeURIComponent(
        firstPage.data.meta.nextCursor,
      )}`,
    );
    expect(secondPage.data.data.map((p: { id: string }) => p.id)).toEqual(
      expectedOrder.slice(2),
    );
    expect(secondPage.data.meta.nextCursor).toBeNull();

    const profile = await axios.get(
      `/api/v1/users/${gridOwner.credentials.username}`,
    );
    expect(profile.data.postsCount).toBe(3);
  }, 30_000);

  it('excludes a soft-deleted post from the grid', async () => {
    const gridOwner = await registerUser();
    const mediaId = await uploadReadyPostImage(gridOwner.accessToken);
    const created = await axios.post(
      '/api/v1/posts',
      { mediaIds: [mediaId] },
      authHeader(gridOwner.accessToken),
    );
    await axios.delete(
      `/api/v1/posts/${created.data.id}`,
      authHeader(gridOwner.accessToken),
    );

    const res = await axios.get(
      `/api/v1/users/${gridOwner.credentials.username}/posts`,
    );

    expect(res.data.data).toEqual([]);

    const profile = await axios.get(
      `/api/v1/users/${gridOwner.credentials.username}`,
    );
    expect(profile.data.postsCount).toBe(0);
  }, 30_000);
});
