import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { useAuth } from '../lib/auth-context';
import HomeScreen from '../app/(tabs)/home';

jest.mock('../lib/auth-context', () => ({
  useAuth: jest.fn(),
}));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    router: { replace: jest.fn() },
    Link: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});

const { router } = jest.requireMock('expo-router') as {
  router: { replace: jest.Mock };
};

describe('HomeScreen', () => {
  it('greets the logged-in user by username', () => {
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', username: 'alice' } as never,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });

    render(<HomeScreen />);

    expect(screen.getByRole('heading')).toHaveTextContent('Welcome, alice');
  });

  it('logs out and navigates back to /login', async () => {
    const logout = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', username: 'alice' } as never,
      loading: false,
      setUser: jest.fn(),
      logout,
    });

    render(<HomeScreen />);
    fireEvent.press(screen.getByRole('button'));

    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });
});
