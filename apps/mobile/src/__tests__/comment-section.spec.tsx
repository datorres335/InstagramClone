import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import { CommentSection } from '../components/comment-section';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    comments: {
      create: jest.fn(),
      remove: jest.fn(),
      list: jest.fn(),
    },
  },
}));

const fakeComment = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'comment-1',
  author: {
    id: 'user-2',
    username: 'bob',
    fullName: 'Bob Builder',
    avatarUrl: null,
  },
  body: 'Nice!',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('CommentSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an empty state when there are no comments', () => {
    render(
      <CommentSection
        postId="post-1"
        initialComments={[]}
        initialNextCursor={null}
        viewerUsername="alice"
        postAuthorUsername="alice"
      />,
    );

    expect(screen.getByText('No comments yet.')).toBeTruthy();
  });

  it('posts a new comment and appends it to the list', async () => {
    jest
      .mocked(apiClient.comments.create)
      .mockResolvedValue(fakeComment({ id: 'comment-2', body: 'Great shot' }));

    render(
      <CommentSection
        postId="post-1"
        initialComments={[]}
        initialNextCursor={null}
        viewerUsername="alice"
        postAuthorUsername="alice"
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Add a comment'), 'Great shot');
    fireEvent.press(screen.getByText('Post'));

    await waitFor(() => {
      expect(apiClient.comments.create).toHaveBeenCalledWith('post-1', {
        body: 'Great shot',
      });
      expect(screen.getByText(/Great shot/)).toBeTruthy();
    });
  });

  it('shows a delete control for the comment author', () => {
    render(
      <CommentSection
        postId="post-1"
        initialComments={[fakeComment()]}
        initialNextCursor={null}
        viewerUsername="bob"
        postAuthorUsername="alice"
      />,
    );

    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it("shows a delete control for the post author moderating someone else's comment", () => {
    render(
      <CommentSection
        postId="post-1"
        initialComments={[fakeComment()]}
        initialNextCursor={null}
        viewerUsername="alice"
        postAuthorUsername="alice"
      />,
    );

    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('hides the delete control for a third-party viewer', () => {
    render(
      <CommentSection
        postId="post-1"
        initialComments={[fakeComment()]}
        initialNextCursor={null}
        viewerUsername="carol"
        postAuthorUsername="alice"
      />,
    );

    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('deletes a comment and removes it from the list', async () => {
    jest.mocked(apiClient.comments.remove).mockResolvedValue(undefined);

    render(
      <CommentSection
        postId="post-1"
        initialComments={[fakeComment()]}
        initialNextCursor={null}
        viewerUsername="bob"
        postAuthorUsername="alice"
      />,
    );

    fireEvent.press(screen.getByText('Delete'));

    // Explicit timeout: under parallel jest-worker load (CI's full
    // `mobile:test` run) the post-await state update can land after
    // waitFor's default 1s window. The assertions themselves are unchanged.
    await waitFor(
      () => {
        expect(apiClient.comments.remove).toHaveBeenCalledWith(
          'post-1',
          'comment-1',
        );
        expect(screen.queryByText(/Nice!/)).toBeNull();
      },
      { timeout: 5_000 },
    );
  });

  it('hides the comment form for an anonymous viewer', () => {
    render(
      <CommentSection
        postId="post-1"
        initialComments={[]}
        initialNextCursor={null}
        viewerUsername={null}
        postAuthorUsername="alice"
      />,
    );

    expect(screen.queryByLabelText('Add a comment')).toBeNull();
  });

  it('loads the next page of comments', async () => {
    jest.mocked(apiClient.comments.list).mockResolvedValue({
      data: [fakeComment({ id: 'comment-2', body: 'Second comment' })],
      meta: { nextCursor: null },
    });

    render(
      <CommentSection
        postId="post-1"
        initialComments={[fakeComment()]}
        initialNextCursor="cursor-1"
        viewerUsername="alice"
        postAuthorUsername="alice"
      />,
    );

    fireEvent.press(screen.getByText('Load more comments'));

    await waitFor(() => {
      expect(apiClient.comments.list).toHaveBeenCalledWith('post-1', {
        cursor: 'cursor-1',
      });
      expect(screen.getByText(/Second comment/)).toBeTruthy();
    });
  });
});
