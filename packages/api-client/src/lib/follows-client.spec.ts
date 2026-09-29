import { createFollowsClient } from './follows-client';
import { HttpClient } from './http-client';
import { fakeResponse } from './test-utils/fake-response';
import { createFakeTokenStorage } from './test-utils/fake-token-storage';

const futureIso = new Date(Date.now() + 60_000).toISOString();

const fakeListResponse = {
  data: [
    {
      id: 'user-1',
      username: 'alice',
      fullName: 'Alice Anderson',
      avatarUrl: null,
      isFollowedByMe: null,
    },
  ],
  meta: { nextCursor: null },
};

function clientWithToken() {
  const storage = createFakeTokenStorage({
    accessToken: 'valid-token',
    accessTokenExpiresAt: futureIso,
    refreshToken: 'refresh-token',
  });
  return createFollowsClient(
    new HttpClient({ baseUrl: 'http://api.test', storage }),
  );
}

describe('FollowsClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('follow', () => {
    it('sends PUT /users/:username/follow with a valid access token', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.follow('bob');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/users/bob/follow',
        expect.objectContaining({
          method: 'PUT',
          headers: { Authorization: 'Bearer valid-token' },
        }),
      );
    });

    it('URL-encodes the username', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.follow('weird name');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/users/weird%20name/follow',
        expect.anything(),
      );
    });
  });

  describe('unfollow', () => {
    it('sends DELETE /users/:username/follow', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.unfollow('bob');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/users/bob/follow',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('getFollowers', () => {
    it('fetches without an Authorization header when there is no stored session', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const client = createFollowsClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      const result = await client.getFollowers('bob');

      expect(result).toEqual(fakeListResponse);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/users/bob/followers',
        expect.objectContaining({ headers: {} }),
      );
    });

    it('serializes cursor/limit into the query string when provided', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const client = createFollowsClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      await client.getFollowers('bob', { cursor: 'opaque-cursor', limit: 10 });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/users/bob/followers?cursor=opaque-cursor&limit=10',
        expect.anything(),
      );
    });
  });

  describe('getFollowing', () => {
    it('fetches GET /users/:username/following', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const client = createFollowsClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      await client.getFollowing('bob');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/users/bob/following',
        expect.anything(),
      );
    });
  });
});
