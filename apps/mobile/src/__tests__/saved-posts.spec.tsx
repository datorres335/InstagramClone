import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import SavedPostsScreen from '../app/profile/saved';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    savedPosts: { getSaved: jest.fn() },
    posts: { remove: jest.fn() },
  },
}));
jest.mock('../lib/auth-context', () => ({
  useAuth: jest.fn(),
}));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Link: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});

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

describe('SavedPostsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', username: 'alice' } as never,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });
  });

  it('renders saved posts newest-first, as returned by the API', async () => {
    jest.mocked(apiClient.savedPosts.getSaved).mockResolvedValue({
      data: [fakePost('post-2'), fakePost('post-1')],
      meta: { nextCursor: null },
    });

    render(<SavedPostsScreen />);

    await waitFor(() =>
      expect(screen.getByText('caption for post-2')).toBeTruthy(),
    );
    expect(screen.getByText('caption for post-1')).toBeTruthy();
  });

  it('shows an empty-state message when there are no saved posts', async () => {
    jest
      .mocked(apiClient.savedPosts.getSaved)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });

    render(<SavedPostsScreen />);

    await waitFor(() =>
      expect(screen.getByText('No saved posts yet.')).toBeTruthy(),
    );
  });

  it('loads the next page on reaching the end of the list', async () => {
    jest
      .mocked(apiClient.savedPosts.getSaved)
      .mockResolvedValueOnce({
        data: [fakePost('post-1')],
        meta: { nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        data: [fakePost('post-0')],
        meta: { nextCursor: null },
      });

    render(<SavedPostsScreen />);
    await waitFor(() =>
      expect(screen.getByText('caption for post-1')).toBeTruthy(),
    );

    fireEvent(screen.getByTestId('saved-posts-list'), 'onEndReached');

    await waitFor(() => {
      expect(apiClient.savedPosts.getSaved).toHaveBeenCalledWith({
        cursor: 'cursor-1',
      });
      expect(screen.getByText('caption for post-0')).toBeTruthy();
    });
  });

  it("calls remove with the pressed post's id for the viewer's own saved post", async () => {
    jest.mocked(apiClient.savedPosts.getSaved).mockResolvedValue({
      data: [fakePost('post-1', 'alice')],
      meta: { nextCursor: null },
    });
    jest.mocked(apiClient.posts.remove).mockResolvedValue(undefined);

    render(<SavedPostsScreen />);
    await waitFor(() => expect(screen.getByText('Delete post')).toBeTruthy());

    fireEvent.press(screen.getByText('Delete post'));

    await waitFor(() =>
      expect(apiClient.posts.remove).toHaveBeenCalledWith('post-1'),
    );
  });
});
