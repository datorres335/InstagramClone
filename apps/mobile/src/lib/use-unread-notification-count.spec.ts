import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePathname } from 'expo-router';

import { apiClient } from './api-client';
import { useRealtimeEvents } from './realtime';
import {
  unreadTabBadge,
  useUnreadNotificationCount,
} from './use-unread-notification-count';

jest.mock('./api-client', () => ({
  apiClient: {
    notifications: { getUnreadCount: jest.fn() },
  },
}));
jest.mock('./realtime', () => ({ useRealtimeEvents: jest.fn() }));
jest.mock('expo-router', () => ({ usePathname: jest.fn() }));

const fakeNotification = {
  id: '018f2c1e-1234-7abc-89de-abcdef012345',
  type: 'FOLLOW' as const,
  actor: {
    id: '018f2c1e-1234-7abc-89de-abcdef012346',
    username: 'bob',
    fullName: 'Bob',
    avatarUrl: null,
  },
  post: null,
  comment: null,
  isRead: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function latestCallbacks() {
  const calls = jest.mocked(useRealtimeEvents).mock.calls;
  const [onEvent, onConnect] = calls[calls.length - 1] ?? [];
  if (!onEvent || !onConnect) throw new Error('useRealtimeEvents not called');
  return { onEvent, onConnect };
}

describe('useUnreadNotificationCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(usePathname).mockReturnValue('/home');
  });

  it('starts at zero and takes the real count when the stream connects', async () => {
    jest
      .mocked(apiClient.notifications.getUnreadCount)
      .mockResolvedValue({ count: 5 });
    const { result } = renderHook(() => useUnreadNotificationCount());
    expect(result.current).toBe(0);

    act(() => latestCallbacks().onConnect());

    await waitFor(() => expect(result.current).toBe(5));
  });

  it('increments when a notification is pushed', () => {
    const { result } = renderHook(() => useUnreadNotificationCount());

    act(() =>
      latestCallbacks().onEvent({
        type: 'notification',
        notification: fakeNotification,
      }),
    );

    expect(result.current).toBe(1);
  });

  it('resets when the Notifications tab opens', () => {
    const { result, rerender } = renderHook(() => useUnreadNotificationCount());
    act(() =>
      latestCallbacks().onEvent({
        type: 'notification',
        notification: fakeNotification,
      }),
    );
    expect(result.current).toBe(1);

    jest.mocked(usePathname).mockReturnValue('/notifications');
    rerender({});

    expect(result.current).toBe(0);
  });

  it('keeps a push that arrives while the re-fetch is still in flight', async () => {
    let resolveFetch: (value: { count: number }) => void = () => undefined;
    jest.mocked(apiClient.notifications.getUnreadCount).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const { result } = renderHook(() => useUnreadNotificationCount());

    // The re-fetch reads the count (0) just before the notification lands...
    act(() => latestCallbacks().onConnect());
    // ...then the push for that notification arrives first...
    act(() =>
      latestCallbacks().onEvent({
        type: 'notification',
        notification: fakeNotification,
      }),
    );
    // ...and the stale re-fetch result must not erase it.
    await act(async () => {
      resolveFetch({ count: 0 });
    });

    expect(result.current).toBe(1);
  });
});

describe('unreadTabBadge', () => {
  it('shows the count in the badge and the accessible name', () => {
    expect(unreadTabBadge(3)).toEqual({
      tabBarBadge: 3,
      tabBarAccessibilityLabel: 'Notifications (3)',
    });
  });

  it('shows no badge and no count suffix when nothing is unread', () => {
    expect(unreadTabBadge(0)).toEqual({
      tabBarBadge: undefined,
      tabBarAccessibilityLabel: 'Notifications',
    });
  });
});
