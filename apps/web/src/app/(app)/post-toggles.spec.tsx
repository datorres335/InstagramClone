import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { likeAction, unlikeAction } from './like-actions';
import { LikeButton } from './like-button';
import { saveAction, unsaveAction } from './save-actions';
import { SaveButton } from './save-button';

vi.mock('./like-actions', () => ({
  likeAction: vi.fn(),
  unlikeAction: vi.fn(),
}));
vi.mock('./save-actions', () => ({
  saveAction: vi.fn(),
  unsaveAction: vi.fn(),
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LikeButton', () => {
  it('shows an outlined heart, the name "Like" and aria-pressed=false when not liked', () => {
    render(
      <LikeButton
        postId="post-1"
        initialIsLiked={false}
        initialLikesCount={3}
      />,
    );

    const button = screen.getByRole('button', { name: 'Like' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('FavoriteBorderIcon')).toBeTruthy();
    expect(screen.queryByTestId('FavoriteIcon')).toBeNull();
    expect(screen.getByText('3 likes')).toBeTruthy();
  });

  it('shows a filled heart, the name "Unlike" and aria-pressed=true when liked', () => {
    render(<LikeButton postId="post-1" initialIsLiked initialLikesCount={3} />);

    const button = screen.getByRole('button', { name: 'Unlike' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('FavoriteIcon')).toBeTruthy();
  });

  it('likes, then flips the icon, name, pressed state and count', async () => {
    vi.mocked(likeAction).mockResolvedValue(undefined);
    render(
      <LikeButton
        postId="post-1"
        initialIsLiked={false}
        initialLikesCount={3}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    });

    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Unlike' })
          .getAttribute('aria-pressed'),
      ).toBe('true'),
    );
    expect(likeAction).toHaveBeenCalledWith('post-1');
    expect(screen.getByTestId('FavoriteIcon')).toBeTruthy();
    expect(screen.getByText('4 likes')).toBeTruthy();
  });

  it('keeps its state and shows an alert when the action fails', async () => {
    vi.mocked(unlikeAction).mockRejectedValue(new Error('down'));
    render(<LikeButton postId="post-1" initialIsLiked initialLikesCount={3} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlike' }));
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Unlike' })).toBeTruthy();
    expect(screen.getByText('3 likes')).toBeTruthy();
  });
});

describe('SaveButton', () => {
  it('shows an outlined bookmark, the name "Save" and aria-pressed=false when not saved', () => {
    render(<SaveButton postId="post-1" initialIsSaved={false} />);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('BookmarkBorderIcon')).toBeTruthy();
  });

  it('shows a filled bookmark, the name "Unsave" and aria-pressed=true when saved', () => {
    render(<SaveButton postId="post-1" initialIsSaved />);

    const button = screen.getByRole('button', { name: 'Unsave' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('BookmarkIcon')).toBeTruthy();
  });

  it('toggles both ways through the save and unsave actions', async () => {
    vi.mocked(saveAction).mockResolvedValue(undefined);
    vi.mocked(unsaveAction).mockResolvedValue(undefined);
    render(<SaveButton postId="post-1" initialIsSaved={false} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Unsave' })).toBeTruthy(),
    );
    expect(saveAction).toHaveBeenCalledWith('post-1');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unsave' }));
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy(),
    );
    expect(unsaveAction).toHaveBeenCalledWith('post-1');
  });
});
