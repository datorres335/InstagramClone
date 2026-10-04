import {
  conversationListResponseSchema,
  conversationResponseSchema,
  createMessageInputSchema,
  messageListResponseSchema,
  messageResponseSchema,
  startConversationInputSchema,
} from './conversation';

const author = {
  id: '018f2c1e-1234-7abc-89de-abcdef012346',
  username: 'alice',
  fullName: 'Alice Anderson',
  avatarUrl: null,
};

describe('startConversationInputSchema', () => {
  it('accepts a valid username', () => {
    expect(
      startConversationInputSchema.safeParse({ username: 'bob' }).success,
    ).toBe(true);
  });

  it('rejects a missing username', () => {
    expect(startConversationInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('createMessageInputSchema', () => {
  it('accepts a normal message body', () => {
    expect(
      createMessageInputSchema.safeParse({ body: 'Hey there!' }).success,
    ).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(createMessageInputSchema.safeParse({ body: '' }).success).toBe(
      false,
    );
  });

  it('rejects a body over 2200 characters', () => {
    expect(
      createMessageInputSchema.safeParse({ body: 'a'.repeat(2201) }).success,
    ).toBe(false);
  });

  it('trims whitespace, rejecting a whitespace-only body', () => {
    expect(createMessageInputSchema.safeParse({ body: '   ' }).success).toBe(
      false,
    );
  });
});

describe('messageResponseSchema', () => {
  it('accepts a fully populated message', () => {
    const result = messageResponseSchema.safeParse({
      id: '018f2c1e-1234-7abc-89de-abcdef012345',
      conversationId: '018f2c1e-1234-7abc-89de-abcdef012347',
      sender: author,
      body: 'Hey!',
      readAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('messageListResponseSchema', () => {
  it('accepts an empty page', () => {
    const result = messageListResponseSchema.safeParse({
      data: [],
      meta: { nextCursor: null },
    });
    expect(result.success).toBe(true);
  });
});

describe('conversationResponseSchema', () => {
  it('accepts a conversation with no messages yet', () => {
    const result = conversationResponseSchema.safeParse({
      id: '018f2c1e-1234-7abc-89de-abcdef012347',
      otherParticipants: [author],
      lastMessage: null,
      unreadCount: 0,
      lastMessageAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('conversationListResponseSchema', () => {
  it('accepts an empty page', () => {
    const result = conversationListResponseSchema.safeParse({
      data: [],
      meta: { nextCursor: null },
    });
    expect(result.success).toBe(true);
  });
});
