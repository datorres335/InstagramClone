import {
  markReadInputSchema,
  notificationListResponseSchema,
  unreadCountResponseSchema,
} from './notification';

const actor = {
  id: '018f2c1e-1234-7abc-89de-abcdef012346',
  username: 'alice',
  fullName: 'Alice Anderson',
  avatarUrl: null,
};

describe('notificationListResponseSchema', () => {
  it('accepts an empty page', () => {
    const result = notificationListResponseSchema.safeParse({
      data: [],
      meta: { nextCursor: null },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a FOLLOW notification with no post or comment', () => {
    const result = notificationListResponseSchema.safeParse({
      data: [
        {
          id: '018f2c1e-1234-7abc-89de-abcdef012345',
          type: 'FOLLOW',
          actor,
          post: null,
          comment: null,
          isRead: false,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: { nextCursor: null },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a LIKE notification with a post but no comment', () => {
    const result = notificationListResponseSchema.safeParse({
      data: [
        {
          id: '018f2c1e-1234-7abc-89de-abcdef012345',
          type: 'LIKE',
          actor,
          post: {
            id: '018f2c1e-1234-7abc-89de-abcdef012347',
            thumbnailUrl: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          comment: null,
          isRead: true,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: { nextCursor: 'opaque-cursor' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a COMMENT notification with both a post and a comment', () => {
    const result = notificationListResponseSchema.safeParse({
      data: [
        {
          id: '018f2c1e-1234-7abc-89de-abcdef012345',
          type: 'COMMENT',
          actor,
          post: {
            id: '018f2c1e-1234-7abc-89de-abcdef012347',
            thumbnailUrl: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          comment: {
            id: '018f2c1e-1234-7abc-89de-abcdef012348',
            body: 'Great shot!',
          },
          isRead: false,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: { nextCursor: null },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid type', () => {
    const result = notificationListResponseSchema.safeParse({
      data: [
        {
          id: '018f2c1e-1234-7abc-89de-abcdef012345',
          type: 'REPOST',
          actor,
          post: null,
          comment: null,
          isRead: false,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: { nextCursor: null },
    });
    expect(result.success).toBe(false);
  });
});

describe('unreadCountResponseSchema', () => {
  it('accepts a nonnegative integer count', () => {
    expect(unreadCountResponseSchema.safeParse({ count: 0 }).success).toBe(
      true,
    );
    expect(unreadCountResponseSchema.safeParse({ count: 7 }).success).toBe(
      true,
    );
  });

  it('rejects a negative count', () => {
    expect(unreadCountResponseSchema.safeParse({ count: -1 }).success).toBe(
      false,
    );
  });
});

describe('markReadInputSchema', () => {
  it('accepts an empty body (mark all as read)', () => {
    expect(markReadInputSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a list of notification ids', () => {
    const result = markReadInputSchema.safeParse({
      notificationIds: ['018f2c1e-1234-7abc-89de-abcdef012345'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-uuid id', () => {
    const result = markReadInputSchema.safeParse({
      notificationIds: ['not-a-uuid'],
    });
    expect(result.success).toBe(false);
  });
});
