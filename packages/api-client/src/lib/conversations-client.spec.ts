import { createConversationsClient } from './conversations-client';
import { HttpClient } from './http-client';
import { fakeResponse } from './test-utils/fake-response';
import { createFakeTokenStorage } from './test-utils/fake-token-storage';

const futureIso = new Date(Date.now() + 60_000).toISOString();

const fakeConversation = {
  id: 'conv-1',
  otherParticipants: [],
  lastMessage: null,
  unreadCount: 0,
  lastMessageAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const fakeListResponse = { data: [], meta: { nextCursor: null } };

function clientWithToken() {
  const storage = createFakeTokenStorage({
    accessToken: 'valid-token',
    accessTokenExpiresAt: futureIso,
    refreshToken: 'refresh-token',
  });
  return createConversationsClient(
    new HttpClient({ baseUrl: 'http://api.test', storage }),
  );
}

describe('ConversationsClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('start', () => {
    it('sends an authenticated POST /conversations request with the username', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(201, fakeConversation));
      const client = clientWithToken();

      const result = await client.start('bob');

      expect(result).toEqual(fakeConversation);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/conversations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'bob' }),
        }),
      );
    });
  });

  describe('get', () => {
    it('sends an authenticated GET /conversations/:id request', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeConversation));
      const client = clientWithToken();

      const result = await client.get('conv-1');

      expect(result).toEqual(fakeConversation);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/conversations/conv-1',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-token' },
        }),
      );
    });
  });

  describe('list', () => {
    it('sends an authenticated GET /conversations request', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const client = clientWithToken();

      const result = await client.list();

      expect(result).toEqual(fakeListResponse);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/conversations',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-token' },
        }),
      );
    });

    it('serializes cursor/limit into the query string when provided', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const client = clientWithToken();

      await client.list({ cursor: 'opaque-cursor', limit: 10 });

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/conversations?cursor=opaque-cursor&limit=10',
        expect.anything(),
      );
    });
  });

  describe('listMessages', () => {
    it('sends an authenticated GET /conversations/:id/messages request', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const client = clientWithToken();

      await client.listMessages('conv-1');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/conversations/conv-1/messages',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-token' },
        }),
      );
    });
  });

  describe('sendMessage', () => {
    it('sends an authenticated POST /conversations/:id/messages request with the body', async () => {
      vi.mocked(fetch).mockResolvedValue(
        fakeResponse(201, {
          id: 'msg-1',
          conversationId: 'conv-1',
          sender: {
            id: 'u1',
            username: 'alice',
            fullName: null,
            avatarUrl: null,
          },
          body: 'hi',
          readAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      );
      const client = clientWithToken();

      await client.sendMessage('conv-1', 'hi');

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/conversations/conv-1/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ body: 'hi' }),
        }),
      );
    });
  });
});
