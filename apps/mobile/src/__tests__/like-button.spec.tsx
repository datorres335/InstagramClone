import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { MaterialIcons } from '@expo/vector-icons';
import { renderWithTheme } from '../test-support/render-with-theme';
import { apiClient } from '../lib/api-client';
import { LikeButton } from '../components/like-button';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    likes: { like: jest.fn(), unlike: jest.fn() },
  },
}));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Link: ({
      children,
      ...props
    }: { children: React.ReactNode } & Record<string, unknown>) => (
      <Text {...props}>{children}</Text>
    ),
  };
});

describe('LikeButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('likes a post and increments the count', async () => {
    jest.mocked(apiClient.likes.like).mockResolvedValue(undefined);
    render(
      <LikeButton
        postId="post-1"
        initialIsLiked={false}
        initialLikesCount={3}
      />,
    );

    expect(screen.getByText('3 likes')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Like' }));

    await waitFor(() => {
      expect(apiClient.likes.like).toHaveBeenCalledWith('post-1');
      expect(screen.getByRole('button', { name: 'Unlike' })).toBeTruthy();
      expect(screen.getByText('4 likes')).toBeTruthy();
    });
  });

  it('unlikes a post and decrements the count', async () => {
    jest.mocked(apiClient.likes.unlike).mockResolvedValue(undefined);
    render(
      <LikeButton
        postId="post-1"
        initialIsLiked={true}
        initialLikesCount={3}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Unlike' }));

    await waitFor(() => {
      expect(apiClient.likes.unlike).toHaveBeenCalledWith('post-1');
      expect(screen.getByRole('button', { name: 'Like' })).toBeTruthy();
      expect(screen.getByText('2 likes')).toBeTruthy();
    });
  });

  it('shows an error and leaves the count unchanged when the API call fails', async () => {
    jest.mocked(apiClient.likes.like).mockRejectedValue(new Error('boom'));
    render(
      <LikeButton
        postId="post-1"
        initialIsLiked={false}
        initialLikesCount={3}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Like' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Like' })).toBeTruthy();
    expect(screen.getByText('3 likes')).toBeTruthy();
  });
  it.each([
    [false, 'Like', 'favorite-border'],
    [true, 'Unlike', 'favorite'],
  ])(
    'liked=%s shows the %s name, the %s icon and the matching selected state',
    (isLiked, name, icon) => {
      const { UNSAFE_getByType } = renderWithTheme(
        <LikeButton
          postId="post-1"
          initialIsLiked={isLiked}
          initialLikesCount={3}
        />,
      );

      expect(
        screen.getByRole('button', { name, selected: isLiked }),
      ).toBeTruthy();
      expect(UNSAFE_getByType(MaterialIcons).props.name).toBe(icon);
    },
  );
});
