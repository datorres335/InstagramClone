import { createNotificationsClient } from './notifications-client';
import { HttpClient } from './http-client';
import { fakeResponse } from './test-utils/fake-response';
import { createFakeTokenStorage } from './test-utils/fake-token-storage';

const futureIso = new Date(Date.now() + 60_000).toISOString();

const fakeListResponse = {
  data: [],
  meta: { nextCursor: null },
};

function clientWithToken() {
  const storage = createFakeTokenStorage({
    accessToken: 'valid-token',
    accessTokenExpiresAt: futureIso,
    refreshToken: 'refresh-token',
  });
  return createNotificationsClient(
    new HttpClient({ baseUrl: 'http://api.test', storage }),
  );
}

describe('NotificationsClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('list', () => {
    it('sends an authenticated GET /notifications request', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, fakeListResponse));
      const client = clientWithToken();

      const result = await client.list();

      expect(result).toEqual(fakeListResponse);
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/notifications',
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
        'http://api.test/notifications?cursor=opaque-cursor&limit=10',
        expect.anything(),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('sends an authenticated GET /notifications/unread-count request', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(200, { count: 3 }));
      const client = clientWithToken();

      const result = await client.getUnreadCount();

      expect(result).toEqual({ count: 3 });
      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/notifications/unread-count',
        expect.objectContaining({
          headers: { Authorization: 'Bearer valid-token' },
        }),
      );
    });
  });

  describe('markRead', () => {
    it('sends POST /notifications/mark-read with an empty body to mark all as read', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.markRead();

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/notifications/mark-read',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        }),
      );
    });

    it('sends the given notificationIds in the body', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(204, undefined));
      const client = clientWithToken();

      await client.markRead(['notif-1', 'notif-2']);

      expect(fetch).toHaveBeenCalledWith(
        'http://api.test/notifications/mark-read',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ notificationIds: ['notif-1', 'notif-2'] }),
        }),
      );
    });
  });
});
