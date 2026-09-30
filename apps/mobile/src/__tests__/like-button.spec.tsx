import * as React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

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
    fireEvent.press(screen.getByText('Like'));

    await waitFor(() => {
      expect(apiClient.likes.like).toHaveBeenCalledWith('post-1');
      expect(screen.getByText('Unlike')).toBeTruthy();
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

    fireEvent.press(screen.getByText('Unlike'));

    await waitFor(() => {
      expect(apiClient.likes.unlike).toHaveBeenCalledWith('post-1');
      expect(screen.getByText('Like')).toBeTruthy();
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

    fireEvent.press(screen.getByText('Like'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Like')).toBeTruthy();
    expect(screen.getByText('3 likes')).toBeTruthy();
  });
});
