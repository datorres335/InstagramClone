import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import NotificationsScreen from '../app/(tabs)/notifications';
import { interFamily } from '../theme/fonts';

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
    useFocusEffect: jest.fn(),
  };
});

const { useFocusEffect } = jest.requireMock('expo-router') as {
  useFocusEffect: jest.Mock;
};

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

  it('marks an unread row with "Unread", semibold text and a dot', async () => {
    jest.mocked(apiClient.notifications.list).mockResolvedValue({
      data: [fakeNotification('notif-1', { isRead: false })],
      meta: { nextCursor: null },
    });

    render(<NotificationsScreen />);

    expect(
      await screen.findByLabelText(/^Unread: @bob started following you\./),
    ).toBeTruthy();
    expect(screen.getByText('@bob started following you.')).toHaveStyle({
      fontFamily: interFamily.semibold,
    });
    expect(screen.getByTestId('unread-indicator')).toBeTruthy();
  });

  it('leaves a read row unmarked', async () => {
    jest.mocked(apiClient.notifications.list).mockResolvedValue({
      data: [fakeNotification('notif-1', { isRead: true })],
      meta: { nextCursor: null },
    });

    render(<NotificationsScreen />);

    expect(
      await screen.findByLabelText(/^@bob started following you\./),
    ).toBeTruthy();
    expect(screen.getByText('@bob started following you.')).not.toHaveStyle({
      fontFamily: interFamily.semibold,
    });
    expect(screen.queryByTestId('unread-indicator')).toBeNull();
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

  it('reloads and marks read again when the tab regains focus', async () => {
    jest
      .mocked(apiClient.notifications.list)
      .mockResolvedValueOnce({
        data: [fakeNotification('notif-1')],
        meta: { nextCursor: null },
      })
      .mockResolvedValueOnce({
        data: [
          fakeNotification('notif-2', {
            type: 'LIKE',
            post: {
              id: 'post-1',
              thumbnailUrl: null,
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          }),
          fakeNotification('notif-1', { isRead: true }),
        ],
        meta: { nextCursor: null },
      });

    render(<NotificationsScreen />);
    await waitFor(() =>
      expect(apiClient.notifications.markRead).toHaveBeenCalledTimes(1),
    );

    const onFocus = useFocusEffect.mock.calls.at(-1)?.[0];
    if (typeof onFocus !== 'function') throw new Error('no focus effect');
    // The first focus is the initial mount, which already loaded the list.
    act(() => onFocus());
    expect(apiClient.notifications.list).toHaveBeenCalledTimes(1);
    // A later visit to the tab.
    await act(async () => onFocus());

    expect(await screen.findByText('@bob liked your post.')).toBeTruthy();
    await waitFor(() =>
      expect(apiClient.notifications.markRead).toHaveBeenCalledTimes(2),
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
