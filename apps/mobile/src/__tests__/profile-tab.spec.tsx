import { render, screen } from '@testing-library/react-native';

import { useAuth } from '../lib/auth-context';
import ProfileTabScreen from '../app/(tabs)/profile';

jest.mock('../lib/auth-context', () => ({
  useAuth: jest.fn(),
}));
jest.mock('expo-router', () => ({
  Redirect: jest.fn(() => null),
}));

const { Redirect } = jest.requireMock('expo-router') as { Redirect: jest.Mock };

describe('ProfileTabScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading indicator while the session check is in flight', () => {
    jest
      .mocked(useAuth)
      .mockReturnValue({
        user: null,
        loading: true,
        setUser: jest.fn(),
        logout: jest.fn(),
      });

    render(<ProfileTabScreen />);

    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
    expect(Redirect).not.toHaveBeenCalled();
  });

  it('redirects to /profile/<your own username> once loaded', () => {
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', username: 'alice' } as never,
      loading: false,
      setUser: jest.fn(),
      logout: jest.fn(),
    });

    render(<ProfileTabScreen />);

    expect(Redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/profile/alice' }),
      undefined,
    );
  });
});
