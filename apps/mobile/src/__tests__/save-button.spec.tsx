import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { MaterialIcons } from '@expo/vector-icons';
import { renderWithTheme } from '../test-support/render-with-theme';
import { apiClient } from '../lib/api-client';
import { SaveButton } from '../components/save-button';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    savedPosts: { save: jest.fn(), unsave: jest.fn() },
  },
}));

describe('SaveButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves a post', async () => {
    jest.mocked(apiClient.savedPosts.save).mockResolvedValue(undefined);
    render(<SaveButton postId="post-1" initialIsSaved={false} />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiClient.savedPosts.save).toHaveBeenCalledWith('post-1');
      expect(screen.getByRole('button', { name: 'Unsave' })).toBeTruthy();
    });
  });

  it('unsaves a post', async () => {
    jest.mocked(apiClient.savedPosts.unsave).mockResolvedValue(undefined);
    render(<SaveButton postId="post-1" initialIsSaved={true} />);

    fireEvent.press(screen.getByRole('button', { name: 'Unsave' }));

    await waitFor(() => {
      expect(apiClient.savedPosts.unsave).toHaveBeenCalledWith('post-1');
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    });
  });

  it('shows an error and leaves the state unchanged when the API call fails', async () => {
    jest.mocked(apiClient.savedPosts.save).mockRejectedValue(new Error('boom'));
    render(<SaveButton postId="post-1" initialIsSaved={false} />);

    fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });
  it.each([
    [false, 'Save', 'bookmark-border'],
    [true, 'Unsave', 'bookmark'],
  ])(
    'saved=%s shows the %s name, the %s icon and the matching selected state',
    (isSaved, name, icon) => {
      const { UNSAFE_getByType } = renderWithTheme(
        <SaveButton postId="post-1" initialIsSaved={isSaved} />,
      );

      expect(
        screen.getByRole('button', { name, selected: isSaved }),
      ).toBeTruthy();
      expect(UNSAFE_getByType(MaterialIcons).props.name).toBe(icon);
    },
  );
});
