import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import SettingsScreen from '../app/profile/settings';
import { renderWithTheme } from '../test-support/render-with-theme';

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

    renderWithTheme(<SettingsScreen />);

    expect(Redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/(auth)/login' }),
      undefined,
    );
  });

  it('logs out and navigates back to /login', async () => {
    logout.mockResolvedValue(undefined);

    renderWithTheme(<SettingsScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  describe('change password', () => {
    it('changes the password and shows a success message', async () => {
      jest.mocked(apiClient.users.changePassword).mockResolvedValue(undefined);

      renderWithTheme(<SettingsScreen />);
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

      renderWithTheme(<SettingsScreen />);
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

      renderWithTheme(<SettingsScreen />);
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
    it('only asks for confirmation when "Delete account" is pressed', async () => {
      renderWithTheme(<SettingsScreen />);

      fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));

      expect(await screen.findByText('Delete your account?')).toBeTruthy();
      expect(apiClient.users.deleteAccount).not.toHaveBeenCalled();
    });

    it("keeps the dialog's Delete button disabled until a password is entered", async () => {
      renderWithTheme(<SettingsScreen />);
      fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));

      fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));

      expect(apiClient.users.deleteAccount).not.toHaveBeenCalled();
    });

    it('deletes the account, clears the session, and navigates to login once confirmed in the dialog', async () => {
      jest.mocked(apiClient.users.deleteAccount).mockResolvedValue(undefined);

      renderWithTheme(<SettingsScreen />);
      fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
      fireEvent.changeText(
        await screen.findByLabelText('Current password for account deletion'),
        'old-password',
      );
      fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

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

      renderWithTheme(<SettingsScreen />);
      fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
      fireEvent.changeText(
        await screen.findByLabelText('Current password for account deletion'),
        'old-password',
      );
      fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Something went wrong. Please try again.',
        );
      });
      expect(router.replace).not.toHaveBeenCalled();
    });
  });
});
