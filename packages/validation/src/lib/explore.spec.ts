import { exploreResponseSchema } from './explore';

describe('exploreResponseSchema', () => {
  it('accepts an empty page', () => {
    const result = exploreResponseSchema.safeParse({
      data: [],
      meta: { nextCursor: null },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a page of full post responses', () => {
    const result = exploreResponseSchema.safeParse({
      data: [
        {
          id: '018f2c1e-1234-7abc-89de-abcdef012345',
          author: {
            id: '018f2c1e-1234-7abc-89de-abcdef012346',
            username: 'alice',
            fullName: 'Alice Anderson',
            avatarUrl: null,
          },
          caption: null,
          location: null,
          media: [],
          likesCount: 12,
          commentsCount: 0,
          isLikedByMe: false,
          isSavedByMe: false,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: { nextCursor: 'opaque-cursor' },
    });
    expect(result.success).toBe(true);
  });
});
