import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import ExploreScreen from '../app/(tabs)/explore';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    posts: { getExplore: jest.fn() },
  },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

const { router } = jest.requireMock('expo-router') as {
  router: { push: jest.Mock };
};

const fakePost = (id: string) => ({
  id,
  author: {
    id: `user-${id}`,
    username: `user_${id}`,
    fullName: null,
    avatarUrl: null,
  },
  caption: null,
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
  likesCount: 5,
  commentsCount: 0,
  isLikedByMe: false,
  isSavedByMe: false,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('ExploreScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the explore grid heading', async () => {
    jest
      .mocked(apiClient.posts.getExplore)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });

    render(<ExploreScreen />);

    await waitFor(() => expect(apiClient.posts.getExplore).toHaveBeenCalled());
    expect(screen.getByRole('heading')).toHaveTextContent('Explore');
  });

  it('shows an empty-state message when there are no posts to explore', async () => {
    jest
      .mocked(apiClient.posts.getExplore)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });

    render(<ExploreScreen />);

    await waitFor(() =>
      expect(screen.getByText('No posts to explore yet.')).toBeTruthy(),
    );
  });

  it('renders a grid tile per post and navigates to the post on tap', async () => {
    jest.mocked(apiClient.posts.getExplore).mockResolvedValue({
      data: [fakePost('post-1')],
      meta: { nextCursor: null },
    });

    render(<ExploreScreen />);
    await waitFor(() =>
      expect(screen.getByTestId('explore-tile-post-1')).toBeTruthy(),
    );

    fireEvent.press(screen.getByTestId('explore-tile-post-1'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/post/[id]',
      params: { id: 'post-1' },
    });
  });

  it('loads the next page on reaching the end of the list', async () => {
    jest
      .mocked(apiClient.posts.getExplore)
      .mockResolvedValueOnce({
        data: [fakePost('post-1')],
        meta: { nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        data: [fakePost('post-2')],
        meta: { nextCursor: null },
      });

    render(<ExploreScreen />);
    await waitFor(() =>
      expect(screen.getByTestId('explore-tile-post-1')).toBeTruthy(),
    );

    fireEvent(screen.getByTestId('explore-grid'), 'onEndReached');

    await waitFor(() => {
      expect(apiClient.posts.getExplore).toHaveBeenCalledWith({
        cursor: 'cursor-1',
      });
      expect(screen.getByTestId('explore-tile-post-2')).toBeTruthy();
    });
  });
});
