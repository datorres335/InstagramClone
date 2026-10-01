import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import { NotificationBadge } from '../components/notification-badge';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    notifications: { getUnreadCount: jest.fn() },
  },
}));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Link: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});

describe('NotificationBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the seeded initial count without a leading poll', () => {
    render(<NotificationBadge initialCount={3} />);

    expect(screen.getByText('Notifications (3)')).toBeTruthy();
    expect(apiClient.notifications.getUnreadCount).not.toHaveBeenCalled();
  });

  it('renders no count suffix when there are no unread notifications', () => {
    render(<NotificationBadge initialCount={0} />);

    expect(screen.getByText('Notifications')).toBeTruthy();
  });

  it('refreshes the count on the polling interval', async () => {
    jest
      .mocked(apiClient.notifications.getUnreadCount)
      .mockResolvedValue({ count: 5 });
    render(<NotificationBadge initialCount={0} />);

    await jest.advanceTimersByTimeAsync(30_000);

    await waitFor(() =>
      expect(screen.getByText('Notifications (5)')).toBeTruthy(),
    );
  });
});
