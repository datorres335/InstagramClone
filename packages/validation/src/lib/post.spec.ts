import {
  createPostInputSchema,
  postResponseSchema,
  postSummarySchema,
} from './post';

describe('createPostInputSchema', () => {
  it('accepts a minimal single-image post', () => {
    const result = createPostInputSchema.safeParse({
      mediaIds: ['018f2c1e-1234-7abc-89de-abcdef012345'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a full carousel with caption and location', () => {
    const result = createPostInputSchema.safeParse({
      caption: 'Great day',
      location: 'San Francisco, CA',
      mediaIds: Array.from(
        { length: 10 },
        (_, i) => `018f2c1e-0000-7000-8000-00000000000${i}`,
      ),
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero images', () => {
    expect(createPostInputSchema.safeParse({ mediaIds: [] }).success).toBe(
      false,
    );
  });

  it('rejects more than 10 images', () => {
    const mediaIds = Array.from(
      { length: 11 },
      (_, i) => `018f2c1e-0000-7000-8000-${String(i).padStart(12, '0')}`,
    );
    expect(createPostInputSchema.safeParse({ mediaIds }).success).toBe(false);
  });

  it('rejects a caption over 2200 characters', () => {
    const result = createPostInputSchema.safeParse({
      caption: 'a'.repeat(2201),
      mediaIds: ['018f2c1e-1234-7abc-89de-abcdef012345'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid mediaId', () => {
    expect(
      createPostInputSchema.safeParse({ mediaIds: ['not-a-uuid'] }).success,
    ).toBe(false);
  });
});

describe('postResponseSchema', () => {
  const validPost = {
    id: '018f2c1e-1234-7abc-89de-abcdef012345',
    author: {
      id: '018f2c1e-1234-7abc-89de-abcdef012346',
      username: 'alice',
      fullName: 'Alice Anderson',
      avatarUrl: null,
    },
    caption: null,
    location: null,
    media: [
      {
        id: '018f2c1e-1234-7abc-89de-abcdef012347',
        url: 'https://cdn.example.com/feed.webp',
        thumbnailUrl: 'https://cdn.example.com/thumb.webp',
        width: 800,
        height: 600,
        blurhash: null,
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

  it('accepts a fully populated post', () => {
    expect(postResponseSchema.safeParse(validPost).success).toBe(true);
  });

  it('accepts a post with an empty media array structurally (service-layer, not schema, enforces 1+)', () => {
    expect(
      postResponseSchema.safeParse({ ...validPost, media: [] }).success,
    ).toBe(true);
  });
});

describe('postSummarySchema', () => {
  it('accepts a grid tile with a null thumbnail', () => {
    const result = postSummarySchema.safeParse({
      id: '018f2c1e-1234-7abc-89de-abcdef012345',
      thumbnailUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});
