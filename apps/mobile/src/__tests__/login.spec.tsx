import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import LoginScreen from '../app/(auth)/login';

jest.mock('../lib/api-client', () => ({
  apiClient: { auth: { login: jest.fn() } },
}));
jest.mock('../lib/auth-context', () => ({
  useAuth: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const { router } = jest.requireMock('expo-router') as {
  router: { replace: jest.Mock };
};

describe('LoginScreen', () => {
  const setUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      setUser,
      logout: jest.fn(),
    });
  });

  it('logs in and navigates to the authenticated shell on success', async () => {
    const fakeUser = { id: 'user-1', username: 'alice' };
    jest.mocked(apiClient.auth.login).mockResolvedValue(fakeUser as never);

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByLabelText('Email or username'), 'alice');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getByRole('button'));

    await waitFor(() => {
      expect(apiClient.auth.login).toHaveBeenCalledWith({
        emailOrUsername: 'alice',
        password: 'password123',
      });
    });
    expect(setUser).toHaveBeenCalledWith(fakeUser);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/home');
  });

  it('shows an error and does not navigate on failure', async () => {
    jest
      .mocked(apiClient.auth.login)
      .mockRejectedValue(new Error('network down'));

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByLabelText('Email or username'), 'alice');
    fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    fireEvent.press(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });
    expect(setUser).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
