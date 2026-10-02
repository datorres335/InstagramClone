import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import SettingsScreen from '../app/profile/settings';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    users: {
      changePassword: jest.fn(),
      changeEmail: jest.fn(),
      deleteAccount: jest.fn(),
    },
  },
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
  bio: null,
  websiteUrl: null,
  isPrivate: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('SettingsScreen', () => {
  const setUser = jest.fn();
  const logout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({
      user: fakeUser as never,
      loading: false,
      setUser,
      logout,
    });
  });

  it('redirects to login when there is no session', () => {
    jest.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      setUser,
      logout,
    });

    render(<SettingsScreen />);

    expect(Redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/(auth)/login' }),
      undefined,
    );
  });

  describe('change password', () => {
    it('changes the password and shows a success message', async () => {
      jest.mocked(apiClient.users.changePassword).mockResolvedValue(undefined);

      render(<SettingsScreen />);
      fireEvent.changeText(
        screen.getByLabelText('Current password'),
        'old-password',
      );
      fireEvent.changeText(
        screen.getByLabelText('New password'),
        'new-password',
      );
      fireEvent.press(screen.getByRole('button', { name: 'Change password' }));

      await waitFor(() => {
        expect(apiClient.users.changePassword).toHaveBeenCalledWith({
          currentPassword: 'old-password',
          newPassword: 'new-password',
        });
      });
      expect(await screen.findByText('Password changed.')).toBeTruthy();
    });

    it('shows an error on failure', async () => {
      jest
        .mocked(apiClient.users.changePassword)
        .mockRejectedValue(new Error('network down'));

      render(<SettingsScreen />);
      fireEvent.press(screen.getByRole('button', { name: 'Change password' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Something went wrong. Please try again.',
        );
      });
    });
  });

  describe('change email', () => {
    it('changes the email, updates the auth context, and shows a success message', async () => {
      const updated = { ...fakeUser, email: 'new@example.com' };
      jest
        .mocked(apiClient.users.changeEmail)
        .mockResolvedValue(updated as never);

      render(<SettingsScreen />);
      fireEvent.changeText(
        screen.getByLabelText('New email'),
        'new@example.com',
      );
      fireEvent.changeText(
        screen.getByLabelText('Current password for email change'),
        'old-password',
      );
      fireEvent.press(screen.getByRole('button', { name: 'Change email' }));

      await waitFor(() => {
        expect(apiClient.users.changeEmail).toHaveBeenCalledWith({
          newEmail: 'new@example.com',
          currentPassword: 'old-password',
        });
      });
      expect(setUser).toHaveBeenCalledWith(updated);
      expect(await screen.findByText('Email changed.')).toBeTruthy();
    });
  });

  describe('delete account', () => {
    it('is disabled until the confirmation switch is on', async () => {
      render(<SettingsScreen />);

      fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));

      expect(apiClient.users.deleteAccount).not.toHaveBeenCalled();
    });

    it('deletes the account, clears the session, and navigates to login once confirmed', async () => {
      jest.mocked(apiClient.users.deleteAccount).mockResolvedValue(undefined);

      render(<SettingsScreen />);
      fireEvent.changeText(
        screen.getByLabelText('Current password for account deletion'),
        'old-password',
      );
      fireEvent(
        screen.getByLabelText('Confirm permanent account deletion'),
        'onValueChange',
        true,
      );
      fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));

      await waitFor(() => {
        expect(apiClient.users.deleteAccount).toHaveBeenCalledWith({
          currentPassword: 'old-password',
        });
      });
      expect(setUser).toHaveBeenCalledWith(null);
      expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
    });

    it('shows an error and does not navigate on failure', async () => {
      jest
        .mocked(apiClient.users.deleteAccount)
        .mockRejectedValue(new Error('network down'));

      render(<SettingsScreen />);
      fireEvent.changeText(
        screen.getByLabelText('Current password for account deletion'),
        'old-password',
      );
      fireEvent(
        screen.getByLabelText('Confirm permanent account deletion'),
        'onValueChange',
        true,
      );
      fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Something went wrong. Please try again.',
        );
      });
      expect(router.replace).not.toHaveBeenCalled();
    });
  });
});
