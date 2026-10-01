import {
  commentListResponseSchema,
  commentResponseSchema,
  createCommentInputSchema,
} from './comment';

describe('createCommentInputSchema', () => {
  it('accepts a normal comment body', () => {
    expect(
      createCommentInputSchema.safeParse({ body: 'Great photo!' }).success,
    ).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(createCommentInputSchema.safeParse({ body: '' }).success).toBe(
      false,
    );
  });

  it('rejects a body over 2200 characters', () => {
    expect(
      createCommentInputSchema.safeParse({ body: 'a'.repeat(2201) }).success,
    ).toBe(false);
  });

  it('trims whitespace, rejecting a whitespace-only body', () => {
    expect(createCommentInputSchema.safeParse({ body: '   ' }).success).toBe(
      false,
    );
  });
});

describe('commentResponseSchema', () => {
  it('accepts a fully populated comment', () => {
    const result = commentResponseSchema.safeParse({
      id: '018f2c1e-1234-7abc-89de-abcdef012345',
      author: {
        id: '018f2c1e-1234-7abc-89de-abcdef012346',
        username: 'alice',
        fullName: 'Alice Anderson',
        avatarUrl: null,
      },
      body: 'Nice!',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('commentListResponseSchema', () => {
  it('accepts an empty page', () => {
    const result = commentListResponseSchema.safeParse({
      data: [],
      meta: { nextCursor: null },
    });
    expect(result.success).toBe(true);
  });
});
