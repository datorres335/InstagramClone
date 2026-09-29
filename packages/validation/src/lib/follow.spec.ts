import { followListItemSchema, followListResponseSchema } from './follow';

const validItem = {
  id: '018f2c1e-1234-7abc-89de-abcdef012345',
  username: 'alice',
  fullName: 'Alice Anderson',
  avatarUrl: 'https://cdn.example.com/avatar.webp',
  isFollowedByMe: true,
};

describe('followListItemSchema', () => {
  it('accepts a fully populated item', () => {
    expect(followListItemSchema.safeParse(validItem).success).toBe(true);
  });

  it('accepts null fullName/avatarUrl/isFollowedByMe', () => {
    const result = followListItemSchema.safeParse({
      ...validItem,
      fullName: null,
      avatarUrl: null,
      isFollowedByMe: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed id', () => {
    expect(
      followListItemSchema.safeParse({ ...validItem, id: 'not-a-uuid' })
        .success,
    ).toBe(false);
  });

  it('rejects a malformed avatarUrl', () => {
    expect(
      followListItemSchema.safeParse({ ...validItem, avatarUrl: 'not-a-url' })
        .success,
    ).toBe(false);
  });
});

describe('followListResponseSchema', () => {
  it('accepts an empty page', () => {
    const result = followListResponseSchema.safeParse({
      data: [],
      meta: { nextCursor: null },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a page with a nextCursor', () => {
    const result = followListResponseSchema.safeParse({
      data: [validItem],
      meta: { nextCursor: 'opaque-cursor' },
    });
    expect(result.success).toBe(true);
  });
});
