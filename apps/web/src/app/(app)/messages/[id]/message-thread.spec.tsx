import { cleanup, render, screen } from '@testing-library/react';

import type { MessageResponse } from '@instagram-clone/validation';

import { MessageThread } from './message-thread';

vi.mock('../actions', () => ({
  getMessagesPageAction: vi.fn(),
  sendMessageAction: vi.fn(),
}));
vi.mock('../../../../lib/use-realtime-events', () => ({
  useRealtimeEvents: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

const conversationId = '018f2c1e-1234-7abc-89de-abcdef012345';

function message(
  id: string,
  username: string,
  body: string,
  readAt: string | null = null,
): MessageResponse {
  return {
    id,
    conversationId,
    sender: {
      id: `018f2c1e-1234-7abc-89de-${id.padStart(12, '0')}`,
      username,
      fullName: null,
      avatarUrl: null,
    },
    body,
    readAt,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderThread(messages: MessageResponse[]) {
  render(
    <MessageThread
      conversationId={conversationId}
      initialMessages={messages}
      initialNextCursor={null}
      viewerUsername="alice"
    />,
  );
}

/** The bubble holding `body`, and the row that positions it. */
function bubble(body: string) {
  const element = screen.getByText(body);
  return { bubble: element, row: element.closest('li') };
}

describe('MessageThread', () => {
  it('puts your own messages on the right in the primary color', () => {
    renderThread([message('1', 'alice', 'hi bob')]);

    const { bubble: own, row } = bubble('hi bob');
    expect(row?.classList.contains('items-end')).toBe(true);
    expect(own.classList.contains('bg-primary')).toBe(true);
    expect(own.classList.contains('text-on-primary')).toBe(true);
  });

  it("puts the other person's messages on the left on the surface color", () => {
    renderThread([message('1', 'bob', 'hi alice')]);

    const { bubble: theirs, row } = bubble('hi alice');
    expect(row?.classList.contains('items-start')).toBe(true);
    expect(theirs.classList.contains('bg-surface-variant')).toBe(true);
    expect(theirs.classList.contains('bg-primary')).toBe(false);
  });

  it('names the sender of each bubble for screen readers', () => {
    renderThread([
      message('1', 'bob', 'hi alice'),
      message('2', 'alice', 'hi bob'),
    ]);

    expect(bubble('hi alice').bubble.textContent).toBe('@bob: hi alice');
    expect(bubble('hi bob').bubble.textContent).toBe('You: hi bob');
  });

  it('shows "Seen" under your latest message once it has been read', () => {
    renderThread([
      message('1', 'bob', 'hi alice'),
      message('2', 'alice', 'hi bob', '2026-01-01T00:01:00.000Z'),
    ]);

    expect(bubble('hi bob').row?.textContent).toContain('Seen');
  });

  it('shows no "Seen" while your latest message is unread', () => {
    renderThread([message('1', 'alice', 'hi bob')]);

    expect(screen.queryByText('Seen')).toBeNull();
  });
});
