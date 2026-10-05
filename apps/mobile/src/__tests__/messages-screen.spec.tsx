import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import { useRealtimeEvents } from '../lib/realtime';
import MessagesScreen from '../app/(tabs)/messages';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    conversations: { list: jest.fn(), start: jest.fn() },
  },
}));
jest.mock('../lib/realtime', () => ({ useRealtimeEvents: jest.fn() }));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Link: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
    router: { push: jest.fn() },
  };
});

const { router } = jest.requireMock('expo-router') as {
  router: { push: jest.Mock };
};

const fakeOther = {
  id: 'user-2',
  username: 'bob',
  fullName: null,
  avatarUrl: null,
};

const fakeConversation = (
  id: string,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  otherParticipants: [fakeOther],
  lastMessage: null,
  unreadCount: 0,
  lastMessageAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('MessagesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a conversation with its last message preview', async () => {
    jest.mocked(apiClient.conversations.list).mockResolvedValue({
      data: [
        fakeConversation('conv-1', {
          lastMessage: {
            id: 'msg-1',
            conversationId: 'conv-1',
            sender: fakeOther,
            body: 'hey there',
            readAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        }),
      ],
      meta: { nextCursor: null },
    });

    render(<MessagesScreen />);

    await waitFor(() => expect(screen.getByText('@bob')).toBeTruthy());
    expect(screen.getByText('hey there')).toBeTruthy();
  });

  it('shows an unread count when present', async () => {
    jest.mocked(apiClient.conversations.list).mockResolvedValue({
      data: [fakeConversation('conv-1', { unreadCount: 3 })],
      meta: { nextCursor: null },
    });

    render(<MessagesScreen />);

    await waitFor(() => expect(screen.getByText(' (3)')).toBeTruthy());
  });

  it('shows an empty-state message when there are no conversations', async () => {
    jest
      .mocked(apiClient.conversations.list)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });

    render(<MessagesScreen />);

    await waitFor(() =>
      expect(screen.getByText('No conversations yet.')).toBeTruthy(),
    );
  });

  it('loads the next page on reaching the end of the list', async () => {
    jest
      .mocked(apiClient.conversations.list)
      .mockResolvedValueOnce({
        data: [fakeConversation('conv-1')],
        meta: { nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        data: [fakeConversation('conv-0')],
        meta: { nextCursor: null },
      });

    render(<MessagesScreen />);
    await waitFor(() => expect(screen.getByText('@bob')).toBeTruthy());

    fireEvent(screen.getByTestId('conversations-list'), 'onEndReached');

    await waitFor(() => {
      expect(apiClient.conversations.list).toHaveBeenCalledWith({
        cursor: 'cursor-1',
      });
    });
  });

  it('starts a conversation and navigates to its thread', async () => {
    jest
      .mocked(apiClient.conversations.list)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });
    jest
      .mocked(apiClient.conversations.start)
      .mockResolvedValue(fakeConversation('conv-new'));

    render(<MessagesScreen />);
    await waitFor(() =>
      expect(screen.getByText('No conversations yet.')).toBeTruthy(),
    );

    fireEvent.changeText(screen.getByLabelText('New message to'), 'bob');
    fireEvent.press(screen.getByText('Chat'));

    await waitFor(() => {
      expect(apiClient.conversations.start).toHaveBeenCalledWith('bob');
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/conversation/[id]',
        params: { id: 'conv-new' },
      });
    });
  });

  it('re-fetches the first page when a message event arrives', async () => {
    jest
      .mocked(apiClient.conversations.list)
      .mockResolvedValueOnce({ data: [], meta: { nextCursor: null } })
      .mockResolvedValueOnce({
        data: [fakeConversation('conv-1')],
        meta: { nextCursor: null },
      });

    render(<MessagesScreen />);
    await waitFor(() =>
      expect(screen.getByText('No conversations yet.')).toBeTruthy(),
    );

    const [onEvent] = jest.mocked(useRealtimeEvents).mock.calls[0];
    onEvent({
      type: 'message',
      message: {
        id: 'msg-1',
        conversationId: 'conv-1',
        sender: fakeOther,
        body: 'hi',
        readAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    await waitFor(() => expect(screen.getByText('@bob')).toBeTruthy());
    expect(apiClient.conversations.list).toHaveBeenCalledTimes(2);
  });
});
