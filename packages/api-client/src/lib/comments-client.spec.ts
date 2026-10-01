import { createCommentsClient } from './comments-client';
import { HttpClient } from './http-client';
import { fakeResponse } from './test-utils/fake-response';
import { createFakeTokenStorage } from './test-utils/fake-token-storage';

const futureIso = new Date(Date.now() + 60_000).toISOString();

const fakeComment = {
  id: 'comment-1',
  author: {
    id: 'user-1',
    username: 'alice',
    fullName: 'Alice Anderson',
    avatarUrl: null,
  },
  body: 'Nice photo!',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function clientWithToken() {
  const storage = createFakeTokenStorage({
    accessToken: 'valid-token',
    accessTokenExpiresAt: futureIso,
    refreshToken: 'refresh-token',
  });
  return createCommentsClient(
    new HttpClient({ baseUrl: 'http://api.test', storage }),
  );
}

describe('CommentsClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('create', () => {
    it('sends POST /posts/:postId/comments with a valid access token', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(201, fakeComment));
      const client = clientWithToken();

      const result = await client.create('post-1', { body: 'Nice photo!' });

      expect(result).toEqual(fakeComment);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/post-1/comments',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token',
          },
          body: JSON.stringify({ body: 'Nice photo!' }),
        }),
      );
    });
  });

  describe('list', () => {
    it('fetches without an Authorization header when there is no stored session', async () => {
      const page = { data: [fakeComment], meta: { nextCursor: null } };
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, page));
      const client = createCommentsClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      const result = await client.list('post-1');

      expect(result).toEqual(page);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/post-1/comments',
        expect.objectContaining({ headers: {} }),
      );
    });

    it('serializes cursor/limit into the query string when provided', async () => {
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(200, { data: [], meta: { nextCursor: null } }),
      );
      const client = createCommentsClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      await client.list('post-1', { cursor: 'opaque-cursor', limit: 10 });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/post-1/comments?cursor=opaque-cursor&limit=10',
        expect.anything(),
      );
    });
  });

  describe('remove', () => {
    it('sends DELETE /posts/:postId/comments/:commentId', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.remove('post-1', 'comment-1');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/post-1/comments/comment-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('URL-encodes both ids', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.remove('weird id', 'another id');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/weird%20id/comments/another%20id',
        expect.anything(),
      );
    });
  });
});
