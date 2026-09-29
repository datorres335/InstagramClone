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
});
