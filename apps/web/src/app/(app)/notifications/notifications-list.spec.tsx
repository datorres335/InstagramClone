import { cleanup, render, screen } from '@testing-library/react';

import type { NotificationResponse } from '@instagram-clone/validation';

import { NotificationsList } from './notifications-list';

vi.mock('./actions', () => ({ getNotificationsPageAction: vi.fn() }));
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

const actor = {
  id: '018f2c1e-1234-7abc-89de-abcdef012346',
  username: 'bob',
  fullName: null,
  avatarUrl: null,
};

function notification(
  overrides: Partial<NotificationResponse>,
): NotificationResponse {
  return {
    id: '018f2c1e-1234-7abc-89de-abcdef012345',
    type: 'FOLLOW',
    actor,
    post: null,
    comment: null,
    isRead: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderList(notifications: NotificationResponse[]) {
  render(
    <NotificationsList
      initialNotifications={notifications}
      initialNextCursor={null}
    />,
  );
}

describe('NotificationsList', () => {
  it('marks an unread row with "Unread", semibold text and a dot', () => {
    renderList([notification({ isRead: false })]);

    const row = screen.getByRole('link', {
      name: /^Unread: @bob started following you\./,
    });
    expect(row.querySelector('p')?.classList.contains('font-semibold')).toBe(
      true,
    );
    expect(row.querySelector('.bg-primary')).not.toBeNull();
  });

  it('leaves a read row unmarked', () => {
    renderList([notification({ isRead: true })]);

    const row = screen.getByRole('link', {
      name: /^@bob started following you\./,
    });
    expect(row.querySelector('p')?.classList.contains('font-semibold')).toBe(
      false,
    );
    expect(row.querySelector('.bg-primary')).toBeNull();
    expect(screen.queryByText(/Unread/)).toBeNull();
  });

  it("links a follow to the actor's profile", () => {
    renderList([notification({ type: 'FOLLOW' })]);

    expect(
      screen.getByRole('link', { name: /started following you/ }),
    ).toHaveProperty('pathname', '/bob');
  });

  it('links a comment to its post, with the comment and a post thumbnail', () => {
    renderList([
      notification({
        type: 'COMMENT',
        post: {
          id: '018f2c1e-1234-7abc-89de-abcdef012347',
          thumbnailUrl: 'https://cdn.example.com/thumb.webp',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        comment: { id: '018f2c1e-1234-7abc-89de-abcdef012348', body: 'Nice!' },
      }),
    ]);

    const row = screen.getByRole('link', {
      name: /@bob commented: "Nice!"/,
    });
    expect(row).toHaveProperty(
      'pathname',
      '/p/018f2c1e-1234-7abc-89de-abcdef012347',
    );
    expect(row.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example.com/thumb.webp',
    );
  });

  it('shows the empty state with no notifications', () => {
    renderList([]);

    expect(screen.getByText('No notifications yet.')).toBeTruthy();
  });
});
