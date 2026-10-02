import { createUsersClient } from './users-client';
import { HttpClient } from './http-client';
import { fakeResponse } from './test-utils/fake-response';
import { createFakeTokenStorage } from './test-utils/fake-token-storage';

const futureIso = new Date(Date.now() + 60_000).toISOString();

const fakeProfile = {
  id: 'user-1',
  username: 'alice',
  fullName: 'Alice Anderson',
  bio: null,
  websiteUrl: null,
  avatarUrl: null,
  isPrivate: false,
  postsCount: 0,
  followersCount: 0,
  followingCount: 0,
  isFollowedByMe: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('UsersClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('getProfile', () => {
    it('fetches without an Authorization header when there is no stored session', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeProfile));
      const client = createUsersClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      const result = await client.getProfile('alice');

      expect(result).toEqual(fakeProfile);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/users/alice',
        expect.objectContaining({ headers: {} }),
      );
    });

    it('attaches a valid stored access token when a session exists', async () => {
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(200, { ...fakeProfile, isFollowedByMe: false }),
      );
      const storage = createFakeTokenStorage({
        accessToken: 'valid-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = createUsersClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      await client.getProfile('alice');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/users/alice',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-token' },
        }),
      );
    });

    it('URL-encodes the username', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeProfile));
      const client = createUsersClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      await client.getProfile('weird name');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/users/weird%20name',
        expect.anything(),
      );
    });
  });

  describe('getPosts', () => {
    it('always returns an empty page (Post does not exist until Milestone 11)', async () => {
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(200, { data: [], meta: { nextCursor: null } }),
      );
      const client = createUsersClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      await expect(client.getPosts('alice')).resolves.toEqual({
        data: [],
        meta: { nextCursor: null },
      });
    });

    it('serializes cursor/limit into the query string when provided', async () => {
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(200, { data: [], meta: { nextCursor: null } }),
      );
      const client = createUsersClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      await client.getPosts('alice', { cursor: 'opaque-cursor', limit: 10 });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/users/alice/posts?cursor=opaque-cursor&limit=10',
        expect.anything(),
      );
    });

    it('omits the query string entirely when no query is given', async () => {
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(200, { data: [], meta: { nextCursor: null } }),
      );
      const client = createUsersClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      await client.getPosts('alice');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/users/alice/posts',
        expect.anything(),
      );
    });
  });

  describe('updateProfile', () => {
    it('sends a PATCH /me with a valid access token and returns the updated own-user shape', async () => {
      const updatedUser = {
        id: 'user-1',
        username: 'alice',
        email: 'alice@example.com',
      };
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, updatedUser));
      const storage = createFakeTokenStorage({
        accessToken: 'valid-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = createUsersClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      const result = await client.updateProfile({ bio: 'Hello' });

      expect(result).toEqual(updatedUser);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/me',
        expect.objectContaining({
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token',
          },
          body: JSON.stringify({ bio: 'Hello' }),
        }),
      );
    });
  });

  describe('updateAvatar', () => {
    it('sends a PATCH /me/avatar with the mediaId and returns the media resource', async () => {
      const mediaResponse = {
        id: 'media-1',
        purpose: 'AVATAR',
        status: 'READY',
        variants: {
          thumbnail: 'http://minio.test/thumb.webp',
          feed: 'http://minio.test/feed.webp',
        },
        width: 300,
        height: 300,
        blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
        failureReason: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, mediaResponse));
      const storage = createFakeTokenStorage({
        accessToken: 'valid-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = createUsersClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      const result = await client.updateAvatar('media-1');

      expect(result).toEqual(mediaResponse);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/me/avatar',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ mediaId: 'media-1' }),
        }),
      );
    });
  });

  describe('changePassword', () => {
    it('sends a POST /me/change-password and persists the fresh token pair the response carries', async () => {
      const futureIso2 = new Date(Date.now() + 120_000).toISOString();
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(200, {
          accessToken: 'new-access-token',
          accessTokenExpiresAt: futureIso2,
          refreshToken: 'new-refresh-token',
        }),
      );
      const storage = createFakeTokenStorage({
        accessToken: 'old-access-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'old-refresh-token',
      });
      const client = createUsersClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      await client.changePassword({
        currentPassword: 'old-password',
        newPassword: 'new-password',
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/me/change-password',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer old-access-token',
          },
          body: JSON.stringify({
            currentPassword: 'old-password',
            newPassword: 'new-password',
          }),
        }),
      );
      await expect(storage.read()).resolves.toEqual({
        accessToken: 'new-access-token',
        accessTokenExpiresAt: futureIso2,
        refreshToken: 'new-refresh-token',
      });
    });

    it('throws rather than silently dropping the session if the API omits a refreshToken', async () => {
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(200, {
          accessToken: 'new-access-token',
          accessTokenExpiresAt: futureIso,
        }),
      );
      const storage = createFakeTokenStorage({
        accessToken: 'old-access-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'old-refresh-token',
      });
      const client = createUsersClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      await expect(
        client.changePassword({
          currentPassword: 'old-password',
          newPassword: 'new-password',
        }),
      ).rejects.toThrow(/did not include a refreshToken/);
    });
  });

  describe('changeEmail', () => {
    it('sends a POST /me/change-email and returns the updated user', async () => {
      const updatedUser = {
        id: 'user-1',
        username: 'alice',
        email: 'new@example.com',
      };
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, updatedUser));
      const storage = createFakeTokenStorage({
        accessToken: 'valid-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = createUsersClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      const result = await client.changeEmail({
        newEmail: 'new@example.com',
        currentPassword: 'old-password',
      });

      expect(result).toEqual(updatedUser);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/me/change-email',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            newEmail: 'new@example.com',
            currentPassword: 'old-password',
          }),
        }),
      );
    });
  });

  describe('deleteAccount', () => {
    it('sends a DELETE /me with the confirmation body and clears the stored session', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const storage = createFakeTokenStorage({
        accessToken: 'valid-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = createUsersClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      await client.deleteAccount({ currentPassword: 'old-password' });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/me',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ currentPassword: 'old-password' }),
        }),
      );
      await expect(storage.read()).resolves.toBeNull();
    });
  });
});
