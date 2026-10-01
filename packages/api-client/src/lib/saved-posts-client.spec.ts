import { createSavedPostsClient } from './saved-posts-client';
import { HttpClient } from './http-client';
import { fakeResponse } from './test-utils/fake-response';
import { createFakeTokenStorage } from './test-utils/fake-token-storage';

const futureIso = new Date(Date.now() + 60_000).toISOString();

const fakeSavedResponse = {
  data: [],
  meta: { nextCursor: null },
};

function clientWithToken() {
  const storage = createFakeTokenStorage({
    accessToken: 'valid-token',
    accessTokenExpiresAt: futureIso,
    refreshToken: 'refresh-token',
  });
  return createSavedPostsClient(
    new HttpClient({ baseUrl: 'http://api.test', storage }),
  );
}

describe('SavedPostsClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('save', () => {
    it('sends PUT /posts/:postId/save with a valid access token', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.save('post-1');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/post-1/save',
        expect.objectContaining({
          method: 'PUT',
          headers: { Authorization: 'Bearer valid-token' },
        }),
      );
    });

    it('URL-encodes the post id', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.save('weird id');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/weird%20id/save',
        expect.anything(),
      );
    });
  });

  describe('unsave', () => {
    it('sends DELETE /posts/:postId/save', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.unsave('post-1');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/post-1/save',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('getSaved', () => {
    it('sends an authenticated GET /me/saved request', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeSavedResponse));
      const client = clientWithToken();

      const result = await client.getSaved();

      expect(result).toEqual(fakeSavedResponse);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/me/saved',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-token' },
        }),
      );
    });

    it('serializes cursor/limit into the query string when provided', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeSavedResponse));
      const client = clientWithToken();

      await client.getSaved({ cursor: 'opaque-cursor', limit: 10 });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/me/saved?cursor=opaque-cursor&limit=10',
        expect.anything(),
      );
    });
  });
});
