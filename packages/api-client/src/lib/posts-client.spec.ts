import { createPostsClient } from './posts-client';
import { HttpClient } from './http-client';
import { fakeResponse } from './test-utils/fake-response';
import { createFakeTokenStorage } from './test-utils/fake-token-storage';

const futureIso = new Date(Date.now() + 60_000).toISOString();

const fakePost = {
  id: 'post-1',
  author: {
    id: 'user-1',
    username: 'alice',
    fullName: 'Alice Anderson',
    avatarUrl: null,
  },
  caption: 'Hello',
  location: null,
  media: [
    {
      id: 'media-1',
      url: 'http://minio.test/media-1/feed.webp',
      thumbnailUrl: 'http://minio.test/media-1/thumbnail.webp',
      width: 800,
      height: 600,
      blurhash: 'hash',
      altText: null,
      position: 0,
    },
  ],
  likesCount: 0,
  commentsCount: 0,
  isLikedByMe: null,
  isSavedByMe: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function clientWithToken() {
  const storage = createFakeTokenStorage({
    accessToken: 'valid-token',
    accessTokenExpiresAt: futureIso,
    refreshToken: 'refresh-token',
  });
  return createPostsClient(
    new HttpClient({ baseUrl: 'http://api.test', storage }),
  );
}

describe('PostsClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('create', () => {
    it('sends POST /posts with a valid access token', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(201, fakePost));
      const client = clientWithToken();

      const input = { caption: 'Hello', mediaIds: ['media-1'] };
      const result = await client.create(input);

      expect(result).toEqual(fakePost);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts',
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

  describe('getById', () => {
    it('fetches without an Authorization header when there is no stored session', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakePost));
      const client = createPostsClient(
        new HttpClient({
          baseUrl: 'http://api.test',
          storage: createFakeTokenStorage(null),
        }),
      );

      const result = await client.getById('post-1');

      expect(result).toEqual(fakePost);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/post-1',
        expect.objectContaining({ headers: {} }),
      );
    });

    it('URL-encodes the post id', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakePost));
      const client = clientWithToken();

      await client.getById('weird id');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/weird%20id',
        expect.anything(),
      );
    });
  });

  describe('remove', () => {
    it('sends DELETE /posts/:id', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.remove('post-1');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/posts/post-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('getFeed', () => {
    it('sends GET /feed with a valid access token', async () => {
      const feed = { data: [fakePost], meta: { nextCursor: null } };
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, feed));
      const client = clientWithToken();

      const result = await client.getFeed();

      expect(result).toEqual(feed);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/feed',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-token' },
        }),
      );
    });

    it('serializes cursor/limit into the query string', async () => {
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(200, { data: [], meta: { nextCursor: null } }),
      );
      const client = clientWithToken();

      await client.getFeed({ cursor: 'abc', limit: 5 });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/feed?cursor=abc&limit=5',
        expect.anything(),
      );
    });
  });
});
