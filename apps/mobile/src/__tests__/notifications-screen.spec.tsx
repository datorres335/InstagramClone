import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import NotificationsScreen from '../app/(tabs)/notifications';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    notifications: { list: jest.fn(), markRead: jest.fn() },
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

const fakeActor = {
  id: 'user-2',
  username: 'bob',
  fullName: null,
  avatarUrl: null,
};

const fakeNotification = (
  id: string,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  type: 'FOLLOW' as const,
  actor: fakeActor,
  post: null,
  comment: null,
  isRead: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('NotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(apiClient.notifications.markRead).mockResolvedValue(undefined);
  });

  it('renders a FOLLOW notification', async () => {
    jest.mocked(apiClient.notifications.list).mockResolvedValue({
      data: [fakeNotification('notif-1')],
      meta: { nextCursor: null },
    });

    render(<NotificationsScreen />);

    await waitFor(() =>
      expect(screen.getByText('@bob started following you.')).toBeTruthy(),
    );
  });

  it('renders a LIKE notification', async () => {
    jest.mocked(apiClient.notifications.list).mockResolvedValue({
      data: [
        fakeNotification('notif-1', {
          type: 'LIKE',
          post: {
            id: 'post-1',
            thumbnailUrl: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        }),
      ],
      meta: { nextCursor: null },
    });

    render(<NotificationsScreen />);

    await waitFor(() =>
      expect(screen.getByText('@bob liked your post.')).toBeTruthy(),
    );
  });

  it('renders a COMMENT notification with the comment body', async () => {
    jest.mocked(apiClient.notifications.list).mockResolvedValue({
      data: [
        fakeNotification('notif-1', {
          type: 'COMMENT',
          post: {
            id: 'post-1',
            thumbnailUrl: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          comment: { id: 'comment-1', body: 'Great shot!' },
        }),
      ],
      meta: { nextCursor: null },
    });

    render(<NotificationsScreen />);

    await waitFor(() =>
      expect(screen.getByText('@bob commented: "Great shot!"')).toBeTruthy(),
    );
  });

  it('marks everything as read after loading the first page', async () => {
    jest.mocked(apiClient.notifications.list).mockResolvedValue({
      data: [fakeNotification('notif-1')],
      meta: { nextCursor: null },
    });

    render(<NotificationsScreen />);

    await waitFor(() =>
      expect(apiClient.notifications.markRead).toHaveBeenCalled(),
    );
  });

  it('shows an empty-state message when there are no notifications', async () => {
    jest
      .mocked(apiClient.notifications.list)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });

    render(<NotificationsScreen />);

    await waitFor(() =>
      expect(screen.getByText('No notifications yet.')).toBeTruthy(),
    );
  });

  it('loads the next page on reaching the end of the list', async () => {
    jest
      .mocked(apiClient.notifications.list)
      .mockResolvedValueOnce({
        data: [fakeNotification('notif-1')],
        meta: { nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        data: [fakeNotification('notif-0')],
        meta: { nextCursor: null },
      });

    render(<NotificationsScreen />);
    await waitFor(() =>
      expect(screen.getByText('@bob started following you.')).toBeTruthy(),
    );

    fireEvent(screen.getByTestId('notifications-list'), 'onEndReached');

    await waitFor(() => {
      expect(apiClient.notifications.list).toHaveBeenCalledWith({
        cursor: 'cursor-1',
      });
    });
  });
});
