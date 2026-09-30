import axios from 'axios';
import sharp from 'sharp';

import { randomRegisterInput } from '../support/random-user';

/**
 * Exercises the real fan-out-on-read feed query (docs/DATABASE.md §6,
 * docs/ARCHITECTURE.md risk #3) end to end against the live Dockerized
 * Postgres — a real follow graph and real posts, not mocked, matching every
 * milestone's testing discipline since Milestone 5.
 *
 * Only 2 accounts are registered for this entire file (shared via
 * `beforeAll`, reused across every test) — the shared `/auth/register`
 * throttle budget had exactly 2 requests of headroom left after Milestone 11
 * (see docs/PROGRESS.md's Known Issues), so this file was designed around
 * that ceiling rather than discovering it the way earlier milestones did.
 * The viewer's own post doubles as the "non-followed account" exclusion
 * case (docs/FEATURES.md #10's explicit "no, your own posts don't appear in
 * your own feed" default) instead of registering a third throwaway account.
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
      background: { r: 20, g: 150, b: 90 },
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

async function createPost(
  accessToken: string,
  caption: string,
): Promise<string> {
  const mediaId = await uploadReadyPostImage(accessToken);
  const res = await axios.post(
    '/api/v1/posts',
    { caption, mediaIds: [mediaId] },
    authHeader(accessToken),
  );
  return res.data.id as string;
}

let viewer: Awaited<ReturnType<typeof registerUser>>;
let author: Awaited<ReturnType<typeof registerUser>>;
// Newest first: [authorPost3, authorPost2, authorPost1].
let authorPostIds: string[];
let viewerPostId: string;

beforeAll(async () => {
  [viewer, author] = await Promise.all([registerUser(), registerUser()]);

  viewerPostId = await createPost(viewer.accessToken, 'my own post');
  const a1 = await createPost(author.accessToken, 'author post 1');
  const a2 = await createPost(author.accessToken, 'author post 2');
  const a3 = await createPost(author.accessToken, 'author post 3');
  authorPostIds = [a3, a2, a1];

  await axios.put(
    `/api/v1/users/${author.credentials.username}/follow`,
    undefined,
    authHeader(viewer.accessToken),
  );
}, 60_000);

describe('feed: GET /feed', () => {
  it("returns followed accounts' posts newest-first and excludes the viewer's own posts", async () => {
    const res = await axios.get('/api/v1/feed', authHeader(viewer.accessToken));

    expect(res.status).toBe(200);
    expect(res.data.data.map((p: { id: string }) => p.id)).toEqual(
      authorPostIds,
    );
    expect(
      res.data.data.every((p: { id: string }) => p.id !== viewerPostId),
    ).toBe(true);
    expect(res.data.data[0]).toMatchObject({
      author: { username: author.credentials.username },
      likesCount: 0,
      commentsCount: 0,
      isLikedByMe: false,
      isSavedByMe: false,
    });
  });

  it('paginates with a real keyset cursor', async () => {
    const firstPage = await axios.get(
      '/api/v1/feed?limit=2',
      authHeader(viewer.accessToken),
    );
    expect(firstPage.data.data.map((p: { id: string }) => p.id)).toEqual(
      authorPostIds.slice(0, 2),
    );
    expect(firstPage.data.meta.nextCursor).not.toBeNull();

    const secondPage = await axios.get(
      `/api/v1/feed?limit=2&cursor=${encodeURIComponent(firstPage.data.meta.nextCursor)}`,
      authHeader(viewer.accessToken),
    );
    expect(secondPage.data.data.map((p: { id: string }) => p.id)).toEqual(
      authorPostIds.slice(2),
    );
    expect(secondPage.data.meta.nextCursor).toBeNull();
  });

  it('returns an empty feed for a viewer who follows nobody', async () => {
    const res = await axios.get('/api/v1/feed', authHeader(author.accessToken));

    expect(res.data).toEqual({ data: [], meta: { nextCursor: null } });
  });

  it('rejects a malformed cursor with a 400', async () => {
    await expect(
      axios.get(
        '/api/v1/feed?cursor=not-a-real-cursor!!',
        authHeader(viewer.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('rejects an unauthenticated request with a 401', async () => {
    await expect(axios.get('/api/v1/feed')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });
});
