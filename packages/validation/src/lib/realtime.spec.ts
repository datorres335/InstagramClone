import { realtimeEventSchema } from './realtime';

const author = {
  id: '018f2c1e-1234-7abc-89de-abcdef012346',
  username: 'alice',
  fullName: 'Alice Anderson',
  avatarUrl: null,
};

describe('realtimeEventSchema', () => {
  it('accepts a notification event', () => {
    const result = realtimeEventSchema.safeParse({
      type: 'notification',
      notification: {
        id: '018f2c1e-1234-7abc-89de-abcdef012345',
        type: 'FOLLOW',
        actor: author,
        post: null,
        comment: null,
        isRead: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a message event', () => {
    const result = realtimeEventSchema.safeParse({
      type: 'message',
      message: {
        id: '018f2c1e-1234-7abc-89de-abcdef012347',
        conversationId: '018f2c1e-1234-7abc-89de-abcdef012348',
        sender: author,
        body: 'hi',
        readAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown type', () => {
    const result = realtimeEventSchema.safeParse({
      type: 'something-else',
    });
    expect(result.success).toBe(false);
  });
});
