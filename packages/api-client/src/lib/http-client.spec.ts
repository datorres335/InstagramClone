import { ApiError, NotAuthenticatedError } from './api-error';
import { HttpClient } from './http-client';
import { fakeResponse } from './test-utils/fake-response';
import { createFakeTokenStorage } from './test-utils/fake-token-storage';

const futureIso = new Date(Date.now() + 60_000).toISOString();
const pastIso = new Date(Date.now() - 60_000).toISOString();

describe('HttpClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('request', () => {
    it('sends a JSON body and parses a JSON response', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, { ok: true }));
      const client = new HttpClient({
        baseUrl: 'http://api.test',
        storage: createFakeTokenStorage(),
      });

      const result = await client.request<{ ok: boolean }, { hello: string }>(
        'POST',
        '/thing',
        {
          hello: 'world',
        },
      );

      expect(result).toEqual({ ok: true });
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/thing',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hello: 'world' }),
        }),
      );
    });

    it('throws an ApiError with the parsed Problem Details on a non-2xx response', async () => {
      const problem = {
        type: 'https://x/errors/conflict',
        title: 'Conflict',
        status: 409,
      };
      vi.mocked(fetch).mockResolvedValue(fakeResponse(409, problem));
      const client = new HttpClient({
        baseUrl: 'http://api.test',
        storage: createFakeTokenStorage(),
      });

      await expect(client.request('POST', '/thing')).rejects.toMatchObject({
        name: 'ApiError',
        problem,
      });
    });

    it('returns undefined for a 204 response without calling .json()', async () => {
      const res = fakeResponse(204, undefined);
      res.json = async () => {
        throw new Error('should not be called for 204');
      };
      vi.mocked(fetch).mockResolvedValue(res);
      const client = new HttpClient({
        baseUrl: 'http://api.test',
        storage: createFakeTokenStorage(),
      });

      await expect(client.request('POST', '/thing')).resolves.toBeUndefined();
    });
  });

  describe('authorizedRequest', () => {
    it('uses a still-valid stored access token directly, without refreshing', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, { data: 1 }));
      const storage = createFakeTokenStorage({
        accessToken: 'valid-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = new HttpClient({ baseUrl: 'http://api.test', storage });

      await client.authorizedRequest('GET', '/me');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/me',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-token' },
        }),
      );
    });

    it('refreshes first when the stored access token is missing or expired', async () => {
      const storage = createFakeTokenStorage({
        accessToken: null,
        accessTokenExpiresAt: null,
        refreshToken: 'refresh-token',
      });
      const client = new HttpClient({ baseUrl: 'http://api.test', storage });
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          fakeResponse(200, {
            accessToken: 'fresh-token',
            accessTokenExpiresAt: futureIso,
            refreshToken: 'rotated-refresh-token',
          }),
        )
        .mockResolvedValueOnce(fakeResponse(200, { data: 1 }));

      await client.authorizedRequest('GET', '/me');

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        'http://api.test/auth/refresh',
        expect.anything(),
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'http://api.test/me',
        expect.objectContaining({
          headers: { Authorization: 'Bearer fresh-token' },
        }),
      );
      await expect(storage.read()).resolves.toEqual({
        accessToken: 'fresh-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'rotated-refresh-token',
      });
    });

    it('retries once, after refreshing, when the server rejects an apparently-valid token', async () => {
      const storage = createFakeTokenStorage({
        accessToken: 'stale-but-unexpired-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = new HttpClient({ baseUrl: 'http://api.test', storage });
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          fakeResponse(401, {
            type: 'x',
            title: 'unauthenticated',
            status: 401,
          }),
        )
        .mockResolvedValueOnce(
          fakeResponse(200, {
            accessToken: 'fresh-token',
            accessTokenExpiresAt: futureIso,
            refreshToken: 'rotated-refresh-token',
          }),
        )
        .mockResolvedValueOnce(fakeResponse(200, { data: 1 }));

      const result = await client.authorizedRequest('GET', '/me');

      expect(result).toEqual({ data: 1 });
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('throws NotAuthenticatedError when there is no stored session at all', async () => {
      const client = new HttpClient({
        baseUrl: 'http://api.test',
        storage: createFakeTokenStorage(null),
      });

      await expect(
        client.authorizedRequest('GET', '/me'),
      ).rejects.toBeInstanceOf(NotAuthenticatedError);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('propagates a non-401 ApiError without retrying', async () => {
      const storage = createFakeTokenStorage({
        accessToken: 'valid-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = new HttpClient({ baseUrl: 'http://api.test', storage });
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(500, { type: 'x', title: 'internal-error', status: 500 }),
      );

      await expect(
        client.authorizedRequest('GET', '/me'),
      ).rejects.toBeInstanceOf(ApiError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAccessToken', () => {
    it('returns the stored access token when it is still valid, without refreshing', async () => {
      const storage = createFakeTokenStorage({
        accessToken: 'valid-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = new HttpClient({ baseUrl: 'http://api.test', storage });

      await expect(client.getAccessToken()).resolves.toBe('valid-token');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('refreshes and returns the fresh token when the stored one is expired', async () => {
      const storage = createFakeTokenStorage({
        accessToken: 'stale-token',
        accessTokenExpiresAt: pastIso,
        refreshToken: 'refresh-token',
      });
      const client = new HttpClient({ baseUrl: 'http://api.test', storage });
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(200, {
          accessToken: 'fresh-token',
          accessTokenExpiresAt: futureIso,
          refreshToken: 'rotated-refresh-token',
        }),
      );

      await expect(client.getAccessToken()).resolves.toBe('fresh-token');
    });

    it('throws NotAuthenticatedError when there is no stored session', async () => {
      const client = new HttpClient({
        baseUrl: 'http://api.test',
        storage: createFakeTokenStorage(null),
      });

      await expect(client.getAccessToken()).rejects.toBeInstanceOf(
        NotAuthenticatedError,
      );
    });
  });

  describe('refresh', () => {
    it('falls back to the existing refresh token if the response omits one', async () => {
      const storage = createFakeTokenStorage({
        accessToken: null,
        accessTokenExpiresAt: pastIso,
        refreshToken: 'original-refresh-token',
      });
      const client = new HttpClient({ baseUrl: 'http://api.test', storage });
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(200, {
          accessToken: 'fresh-token',
          accessTokenExpiresAt: futureIso,
        }),
      );

      await client.refresh();

      await expect(storage.read()).resolves.toEqual({
        accessToken: 'fresh-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'original-refresh-token',
      });
    });
  });
});
