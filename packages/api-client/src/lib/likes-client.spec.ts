import { createLikesClient } from './likes-client';
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
  return createLikesClient(
    new HttpClient({ baseUrl: 'http://api.test', storage }),
  );
}

describe('LikesClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('like', () => {
    it('sends PUT /posts/:postId/like with a valid access token', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.like('post-1');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/post-1/like',
        expect.objectContaining({
          method: 'PUT',
          headers: { Authorization: 'Bearer valid-token' },
        }),
      );
    });

    it('URL-encodes the post id', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.like('weird id');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/weird%20id/like',
        expect.anything(),
      );
    });
  });

  describe('unlike', () => {
    it('sends DELETE /posts/:postId/like', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.unlike('post-1');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/post-1/like',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('getLikers', () => {
    it('fetches without an Authorization header when there is no stored session', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const client = createLikesClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      const result = await client.getLikers('post-1');

      expect(result).toEqual(fakeListResponse);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/post-1/likes',
        expect.objectContaining({ headers: {} }),
      );
    });

    it('serializes cursor/limit into the query string when provided', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const client = createLikesClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      await client.getLikers('post-1', { cursor: 'opaque-cursor', limit: 10 });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/post-1/likes?cursor=opaque-cursor&limit=10',
        expect.anything(),
      );
    });
  });
});
