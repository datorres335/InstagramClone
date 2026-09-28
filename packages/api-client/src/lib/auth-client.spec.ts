import { createAuthClient } from './auth-client';
import { HttpClient } from './http-client';
import { fakeResponse } from './test-utils/fake-response';
import { createFakeTokenStorage } from './test-utils/fake-token-storage';

const futureIso = new Date(Date.now() + 60_000).toISOString();

const fakeUser = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  fullName: null,
  bio: null,
  websiteUrl: null,
  isPrivate: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('AuthClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('register', () => {
    it('persists the returned session and returns the user', async () => {
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(201, {
          user: fakeUser,
          accessToken: 'access-token',
          accessTokenExpiresAt: futureIso,
          refreshToken: 'refresh-token',
        }),
      );
      const storage = createFakeTokenStorage();
      const client = createAuthClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      const user = await client.register({
        email: 'alice@example.com',
        username: 'alice',
        password: 'password123',
      });

      expect(user).toEqual(fakeUser);
      await expect(storage.read()).resolves.toEqual({
        accessToken: 'access-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
    });

    it('throws rather than silently dropping the session if the API omits a refreshToken', async () => {
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(201, {
          user: fakeUser,
          accessToken: 'access-token',
          accessTokenExpiresAt: futureIso,
        }),
      );
      const client = createAuthClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(),
        }),
      );

      await expect(
        client.register({
          email: 'alice@example.com',
          username: 'alice',
          password: 'password123',
        }),
      ).rejects.toThrow('refreshToken');
    });
  });

  describe('login', () => {
    it('persists the returned session and returns the user', async () => {
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(200, {
          user: fakeUser,
          accessToken: 'access-token',
          accessTokenExpiresAt: futureIso,
          refreshToken: 'refresh-token',
        }),
      );
      const storage = createFakeTokenStorage();
      const client = createAuthClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      const user = await client.login({
        emailOrUsername: 'alice',
        password: 'password123',
      });

      expect(user).toEqual(fakeUser);
      await expect(storage.read()).resolves.toMatchObject({
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('logout', () => {
    it('sends the stored refresh token and clears storage', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const storage = createFakeTokenStorage({
        accessToken: 'access-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = createAuthClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      await client.logout({ allDevices: true });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/auth/logout',
        expect.objectContaining({
          body: JSON.stringify({
            refreshToken: 'refresh-token',
            allDevices: true,
          }),
        }),
      );
      await expect(storage.read()).resolves.toBeNull();
    });

    it('is a no-op network-wise, but still clears, when there is no stored session', async () => {
      const storage = createFakeTokenStorage(null);
      const client = createAuthClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      await client.logout();

      expect(fetch).not.toHaveBeenCalled();
      await expect(storage.read()).resolves.toBeNull();
    });

    it('still clears storage even if the network call fails', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('network down'));
      const storage = createFakeTokenStorage({
        accessToken: 'access-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = createAuthClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      await expect(client.logout()).rejects.toThrow('network down');
      await expect(storage.read()).resolves.toBeNull();
    });
  });

  describe('session', () => {
    it('returns the current user on success', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, { user: fakeUser }));
      const storage = createFakeTokenStorage({
        accessToken: 'access-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = createAuthClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      await expect(client.session()).resolves.toEqual(fakeUser);
    });

    it('returns null, not an error, when there is no stored session', async () => {
      const client = createAuthClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      await expect(client.session()).resolves.toBeNull();
    });

    it('returns null when the API rejects the session as unauthenticated', async () => {
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(401, { type: 'x', title: 'unauthenticated', status: 401 }),
      );
      const storage = createFakeTokenStorage({
        accessToken: 'access-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = createAuthClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      await expect(client.session()).resolves.toBeNull();
    });
  });
});
