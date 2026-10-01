import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

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

    expect(screen.getByText('Save')).toBeTruthy();
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(apiClient.savedPosts.save).toHaveBeenCalledWith('post-1');
      expect(screen.getByText('Unsave')).toBeTruthy();
    });
  });

  it('unsaves a post', async () => {
    jest.mocked(apiClient.savedPosts.unsave).mockResolvedValue(undefined);
    render(<SaveButton postId="post-1" initialIsSaved={true} />);

    fireEvent.press(screen.getByText('Unsave'));

    await waitFor(() => {
      expect(apiClient.savedPosts.unsave).toHaveBeenCalledWith('post-1');
      expect(screen.getByText('Save')).toBeTruthy();
    });
  });

  it('shows an error and leaves the state unchanged when the API call fails', async () => {
    jest.mocked(apiClient.savedPosts.save).mockRejectedValue(new Error('boom'));
    render(<SaveButton postId="post-1" initialIsSaved={false} />);

    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Save')).toBeTruthy();
  });
});
