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
import ProfileScreen from '../app/profile/[username]';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    users: { getProfile: jest.fn() },
    follows: {
      follow: jest.fn(),
      unfollow: jest.fn(),
    },
  },
}));
jest.mock('../lib/auth-context', () => ({
  useAuth: jest.fn(),
}));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    useLocalSearchParams: jest.fn(() => ({ username: 'alice' })),
    Link: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
    router: { push: jest.fn() },
  };
});

const { router } = jest.requireMock('expo-router') as {
  router: { push: jest.Mock };
};

const fakeProfile = {
  id: 'user-1',
  username: 'alice',
  fullName: 'Alice Anderson',
  bio: 'Hello world',
  websiteUrl: null,
  avatarUrl: null,
  isPrivate: false,
  postsCount: 0,
  followersCount: 0,
  followingCount: 0,
  isFollowedByMe: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the profile once it loads', async () => {
    jest.mocked(apiClient.users.getProfile).mockResolvedValue(fakeProfile);
    jest.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });

    render(<ProfileScreen />);

    await waitFor(() =>
      expect(screen.getByRole('heading')).toHaveTextContent('alice'),
    );
    expect(screen.getByText('Hello world')).toBeTruthy();
    expect(apiClient.users.getProfile).toHaveBeenCalledWith('alice');
  });

  it('shows an edit link only when viewing your own profile', async () => {
    jest.mocked(apiClient.users.getProfile).mockResolvedValue(fakeProfile);
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', username: 'alice' } as never,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });

    render(<ProfileScreen />);

    await waitFor(() => expect(screen.getByText('Edit profile')).toBeTruthy());
  });

  it('does not show an edit link when viewing someone else’s profile', async () => {
    jest.mocked(apiClient.users.getProfile).mockResolvedValue(fakeProfile);
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-2', username: 'bob' } as never,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });

    render(<ProfileScreen />);

    await waitFor(() =>
      expect(screen.getByRole('heading')).toHaveTextContent('alice'),
    );
    expect(screen.queryByText('Edit profile')).toBeNull();
  });

  it('shows a not-found state for a 404', async () => {
    jest
      .mocked(apiClient.users.getProfile)
      .mockRejectedValue(
        new ApiError({ type: 'x', title: 'Not Found', status: 404 }),
      );
    jest.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });

    render(<ProfileScreen />);

    await waitFor(() =>
      expect(screen.getByRole('heading')).toHaveTextContent('User not found'),
    );
  });

  describe('follow/unfollow', () => {
    it('shows no follow button for an anonymous viewer', async () => {
      jest.mocked(apiClient.users.getProfile).mockResolvedValue({
        ...fakeProfile,
        isFollowedByMe: null,
      });
      jest.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        setUser: jest.fn(),
        logout: jest.fn(),
      });

      render(<ProfileScreen />);

      await waitFor(() =>
        expect(screen.getByRole('heading')).toHaveTextContent('alice'),
      );
      expect(screen.queryByText('Follow')).toBeNull();
      expect(screen.queryByText('Unfollow')).toBeNull();
    });

    it('shows a Follow button and follows on press', async () => {
      jest.mocked(apiClient.users.getProfile).mockResolvedValue({
        ...fakeProfile,
        isFollowedByMe: false,
        followersCount: 4,
      });
      jest.mocked(useAuth).mockReturnValue({
        user: { id: 'user-2', username: 'bob' } as never,
        loading: false,
        setUser: jest.fn(),
        logout: jest.fn(),
      });
      jest.mocked(apiClient.follows.follow).mockResolvedValue(undefined);

      render(<ProfileScreen />);

      await waitFor(() => expect(screen.getByText('Follow')).toBeTruthy());
      fireEvent.press(screen.getByText('Follow'));

      await waitFor(() => {
        expect(apiClient.follows.follow).toHaveBeenCalledWith('alice');
        expect(screen.getByText('Unfollow')).toBeTruthy();
      });
      expect(screen.getByText('5 followers')).toBeTruthy();
    });

    it('shows an Unfollow button and unfollows on press', async () => {
      jest.mocked(apiClient.users.getProfile).mockResolvedValue({
        ...fakeProfile,
        isFollowedByMe: true,
        followersCount: 4,
      });
      jest.mocked(useAuth).mockReturnValue({
        user: { id: 'user-2', username: 'bob' } as never,
        loading: false,
        setUser: jest.fn(),
        logout: jest.fn(),
      });
      jest.mocked(apiClient.follows.unfollow).mockResolvedValue(undefined);

      render(<ProfileScreen />);

      await waitFor(() => expect(screen.getByText('Unfollow')).toBeTruthy());
      fireEvent.press(screen.getByText('Unfollow'));

      await waitFor(() => {
        expect(apiClient.follows.unfollow).toHaveBeenCalledWith('alice');
        expect(screen.getByText('Follow')).toBeTruthy();
      });
      expect(screen.getByText('3 followers')).toBeTruthy();
    });

    it('shows an error and keeps the prior state when the toggle fails', async () => {
      jest.mocked(apiClient.users.getProfile).mockResolvedValue({
        ...fakeProfile,
        isFollowedByMe: false,
      });
      jest.mocked(useAuth).mockReturnValue({
        user: { id: 'user-2', username: 'bob' } as never,
        loading: false,
        setUser: jest.fn(),
        logout: jest.fn(),
      });
      jest
        .mocked(apiClient.follows.follow)
        .mockRejectedValue(new Error('boom'));

      render(<ProfileScreen />);

      await waitFor(() => expect(screen.getByText('Follow')).toBeTruthy());
      fireEvent.press(screen.getByText('Follow'));

      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
      expect(screen.getByText('Follow')).toBeTruthy();
    });
  });

  describe('followers/following navigation', () => {
    it('navigates to the followers list on tap', async () => {
      jest.mocked(apiClient.users.getProfile).mockResolvedValue(fakeProfile);
      jest.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        setUser: jest.fn(),
        logout: jest.fn(),
      });

      render(<ProfileScreen />);

      await waitFor(() => expect(screen.getByText('0 followers')).toBeTruthy());
      fireEvent.press(screen.getByText('0 followers'));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/profile/followers',
        params: { username: 'alice' },
      });
    });

    it('navigates to the following list on tap', async () => {
      jest.mocked(apiClient.users.getProfile).mockResolvedValue(fakeProfile);
      jest.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        setUser: jest.fn(),
        logout: jest.fn(),
      });

      render(<ProfileScreen />);

      await waitFor(() => expect(screen.getByText('0 following')).toBeTruthy());
      fireEvent.press(screen.getByText('0 following'));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/profile/following',
        params: { username: 'alice' },
      });
    });
  });
});
