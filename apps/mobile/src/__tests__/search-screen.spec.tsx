import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import SearchScreen from '../app/(tabs)/search';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    search: { searchUsers: jest.fn() },
    follows: { follow: jest.fn(), unfollow: jest.fn() },
  },
}));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Link: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});

const fakeResult = (username: string) => ({
  id: `user-${username}`,
  username,
  fullName: null,
  avatarUrl: null,
  isFollowedByMe: null,
});

describe('SearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not search below the 2-character minimum', () => {
    render(<SearchScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText(/search by username/i),
      'a',
    );
    jest.advanceTimersByTime(300);

    expect(apiClient.search.searchUsers).not.toHaveBeenCalled();
  });

  it('searches after the debounce interval for a 2+ character query', async () => {
    jest.mocked(apiClient.search.searchUsers).mockResolvedValue({
      data: [fakeResult('alice')],
      meta: { nextCursor: null },
    });

    render(<SearchScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText(/search by username/i),
      'al',
    );

    // Not called yet — still inside the debounce window.
    expect(apiClient.search.searchUsers).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(300);

    expect(apiClient.search.searchUsers).toHaveBeenCalledWith({ q: 'al' });
    await waitFor(() => expect(screen.getByText('@alice')).toBeTruthy());
  });

  it('shows an empty-state message when nothing matches', async () => {
    jest
      .mocked(apiClient.search.searchUsers)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });

    render(<SearchScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText(/search by username/i),
      'zz',
    );
    await jest.advanceTimersByTimeAsync(300);

    await waitFor(() =>
      expect(screen.getByText('No results found.')).toBeTruthy(),
    );
  });

  it('debounces rapid typing into a single request for the final value', async () => {
    jest
      .mocked(apiClient.search.searchUsers)
      .mockResolvedValue({ data: [], meta: { nextCursor: null } });

    render(<SearchScreen />);
    const input = screen.getByPlaceholderText(/search by username/i);
    fireEvent.changeText(input, 'al');
    jest.advanceTimersByTime(100);
    fireEvent.changeText(input, 'ali');
    jest.advanceTimersByTime(100);
    fireEvent.changeText(input, 'alic');

    await jest.advanceTimersByTimeAsync(300);

    expect(apiClient.search.searchUsers).toHaveBeenCalledTimes(1);
    expect(apiClient.search.searchUsers).toHaveBeenCalledWith({ q: 'alic' });
  });
});
