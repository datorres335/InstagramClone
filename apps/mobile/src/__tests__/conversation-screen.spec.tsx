import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { ApiError } from '@instagram-clone/api-client';

import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { useRealtimeEvents } from '../lib/realtime';
import ConversationScreen from '../app/conversation/[id]';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    conversations: {
      get: jest.fn(),
      listMessages: jest.fn(),
      sendMessage: jest.fn(),
    },
  },
}));
jest.mock('../lib/auth-context', () => ({
  useAuth: jest.fn(),
}));
jest.mock('../lib/realtime', () => ({ useRealtimeEvents: jest.fn() }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'conv-1' })),
}));

const fakeSelf = {
  id: 'user-1',
  username: 'alice',
  fullName: null,
  avatarUrl: null,
};
const fakeOther = {
  id: 'user-2',
  username: 'bob',
  fullName: null,
  avatarUrl: null,
};

const fakeConversation = {
  id: 'conv-1',
  otherParticipants: [fakeOther],
  lastMessage: null,
  unreadCount: 0,
  lastMessageAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const fakeMessage = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  conversationId: 'conv-1',
  sender: fakeOther,
  body: 'hi',
  readAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('ConversationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({
      user: fakeSelf,
      loading: false,
    } as never);
  });

  it('renders the other participant and their messages', async () => {
    jest
      .mocked(apiClient.conversations.get)
      .mockResolvedValue(fakeConversation);
    jest.mocked(apiClient.conversations.listMessages).mockResolvedValue({
      data: [fakeMessage('msg-1', { body: 'hello alice' })],
      meta: { nextCursor: null },
    });

    render(<ConversationScreen />);

    await waitFor(() => expect(screen.getByText('@bob')).toBeTruthy());
    expect(screen.getByText('hello alice')).toBeTruthy();
  });

  it('sends a message and appends it to the thread', async () => {
    jest
      .mocked(apiClient.conversations.get)
      .mockResolvedValue(fakeConversation);
    jest
      .mocked(apiClient.conversations.listMessages)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });
    jest
      .mocked(apiClient.conversations.sendMessage)
      .mockResolvedValue(
        fakeMessage('msg-new', { sender: fakeSelf, body: 'hey bob' }),
      );

    render(<ConversationScreen />);
    await waitFor(() => expect(screen.getByText('@bob')).toBeTruthy());

    fireEvent.changeText(screen.getByLabelText('Message'), 'hey bob');
    fireEvent.press(screen.getByText('Send'));

    await waitFor(() => {
      expect(apiClient.conversations.sendMessage).toHaveBeenCalledWith(
        'conv-1',
        'hey bob',
      );
      expect(screen.getByText('hey bob')).toBeTruthy();
    });
  });

  it('shows a not-found message for a 403/404 (membership check)', async () => {
    jest.mocked(apiClient.conversations.get).mockRejectedValue(
      new ApiError({
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'not a participant',
        instance: '/conversations/conv-1',
      }),
    );
    jest
      .mocked(apiClient.conversations.listMessages)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });

    render(<ConversationScreen />);

    await waitFor(() =>
      expect(screen.getByText('Conversation not found')).toBeTruthy(),
    );
  });

  it('appends a pushed message event for this conversation without re-fetching', async () => {
    jest
      .mocked(apiClient.conversations.get)
      .mockResolvedValue(fakeConversation);
    jest
      .mocked(apiClient.conversations.listMessages)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });

    render(<ConversationScreen />);
    await waitFor(() => expect(screen.getByText('@bob')).toBeTruthy());

    const [onEvent] = jest.mocked(useRealtimeEvents).mock.calls[0];
    onEvent({
      type: 'message',
      message: fakeMessage('msg-pushed', { body: 'pushed live' }),
    });

    await waitFor(() => expect(screen.getByText('pushed live')).toBeTruthy());
    expect(apiClient.conversations.listMessages).toHaveBeenCalledTimes(1);
  });

  it('ignores a pushed message event for a different conversation', async () => {
    jest
      .mocked(apiClient.conversations.get)
      .mockResolvedValue(fakeConversation);
    jest
      .mocked(apiClient.conversations.listMessages)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });

    render(<ConversationScreen />);
    await waitFor(() => expect(screen.getByText('@bob')).toBeTruthy());

    const [onEvent] = jest.mocked(useRealtimeEvents).mock.calls[0];
    onEvent({
      type: 'message',
      message: {
        ...fakeMessage('msg-other', { body: 'not for this thread' }),
        conversationId: 'conv-other',
      },
    });

    expect(screen.queryByText('not for this thread')).toBeNull();
  });
});
