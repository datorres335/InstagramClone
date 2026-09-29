import axios from 'axios';
import sharp from 'sharp';

import { randomRegisterInput } from '../support/random-user';

/**
 * Deliberately exercises the real pipeline end to end — real MinIO (direct
 * `PUT` to the presigned URL, real `HEAD`/`GET` on `complete`/variant reads),
 * real Redis-backed BullMQ processing (`MediaProcessor` actually runs and
 * generates variants with `sharp`) — nothing here is mocked, per the
 * Milestone 9 test scope in docs/IMPLEMENTATION_PLAN.md.
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

async function fakeUpload(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 10, g: 200, b: 90 },
    },
  })
    .png()
    .toBuffer();
}

interface MediaResource {
  id: string;
  purpose: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  variants: { thumbnail: string; feed: string } | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  failureReason: string | null;
  createdAt: string;
}

async function uploadAndComplete(
  accessToken: string,
  image: Buffer,
): Promise<MediaResource> {
  const presignRes = await axios.post(
    '/api/v1/media/presign',
    { purpose: 'AVATAR', contentType: 'image/png', byteSize: image.length },
    authHeader(accessToken),
  );
  expect(presignRes.status).toBe(201);
  const { mediaId, uploadUrl } = presignRes.data;

  const putRes = await axios.put(uploadUrl, image, {
    headers: { 'Content-Type': 'image/png' },
  });
  expect(putRes.status).toBe(200);

  const completeRes = await axios.post(
    `/api/v1/media/${mediaId}/complete`,
    undefined,
    authHeader(accessToken),
  );
  expect(completeRes.status).toBe(200);

  return { ...completeRes.data, id: mediaId };
}

async function waitUntilProcessed(
  accessToken: string,
  mediaId: string,
): Promise<MediaResource> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const res = await axios.get(
      `/api/v1/media/${mediaId}`,
      authHeader(accessToken),
    );
    if (res.data.status !== 'PENDING') return res.data;
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
let intruder: Awaited<ReturnType<typeof registerUser>>;

beforeAll(async () => {
  [owner, intruder] = await Promise.all([registerUser(), registerUser()]);
});

describe('media: presign -> upload -> complete -> processed -> avatar', () => {
  it('processes a real upload through BullMQ/sharp and exposes working variant URLs', async () => {
    const image = await fakeUpload(800, 400);

    const pending = await uploadAndComplete(owner.accessToken, image);
    expect(pending.status).toBe('PENDING');

    const processed = await waitUntilProcessed(owner.accessToken, pending.id);

    expect(processed.status).toBe('READY');
    expect(processed.width).toBe(800);
    expect(processed.height).toBe(400);
    expect(typeof processed.blurhash).toBe('string');
    expect(processed.blurhash?.length).toBeGreaterThan(0);
    expect(processed.variants).not.toBeNull();

    // The variant URLs are real, publicly-fetchable objects in the bucket —
    // not just strings the API invented (docs/ARCHITECTURE.md §8 point 5).
    const thumbnailRes = await axios.get(processed.variants!.thumbnail, {
      responseType: 'arraybuffer',
    });
    expect(thumbnailRes.status).toBe(200);
    expect(thumbnailRes.headers['content-type']).toBe('image/webp');
    const thumbnailMeta = await sharp(thumbnailRes.data).metadata();
    expect(thumbnailMeta.width).toBe(150);
    expect(thumbnailMeta.height).toBe(150);

    const feedRes = await axios.get(processed.variants!.feed, {
      responseType: 'arraybuffer',
    });
    expect(feedRes.status).toBe(200);
    const feedMeta = await sharp(feedRes.data).metadata();
    expect(feedMeta.width).toBe(800);
    expect(feedMeta.height).toBe(400);
  }, 30_000);

  it("sets the processed media as the caller's avatar and reflects it on the public profile", async () => {
    const image = await fakeUpload(400, 400);

    const pending = await uploadAndComplete(owner.accessToken, image);
    const processed = await waitUntilProcessed(owner.accessToken, pending.id);
    expect(processed.status).toBe('READY');

    const avatarRes = await axios.patch(
      '/api/v1/me/avatar',
      { mediaId: processed.id },
      authHeader(owner.accessToken),
    );
    expect(avatarRes.status).toBe(200);
    expect(avatarRes.data.id).toBe(processed.id);

    const profileRes = await axios.get(
      `/api/v1/users/${owner.credentials.username}`,
    );
    expect(profileRes.data.avatarUrl).toBe(processed.variants!.thumbnail);
  }, 30_000);

  it('rejects setting a still-PENDING media as an avatar with 422 media-not-ready', async () => {
    const image = await fakeUpload(200, 200);

    const pending = await uploadAndComplete(owner.accessToken, image);
    expect(pending.status).toBe('PENDING');

    await expect(
      axios.patch(
        '/api/v1/me/avatar',
        { mediaId: pending.id },
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

  it("rejects completing or fetching another user's media with 403", async () => {
    const image = await fakeUpload(200, 200);
    const pending = await uploadAndComplete(owner.accessToken, image);

    await expect(
      axios.get(
        `/api/v1/media/${pending.id}`,
        authHeader(intruder.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 403 } });

    await expect(
      axios.patch(
        '/api/v1/me/avatar',
        { mediaId: pending.id },
        authHeader(intruder.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });

  it('rejects an oversized presign request with 413', async () => {
    await expect(
      axios.post(
        '/api/v1/media/presign',
        {
          purpose: 'AVATAR',
          contentType: 'image/png',
          byteSize: 9 * 1024 * 1024,
        },
        authHeader(owner.accessToken),
      ),
    ).rejects.toMatchObject({
      response: {
        status: 413,
        data: {
          type: 'https://api.instagram-clone.dev/errors/payload-too-large',
        },
      },
    });
  });

  it('rejects an unauthenticated presign request with 401', async () => {
    await expect(
      axios.post('/api/v1/media/presign', {
        purpose: 'AVATAR',
        contentType: 'image/png',
        byteSize: 1024,
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});
