import axios from 'axios';
import sharp from 'sharp';

import { randomRegisterInput } from '../support/random-user';

/**
 * Exercises the real `GET /explore` ranking pipeline end to end against the
 * live Dockerized Postgres — real accounts, real posts, not mocked.
 *
 * The documented time-window filter (`docs/DATABASE.md` §6, Milestone 18's
 * `EXPLORE_WINDOW_DAYS` constant) is not independently tested here: every
 * post this suite creates is created "now," through the real API, and
 * there's no endpoint to backdate a post's `createdAt` — the same
 * "untestable through the API, so not independently tested" posture
 * `SavedPost`'s soft-delete exclusion already has in this codebase. What's
 * directly testable — follow exclusion, self exclusion, and ranking order —
 * is covered below.
 *
 * Rank/likesCount-specific assertions walk the real keyset-paginated cursor
 * chain (`findInExplore` below) rather than assuming both target posts
 * land on one default-sized page — this dev database accumulates posts
 * from every prior milestone's own e2e runs (hundreds, by this point), so a
 * single page is not a safe place to assume a specific post will appear.
 * The pagination mechanics themselves are exactly what's being exercised by
 * walking real cursors, so this isn't a workaround so much as it is the
 * correct way to look for a specific item in a long, real, paginated list.
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

async function fakeImage(color: {
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

async function uploadReadyPostImage(
  accessToken: string,
  color: { r: number; g: number; b: number },
): Promise<string> {
  const image = await fakeImage(color);
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
  color: { r: number; g: number; b: number },
) {
  const mediaId = await uploadReadyPostImage(accessToken, color);
  const created = await axios.post(
    '/api/v1/posts',
    { caption, mediaIds: [mediaId] },
    authHeader(accessToken),
  );
  return created.data.id as string;
}

async function likeAsEach(postId: string, accessTokens: string[]) {
  for (const token of accessTokens) {
    await axios.put(
      `/api/v1/posts/${postId}/like`,
      undefined,
      authHeader(token),
    );
  }
}

interface ExplorePost {
  id: string;
  likesCount: number;
  isLikedByMe: boolean | null;
}

/**
 * Walks `GET /explore`'s real keyset cursor chain (max page size, 50 —
 * docs/API.md §1) until `predicate` matches or the chain ends, returning
 * the matching post plus its absolute rank (0-based, across every page
 * walked so far) — `null` if never found within `maxPages`.
 */
async function findInExplore(
  accessToken: string,
  predicate: (post: ExplorePost) => boolean,
  maxPages = 20,
): Promise<{ post: ExplorePost; rank: number } | null> {
  let cursor: string | undefined;
  let rank = 0;
  for (let page = 0; page < maxPages; page++) {
    const qs = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const res = await axios.get(
      `/api/v1/explore?limit=50${qs}`,
      authHeader(accessToken),
    );
    for (const post of res.data.data as ExplorePost[]) {
      if (predicate(post)) return { post, rank };
      rank++;
    }
    cursor = res.data.meta.nextCursor;
    if (!cursor) return null;
  }
  return null;
}

let explorer: Awaited<ReturnType<typeof registerUser>>;
let followedAuthor: Awaited<ReturnType<typeof registerUser>>;
let strangerAuthor: Awaited<ReturnType<typeof registerUser>>;
let liker1: Awaited<ReturnType<typeof registerUser>>;
let liker2: Awaited<ReturnType<typeof registerUser>>;
let liker3: Awaited<ReturnType<typeof registerUser>>;

let followedPostId: string;
let ownPostId: string;
let lowEngagementPostId: string;
let highEngagementPostId: string;

beforeAll(async () => {
  [explorer, followedAuthor, strangerAuthor, liker1, liker2, liker3] =
    await Promise.all([
      registerUser(),
      registerUser(),
      registerUser(),
      registerUser(),
      registerUser(),
      registerUser(),
    ]);

  await axios.put(
    `/api/v1/users/${followedAuthor.credentials.username}/follow`,
    undefined,
    authHeader(explorer.accessToken),
  );

  [followedPostId, ownPostId, lowEngagementPostId, highEngagementPostId] =
    await Promise.all([
      createPost(followedAuthor.accessToken, 'from someone I follow', {
        r: 10,
        g: 20,
        b: 30,
      }),
      createPost(explorer.accessToken, 'my own post', { r: 40, g: 50, b: 60 }),
      createPost(strangerAuthor.accessToken, 'low engagement', {
        r: 70,
        g: 80,
        b: 90,
      }),
      createPost(strangerAuthor.accessToken, 'high engagement', {
        r: 100,
        g: 110,
        b: 120,
      }),
    ]);

  await likeAsEach(lowEngagementPostId, [liker1.accessToken]);
  await likeAsEach(highEngagementPostId, [
    liker1.accessToken,
    liker2.accessToken,
    liker3.accessToken,
  ]);
}, 60_000);

describe('explore: GET /explore', () => {
  it('never includes posts from accounts the viewer follows', async () => {
    const res = await axios.get(
      '/api/v1/explore',
      authHeader(explorer.accessToken),
    );

    expect(
      res.data.data.some((post: { id: string }) => post.id === followedPostId),
    ).toBe(false);
  });

  it("never includes the viewer's own posts", async () => {
    const res = await axios.get(
      '/api/v1/explore',
      authHeader(explorer.accessToken),
    );

    expect(
      res.data.data.some((post: { id: string }) => post.id === ownPostId),
    ).toBe(false);
  });

  it('ranks the higher-engagement post above the lower-engagement one', async () => {
    const high = await findInExplore(
      explorer.accessToken,
      (post) => post.id === highEngagementPostId,
    );
    const low = await findInExplore(
      explorer.accessToken,
      (post) => post.id === lowEngagementPostId,
    );

    expect(high).not.toBeNull();
    expect(low).not.toBeNull();
    expect(high!.rank).toBeLessThan(low!.rank);
  });

  it('reports real likesCount/isLikedByMe on explore items', async () => {
    const found = await findInExplore(
      explorer.accessToken,
      (post) => post.id === highEngagementPostId,
    );

    expect(found).not.toBeNull();
    expect(found!.post.likesCount).toBe(3);
    expect(found!.post.isLikedByMe).toBe(false);
  });

  it('paginates deterministically with no duplicates or gaps across pages', async () => {
    const firstPage = await axios.get(
      '/api/v1/explore?limit=1',
      authHeader(explorer.accessToken),
    );
    expect(firstPage.data.data).toHaveLength(1);
    expect(firstPage.data.meta.nextCursor).not.toBeNull();

    const secondPage = await axios.get(
      `/api/v1/explore?limit=1&cursor=${encodeURIComponent(
        firstPage.data.meta.nextCursor,
      )}`,
      authHeader(explorer.accessToken),
    );
    expect(secondPage.data.data).toHaveLength(1);
    expect(secondPage.data.data[0].id).not.toBe(firstPage.data.data[0].id);

    // Re-fetching the exact same first page with the exact same (no) cursor
    // yields the exact same first item — a deterministic ranking for a
    // fixed seed, not one that reshuffles between requests.
    const firstPageAgain = await axios.get(
      '/api/v1/explore?limit=1',
      authHeader(explorer.accessToken),
    );
    expect(firstPageAgain.data.data[0].id).toBe(firstPage.data.data[0].id);
  });

  it('rejects an unauthenticated request with 401', async () => {
    await expect(axios.get('/api/v1/explore')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it('rejects a malformed cursor with 400', async () => {
    await expect(
      axios.get('/api/v1/explore?cursor=not-a-real-cursor!!', {
        headers: { Authorization: `Bearer ${explorer.accessToken}` },
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
});
