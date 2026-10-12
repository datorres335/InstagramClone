import { cleanup, render, screen } from '@testing-library/react';

import type {
  ConversationResponse,
  MessageResponse,
} from '@instagram-clone/validation';

import { ConversationsList } from './conversations-list';

vi.mock('./actions', () => ({ getConversationsPageAction: vi.fn() }));
vi.mock('../../../lib/use-realtime-events', () => ({
  useRealtimeEvents: vi.fn(),
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

const bob = {
  id: '018f2c1e-1234-7abc-89de-abcdef012346',
  username: 'bob',
  fullName: 'Bob Builder',
  avatarUrl: null,
};
const alice = {
  ...bob,
  id: '018f2c1e-1234-7abc-89de-abcdef012349',
  username: 'alice',
  fullName: null,
};

function message(sender: typeof bob, body: string): MessageResponse {
  return {
    id: '018f2c1e-1234-7abc-89de-abcdef012350',
    conversationId: '018f2c1e-1234-7abc-89de-abcdef012345',
    sender,
    body,
    readAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function conversation(
  overrides: Partial<ConversationResponse>,
): ConversationResponse {
  return {
    id: '018f2c1e-1234-7abc-89de-abcdef012345',
    otherParticipants: [bob],
    lastMessage: message(bob, 'hey there'),
    unreadCount: 0,
    lastMessageAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderInbox(conversations: ConversationResponse[]) {
  render(
    <ConversationsList
      initialConversations={conversations}
      initialNextCursor={null}
      viewerUsername="alice"
    />,
  );
}

describe('ConversationsList', () => {
  it("shows the other person's name and their last message", () => {
    renderInbox([conversation({})]);

    expect(screen.getByText('Bob Builder')).toBeTruthy();
    expect(screen.getByText('@bob: hey there')).toBeTruthy();
  });

  it('prefixes your own last message with "You"', () => {
    renderInbox([conversation({ lastMessage: message(alice, 'see you') })]);

    expect(screen.getByText('You: see you')).toBeTruthy();
  });

  it('shows an unread count badge and bold text for unread conversations', () => {
    renderInbox([conversation({ unreadCount: 3 })]);

    // The link reads "Bob Builder @bob: hey there <age>, 3 unread".
    const row = screen.getByRole('link', {
      name: /^Bob Builder @bob: hey there .+, 3 unread$/,
    });
    expect(
      row.querySelector('.bg-primary [aria-hidden="true"]')?.textContent,
    ).toBe('3');
    expect(
      screen.getByText('Bob Builder').classList.contains('font-semibold'),
    ).toBe(true);
  });

  it('shows no badge and regular text once everything is read', () => {
    renderInbox([conversation({ unreadCount: 0 })]);

    const row = screen.getByRole('link', { name: /Bob Builder/ });
    expect(row.querySelector('.bg-primary')).toBeNull();
    expect(screen.queryByText(/unread/)).toBeNull();
    expect(
      screen.getByText('Bob Builder').classList.contains('font-semibold'),
    ).toBe(false);
  });

  it('shows the empty state with no conversations', () => {
    renderInbox([]);

    expect(screen.getByText('No conversations yet.')).toBeTruthy();
  });
});
