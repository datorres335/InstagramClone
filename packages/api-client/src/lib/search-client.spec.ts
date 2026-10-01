import { createSearchClient } from './search-client';
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

describe('SearchClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('searchUsers', () => {
    it('fetches without an Authorization header when there is no stored session', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const client = createSearchClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      const result = await client.searchUsers({ q: 'alice' });

      expect(result).toEqual(fakeListResponse);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/search/users?q=alice',
        expect.objectContaining({ headers: {} }),
      );
    });

    it('includes an Authorization header when a session is stored', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const storage = createFakeTokenStorage({
        accessToken: 'valid-token',
        accessTokenExpiresAt: futureIso,
        refreshToken: 'refresh-token',
      });
      const client = createSearchClient(
        new HttpClient({ baseUrl: 'http://api.test', storage }),
      );

      await client.searchUsers({ q: 'alice' });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/search/users?q=alice',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-token' },
        }),
      );
    });

    it('serializes limit into the query string when provided', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const client = createSearchClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      await client.searchUsers({ q: 'alice', limit: 10 });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/search/users?q=alice&limit=10',
        expect.anything(),
      );
    });

    it('URL-encodes the query', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const client = createSearchClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      await client.searchUsers({ q: 'a b' });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/search/users?q=a+b',
        expect.anything(),
      );
    });
  });
});
