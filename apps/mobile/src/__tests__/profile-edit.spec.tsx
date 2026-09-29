import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import EditProfileScreen from '../app/profile/edit';

jest.mock('../lib/api-client', () => ({
  apiClient: { users: { updateProfile: jest.fn() } },
}));
jest.mock('../lib/auth-context', () => ({
  useAuth: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  Redirect: jest.fn(() => null),
}));

const { router, Redirect } = jest.requireMock('expo-router') as {
  router: { replace: jest.Mock };
  Redirect: jest.Mock;
};

const fakeUser = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  fullName: 'Alice Anderson',
  bio: 'Old bio',
  websiteUrl: null,
  isPrivate: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('EditProfileScreen', () => {
  const setUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pre-fills the form with the current user values', () => {
    jest
      .mocked(useAuth)
      .mockReturnValue({
        user: fakeUser as never,
        loading: false,
        setUser,
        logout: jest.fn(),
      });

    render(<EditProfileScreen />);

    expect(screen.getByLabelText('Name')).toHaveProp('value', 'Alice Anderson');
    expect(screen.getByLabelText('Bio')).toHaveProp('value', 'Old bio');
  });

  it('saves and navigates to the profile page on success', async () => {
    jest
      .mocked(useAuth)
      .mockReturnValue({
        user: fakeUser as never,
        loading: false,
        setUser,
        logout: jest.fn(),
      });
    const updated = { ...fakeUser, bio: 'New bio' };
    jest
      .mocked(apiClient.users.updateProfile)
      .mockResolvedValue(updated as never);

    render(<EditProfileScreen />);
    fireEvent.changeText(screen.getByLabelText('Bio'), 'New bio');
    fireEvent.press(screen.getByRole('button'));

    await waitFor(() => {
      expect(apiClient.users.updateProfile).toHaveBeenCalledWith({
        fullName: 'Alice Anderson',
        bio: 'New bio',
        websiteUrl: null,
        isPrivate: false,
      });
    });
    expect(setUser).toHaveBeenCalledWith(updated);
    expect(router.replace).toHaveBeenCalledWith('/profile/alice');
  });

  it('shows an error and does not navigate on failure', async () => {
    jest
      .mocked(useAuth)
      .mockReturnValue({
        user: fakeUser as never,
        loading: false,
        setUser,
        logout: jest.fn(),
      });
    jest
      .mocked(apiClient.users.updateProfile)
      .mockRejectedValue(new Error('network down'));

    render(<EditProfileScreen />);
    fireEvent.press(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });
    expect(setUser).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('redirects to login when there is no session', () => {
    jest
      .mocked(useAuth)
      .mockReturnValue({
        user: null,
        loading: false,
        setUser,
        logout: jest.fn(),
      });

    render(<EditProfileScreen />);

    expect(Redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/(auth)/login' }),
      undefined,
    );
  });
});
