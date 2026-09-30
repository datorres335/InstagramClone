import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import PostLikesScreen from '../app/post/likes';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    likes: {
      getLikers: jest.fn(),
      like: jest.fn(),
      unlike: jest.fn(),
    },
    follows: {
      follow: jest.fn(),
      unfollow: jest.fn(),
    },
  },
}));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    useLocalSearchParams: jest.fn(() => ({ postId: 'post-1' })),
    Link: ({
      children,
      ...props
    }: { children: React.ReactNode } & Record<string, unknown>) => (
      <Text {...props}>{children}</Text>
    ),
  };
});

const fakeItem = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'user-2',
  username: 'bob',
  fullName: 'Bob Builder',
  avatarUrl: null,
  isFollowedByMe: null,
  ...overrides,
});

describe('PostLikesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading indicator, then the fetched likers list', async () => {
    jest.mocked(apiClient.likes.getLikers).mockResolvedValue({
      data: [fakeItem()],
      meta: { nextCursor: null },
    });

    render(<PostLikesScreen />);
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();

    await waitFor(() => expect(screen.getByText(/Bob Builder/)).toBeTruthy());
    expect(apiClient.likes.getLikers).toHaveBeenCalledWith('post-1');
  });

  it('shows an empty state when the post has no likes', async () => {
    jest.mocked(apiClient.likes.getLikers).mockResolvedValue({
      data: [],
      meta: { nextCursor: null },
    });

    render(<PostLikesScreen />);

    await waitFor(() => expect(screen.getByText('No likes yet.')).toBeTruthy());
  });

  it('toggles follow state on a liker row when pressed', async () => {
    jest.mocked(apiClient.likes.getLikers).mockResolvedValue({
      data: [fakeItem({ isFollowedByMe: false })],
      meta: { nextCursor: null },
    });
    jest.mocked(apiClient.follows.follow).mockResolvedValue(undefined);

    render(<PostLikesScreen />);

    await waitFor(() => expect(screen.getByText('Follow')).toBeTruthy());
    fireEvent.press(screen.getByText('Follow'));

    await waitFor(() => {
      expect(apiClient.follows.follow).toHaveBeenCalledWith('bob');
      expect(screen.getByText('Unfollow')).toBeTruthy();
    });
  });
});
