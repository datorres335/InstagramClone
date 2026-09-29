import { createMediaClient } from './media-client';
import { HttpClient } from './http-client';
import { fakeResponse } from './test-utils/fake-response';
import { createFakeTokenStorage } from './test-utils/fake-token-storage';

const futureIso = new Date(Date.now() + 60_000).toISOString();

const fakeMedia = {
  id: 'media-1',
  purpose: 'AVATAR',
  status: 'PENDING',
  variants: null,
  width: null,
  height: null,
  blurhash: null,
  failureReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function clientWithToken() {
  const storage = createFakeTokenStorage({
    accessToken: 'valid-token',
    accessTokenExpiresAt: futureIso,
    refreshToken: 'refresh-token',
  });
  return createMediaClient(
    new HttpClient({ baseUrl: 'http://api.test', storage }),
  );
}

describe('MediaClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('presign', () => {
    it('sends POST /media/presign with a valid access token', async () => {
      const presignResponse = {
        mediaId: 'media-1',
        uploadUrl: 'http://minio.test/upload',
        expiresAt: futureIso,
      };
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, presignResponse));
      const client = clientWithToken();

      const input = {
        purpose: 'AVATAR' as const,
        contentType: 'image/png' as const,
        byteSize: 1024,
      };
      const result = await client.presign(input);

      expect(result).toEqual(presignResponse);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/media/presign',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token',
          },
          body: JSON.stringify(input),
        }),
      );
    });
  });

  describe('complete', () => {
    it('sends POST /media/:id/complete and URL-encodes the id', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeMedia));
      const client = clientWithToken();

      await client.complete('weird id');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/media/weird%20id/complete',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('getById', () => {
    it('sends GET /media/:id', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeMedia));
      const client = clientWithToken();

      const result = await client.getById('media-1');

      expect(result).toEqual(fakeMedia);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/media/media-1',
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('uploadToPresignedUrl', () => {
    it('PUTs the file directly to the presigned URL, not through the API base URL', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, {}));
      const client = clientWithToken();
      const file = new Blob(['bytes'], { type: 'image/png' });

      await client.uploadToPresignedUrl(
        'http://minio.test/bucket/key?sig=abc',
        file,
        'image/png',
      );

      expect(fetch).toHaveBeenCalledWith(
        'http://minio.test/bucket/key?sig=abc',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'image/png' },
          body: file,
        }),
      );
    });

    it('throws when the direct upload is rejected', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
      } as Response);
      const client = clientWithToken();

      await expect(
        client.uploadToPresignedUrl(
          'http://minio.test/bucket/key',
          new Blob(['bytes']),
          'image/png',
        ),
      ).rejects.toThrow('403');
    });
  });

  describe('waitUntilProcessed', () => {
    it('polls until status leaves PENDING', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(fakeResponse(200, fakeMedia))
        .mockResolvedValueOnce(
          fakeResponse(200, { ...fakeMedia, status: 'READY' }),
        );
      const client = clientWithToken();

      const result = await client.waitUntilProcessed('media-1', {
        intervalMs: 0,
      });

      expect(result.status).toBe('READY');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('times out if the media never leaves PENDING', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeMedia));
      const client = clientWithToken();

      await expect(
        client.waitUntilProcessed('media-1', {
          intervalMs: 0,
          timeoutMs: -1,
        }),
      ).rejects.toThrow('Timed out');
    });
  });
});
