import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import FollowersScreen from '../app/profile/followers';
import FollowingScreen from '../app/profile/following';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    follows: {
      getFollowers: jest.fn(),
      getFollowing: jest.fn(),
      follow: jest.fn(),
      unfollow: jest.fn(),
    },
  },
}));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    useLocalSearchParams: jest.fn(() => ({ username: 'alice' })),
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

describe('FollowersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading indicator, then the fetched list', async () => {
    jest.mocked(apiClient.follows.getFollowers).mockResolvedValue({
      data: [fakeItem()],
      meta: { nextCursor: null },
    });

    render(<FollowersScreen />);
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();

    await waitFor(() => expect(screen.getByText(/Bob Builder/)).toBeTruthy());
    expect(apiClient.follows.getFollowers).toHaveBeenCalledWith('alice');
  });

  it('shows an empty state when there are no followers', async () => {
    jest.mocked(apiClient.follows.getFollowers).mockResolvedValue({
      data: [],
      meta: { nextCursor: null },
    });

    render(<FollowersScreen />);

    await waitFor(() =>
      expect(screen.getByText('No followers yet.')).toBeTruthy(),
    );
  });

  it('renders no follow button for an anonymous viewer (isFollowedByMe null)', async () => {
    jest.mocked(apiClient.follows.getFollowers).mockResolvedValue({
      data: [fakeItem({ isFollowedByMe: null })],
      meta: { nextCursor: null },
    });

    render(<FollowersScreen />);

    await waitFor(() => expect(screen.getByText(/Bob Builder/)).toBeTruthy());
    expect(screen.queryByText('Follow')).toBeNull();
    expect(screen.queryByText('Unfollow')).toBeNull();
  });

  it('toggles follow state on a row when pressed', async () => {
    jest.mocked(apiClient.follows.getFollowers).mockResolvedValue({
      data: [fakeItem({ isFollowedByMe: false })],
      meta: { nextCursor: null },
    });
    jest.mocked(apiClient.follows.follow).mockResolvedValue(undefined);

    render(<FollowersScreen />);

    await waitFor(() => expect(screen.getByText('Follow')).toBeTruthy());
    fireEvent.press(screen.getByText('Follow'));

    await waitFor(() => {
      expect(apiClient.follows.follow).toHaveBeenCalledWith('bob');
      expect(screen.getByText('Unfollow')).toBeTruthy();
    });
  });
});

describe('FollowingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and renders who the target user follows', async () => {
    jest.mocked(apiClient.follows.getFollowing).mockResolvedValue({
      data: [fakeItem({ username: 'carol', fullName: 'Carol' })],
      meta: { nextCursor: null },
    });

    render(<FollowingScreen />);

    await waitFor(() => expect(screen.getByText(/Carol/)).toBeTruthy());
    expect(apiClient.follows.getFollowing).toHaveBeenCalledWith('alice');
  });

  it('shows an empty state when following no one', async () => {
    jest.mocked(apiClient.follows.getFollowing).mockResolvedValue({
      data: [],
      meta: { nextCursor: null },
    });

    render(<FollowingScreen />);

    await waitFor(() =>
      expect(screen.getByText('Not following anyone yet.')).toBeTruthy(),
    );
  });
});
