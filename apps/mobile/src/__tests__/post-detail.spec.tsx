import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { ApiError } from '@instagram-clone/api-client';

import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import PostScreen from '../app/post/[id]';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    posts: { getById: jest.fn(), remove: jest.fn() },
  },
}));
jest.mock('../lib/auth-context', () => ({
  useAuth: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'post-1' })),
  router: { replace: jest.fn() },
}));

const { router } = jest.requireMock('expo-router') as {
  router: { replace: jest.Mock };
};

const fakePost = {
  id: 'post-1',
  author: {
    id: 'user-1',
    username: 'alice',
    fullName: 'Alice Anderson',
    avatarUrl: null,
  },
  caption: 'Hello world',
  location: 'San Francisco',
  media: [
    {
      id: 'media-1',
      url: 'http://minio.test/media-1/feed.webp',
      thumbnailUrl: 'http://minio.test/media-1/thumbnail.webp',
      width: 800,
      height: 600,
      blurhash: null,
      altText: null,
      position: 0,
    },
  ],
  likesCount: 2,
  commentsCount: 1,
  isLikedByMe: null,
  isSavedByMe: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('PostScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the post once it loads', async () => {
    jest.mocked(apiClient.posts.getById).mockResolvedValue(fakePost);
    jest.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });

    render(<PostScreen />);

    await waitFor(() =>
      expect(screen.getByRole('heading')).toHaveTextContent('@alice'),
    );
    expect(screen.getByText('Hello world')).toBeTruthy();
    expect(screen.getByText('San Francisco')).toBeTruthy();
    expect(screen.getByText('2 likes · 1 comments')).toBeTruthy();
    expect(apiClient.posts.getById).toHaveBeenCalledWith('post-1');
  });

  it('shows a not-found state for a 404', async () => {
    jest
      .mocked(apiClient.posts.getById)
      .mockRejectedValue(
        new ApiError({ type: 'x', title: 'Not Found', status: 404 }),
      );
    jest.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });

    render(<PostScreen />);

    await waitFor(() =>
      expect(screen.getByRole('heading')).toHaveTextContent('Post not found'),
    );
  });

  it('shows a delete button only for the post author', async () => {
    jest.mocked(apiClient.posts.getById).mockResolvedValue(fakePost);
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', username: 'alice' } as never,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });

    render(<PostScreen />);

    await waitFor(() => expect(screen.getByText('Delete post')).toBeTruthy());
  });

  it('hides the delete button for a non-author viewer', async () => {
    jest.mocked(apiClient.posts.getById).mockResolvedValue(fakePost);
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-2', username: 'bob' } as never,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });

    render(<PostScreen />);

    await waitFor(() =>
      expect(screen.getByRole('heading')).toHaveTextContent('@alice'),
    );
    expect(screen.queryByText('Delete post')).toBeNull();
  });

  it('deletes the post and navigates to the author profile', async () => {
    jest.mocked(apiClient.posts.getById).mockResolvedValue(fakePost);
    jest.mocked(apiClient.posts.remove).mockResolvedValue(undefined);
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', username: 'alice' } as never,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });

    render(<PostScreen />);
    await waitFor(() => expect(screen.getByText('Delete post')).toBeTruthy());
    fireEvent.press(screen.getByText('Delete post'));

    await waitFor(() => {
      expect(apiClient.posts.remove).toHaveBeenCalledWith('post-1');
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/profile/[username]',
        params: { username: 'alice' },
      });
    });
  });
});
