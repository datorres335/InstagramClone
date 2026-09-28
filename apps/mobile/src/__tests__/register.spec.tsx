import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import RegisterScreen from '../app/(auth)/register';

jest.mock('../lib/api-client', () => ({
  apiClient: { auth: { register: jest.fn() } },
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

describe('RegisterScreen', () => {
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

  it('registers and navigates to the authenticated shell on success', async () => {
    const fakeUser = { id: 'user-1', username: 'alice' };
    jest.mocked(apiClient.auth.register).mockResolvedValue(fakeUser as never);

    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'alice@example.com');
    fireEvent.changeText(screen.getByLabelText('Username'), 'alice');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getByRole('button'));

    await waitFor(() => {
      expect(apiClient.auth.register).toHaveBeenCalledWith({
        email: 'alice@example.com',
        username: 'alice',
        password: 'password123',
      });
    });
    expect(setUser).toHaveBeenCalledWith(fakeUser);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/home');
  });

  it('shows a conflict error and does not navigate on a duplicate account', async () => {
    const { ApiError } = jest.requireActual('@instagram-clone/api-client');
    jest.mocked(apiClient.auth.register).mockRejectedValue(
      new ApiError({
        type: 'x',
        title: 'Conflict',
        status: 409,
        detail: 'Email or username is already taken.',
      }),
    );

    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'alice@example.com');
    fireEvent.changeText(screen.getByLabelText('Username'), 'alice');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Email or username is already taken.',
      );
    });
    expect(setUser).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
