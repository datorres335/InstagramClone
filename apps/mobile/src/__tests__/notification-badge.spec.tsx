import * as React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import { useRealtimeEvents } from '../lib/realtime';
import { NotificationBadge } from '../components/notification-badge';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    notifications: { getUnreadCount: jest.fn() },
  },
}));
jest.mock('../lib/realtime', () => ({ useRealtimeEvents: jest.fn() }));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Link: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});

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

describe('NotificationBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the seeded initial count', () => {
    render(<NotificationBadge initialCount={3} />);

    expect(screen.getByText('Notifications (3)')).toBeTruthy();
  });

  it('renders no count suffix when there are no unread notifications', () => {
    render(<NotificationBadge initialCount={0} />);

    expect(screen.getByText('Notifications')).toBeTruthy();
  });

  it('increments the count when a notification event arrives', () => {
    render(<NotificationBadge initialCount={0} />);

    const [onEvent] = jest.mocked(useRealtimeEvents).mock.calls[0];
    act(() => {
      onEvent({ type: 'notification', notification: fakeNotification });
    });

    expect(screen.getByText('Notifications (1)')).toBeTruthy();
  });

  it('re-fetches the real count on (re)connect', async () => {
    jest
      .mocked(apiClient.notifications.getUnreadCount)
      .mockResolvedValue({ count: 5 });
    render(<NotificationBadge initialCount={0} />);

    const [, onConnect] = jest.mocked(useRealtimeEvents).mock.calls[0];
    onConnect?.();

    await waitFor(() =>
      expect(screen.getByText('Notifications (5)')).toBeTruthy(),
    );
  });
});
