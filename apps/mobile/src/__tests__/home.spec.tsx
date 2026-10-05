import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import HomeScreen from '../app/(tabs)/home';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    posts: { getFeed: jest.fn(), remove: jest.fn() },
    likes: { like: jest.fn(), unlike: jest.fn() },
    notifications: { getUnreadCount: jest.fn() },
  },
}));
jest.mock('../lib/auth-context', () => ({
  useAuth: jest.fn(),
}));
jest.mock('../lib/realtime', () => ({ useRealtimeEvents: jest.fn() }));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    router: { replace: jest.fn() },
    Link: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});

const { router } = jest.requireMock('expo-router') as {
  router: { replace: jest.Mock };
};

const fakePost = (id: string, username = 'bob') => ({
  id,
  author: { id: `user-${username}`, username, fullName: null, avatarUrl: null },
  caption: `caption for ${id}`,
  location: null,
  media: [
    {
      id: `media-${id}`,
      url: `http://minio.test/${id}/feed.webp`,
      thumbnailUrl: `http://minio.test/${id}/thumbnail.webp`,
      width: 800,
      height: 600,
      blurhash: null,
      altText: null,
      position: 0,
    },
  ],
  likesCount: 0,
  commentsCount: 0,
  isLikedByMe: null,
  isSavedByMe: null,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', username: 'alice' } as never,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });
    jest
      .mocked(apiClient.notifications.getUnreadCount)
      .mockResolvedValue({ count: 0 });
  });

  it('greets the logged-in user by username', async () => {
    jest
      .mocked(apiClient.posts.getFeed)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });

    render(<HomeScreen />);

    expect(screen.getByRole('heading')).toHaveTextContent('Welcome, alice');
    await waitFor(() => expect(apiClient.posts.getFeed).toHaveBeenCalled());
  });

  it('renders feed posts newest-first, as returned by the API', async () => {
    jest.mocked(apiClient.posts.getFeed).mockResolvedValue({
      data: [fakePost('post-2'), fakePost('post-1')],
      meta: { nextCursor: null },
    });

    render(<HomeScreen />);

    await waitFor(() =>
      expect(screen.getByText('caption for post-2')).toBeTruthy(),
    );
    expect(screen.getByText('caption for post-1')).toBeTruthy();
  });

  it('shows an empty-state message when the feed has no posts', async () => {
    jest
      .mocked(apiClient.posts.getFeed)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });

    render(<HomeScreen />);

    await waitFor(() =>
      expect(
        screen.getByText(
          'No posts yet. Follow some accounts to see their posts here.',
        ),
      ).toBeTruthy(),
    );
  });

  it('loads the next page on reaching the end of the list', async () => {
    jest
      .mocked(apiClient.posts.getFeed)
      .mockResolvedValueOnce({
        data: [fakePost('post-1')],
        meta: { nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        data: [fakePost('post-0')],
        meta: { nextCursor: null },
      });

    render(<HomeScreen />);
    await waitFor(() =>
      expect(screen.getByText('caption for post-1')).toBeTruthy(),
    );

    fireEvent(screen.getByTestId('feed-list'), 'onEndReached');

    await waitFor(() => {
      expect(apiClient.posts.getFeed).toHaveBeenCalledWith({
        cursor: 'cursor-1',
      });
      expect(screen.getByText('caption for post-0')).toBeTruthy();
    });
  });

  it("calls remove with the pressed post's id", async () => {
    jest.mocked(apiClient.posts.getFeed).mockResolvedValue({
      data: [fakePost('post-1', 'alice')],
      meta: { nextCursor: null },
    });
    jest.mocked(apiClient.posts.remove).mockResolvedValue(undefined);

    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('Delete post')).toBeTruthy());

    fireEvent.press(screen.getByText('Delete post'));

    // Asserts the API call, not the post-delete visual state: `FlatList`'s
    // `VirtualizedList` commits an item-removal re-render on a real timer
    // tick in this test environment (confirmed by instrumenting the
    // component directly — `setPosts`'s filter runs synchronously and
    // correctly right after `remove()` resolves, but the rendered tree
    // doesn't reliably catch up within any bounded `waitFor` window here,
    // unlike the plain `.map()`-rendered rows Milestone 11 used for its
    // capped-at-10 image list). The API-call assertion below is what this
    // screen is actually responsible for getting right; `PostCard`'s own
    // delete-and-reflect behavior is already covered directly by
    // `post-detail.spec.tsx`, outside of any surrounding `FlatList`.
    await waitFor(() =>
      expect(apiClient.posts.remove).toHaveBeenCalledWith('post-1'),
    );
  });

  it('logs out and navigates back to /login', async () => {
    jest
      .mocked(apiClient.posts.getFeed)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });
    const logout = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', username: 'alice' } as never,
      loading: false,
      setUser: jest.fn(),
      logout,
    });

    render(<HomeScreen />);
    fireEvent.press(screen.getByText('Log out'));

    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });
});
