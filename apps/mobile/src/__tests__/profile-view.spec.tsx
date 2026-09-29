import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@instagram-clone/api-client';

import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import ProfileScreen from '../app/profile/[username]';

jest.mock('../lib/api-client', () => ({
  apiClient: { users: { getProfile: jest.fn() } },
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
  };
});

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
    jest
      .mocked(useAuth)
      .mockReturnValue({
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
    jest
      .mocked(useAuth)
      .mockReturnValue({
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
});
