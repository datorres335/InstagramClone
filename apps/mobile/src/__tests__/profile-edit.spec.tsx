import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import EditProfileScreen from '../app/profile/edit';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    users: {
      updateProfile: jest.fn(),
      updateAvatar: jest.fn(),
      getProfile: jest.fn().mockResolvedValue({ avatarUrl: null }),
    },
    media: {
      presign: jest.fn(),
      uploadToPresignedUrl: jest.fn(),
      complete: jest.fn(),
      waitUntilProcessed: jest.fn(),
    },
  },
}));
jest.mock('../lib/auth-context', () => ({
  useAuth: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  Redirect: jest.fn(() => null),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const ImagePicker = jest.requireMock('expo-image-picker') as {
  requestMediaLibraryPermissionsAsync: jest.Mock;
  launchImageLibraryAsync: jest.Mock;
};

const { router, Redirect } = jest.requireMock('expo-router') as {
  router: { replace: jest.Mock };
  Redirect: jest.Mock;
};

const fakeUser = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  fullName: 'Alice Anderson',
  bio: 'Old bio',
  websiteUrl: null,
  isPrivate: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('EditProfileScreen', () => {
  const setUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(apiClient.users.getProfile).mockResolvedValue({
      avatarUrl: null,
    } as never);
    global.fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue({ size: 1024 }),
    });
  });

  it('pre-fills the form with the current user values', () => {
    jest.mocked(useAuth).mockReturnValue({
      user: fakeUser as never,
      loading: false,
      setUser,
      logout: jest.fn(),
    });

    render(<EditProfileScreen />);

    expect(screen.getByLabelText('Name')).toHaveProp('value', 'Alice Anderson');
    expect(screen.getByLabelText('Bio')).toHaveProp('value', 'Old bio');
  });

  it('saves and navigates to the profile page on success', async () => {
    jest.mocked(useAuth).mockReturnValue({
      user: fakeUser as never,
      loading: false,
      setUser,
      logout: jest.fn(),
    });
    const updated = { ...fakeUser, bio: 'New bio' };
    jest
      .mocked(apiClient.users.updateProfile)
      .mockResolvedValue(updated as never);

    render(<EditProfileScreen />);
    fireEvent.changeText(screen.getByLabelText('Bio'), 'New bio');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiClient.users.updateProfile).toHaveBeenCalledWith({
        fullName: 'Alice Anderson',
        bio: 'New bio',
        websiteUrl: null,
        isPrivate: false,
      });
    });
    expect(setUser).toHaveBeenCalledWith(updated);
    expect(router.replace).toHaveBeenCalledWith('/profile/alice');
  });

  it('shows an error and does not navigate on failure', async () => {
    jest.mocked(useAuth).mockReturnValue({
      user: fakeUser as never,
      loading: false,
      setUser,
      logout: jest.fn(),
    });
    jest
      .mocked(apiClient.users.updateProfile)
      .mockRejectedValue(new Error('network down'));

    render(<EditProfileScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });
    expect(setUser).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('redirects to login when there is no session', () => {
    jest.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      setUser,
      logout: jest.fn(),
    });

    render(<EditProfileScreen />);

    expect(Redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/(auth)/login' }),
      undefined,
    );
  });

  describe('avatar upload', () => {
    beforeEach(() => {
      jest.mocked(useAuth).mockReturnValue({
        user: fakeUser as never,
        loading: false,
        setUser,
        logout: jest.fn(),
      });
    });

    it('seeds the preview from the public profile on mount', async () => {
      jest.mocked(apiClient.users.getProfile).mockResolvedValue({
        avatarUrl: 'http://minio.test/existing-avatar.webp',
      } as never);

      render(<EditProfileScreen />);

      await waitFor(() => {
        expect(screen.getByLabelText('Your avatar')).toBeTruthy();
      });
    });

    it('does nothing when the user cancels the picker', async () => {
      ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        granted: true,
      });
      ImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: true,
        assets: null,
      });

      render(<EditProfileScreen />);
      fireEvent.press(screen.getByRole('button', { name: 'Change photo' }));

      await waitFor(() => {
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
      });
      expect(apiClient.media.presign).not.toHaveBeenCalled();
    });

    it('shows an error and never calls the API when permission is denied', async () => {
      ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        granted: false,
      });

      render(<EditProfileScreen />);
      fireEvent.press(screen.getByRole('button', { name: 'Change photo' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Photo library access is required to change your photo.',
        );
      });
      expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    });

    it('runs presign -> upload -> complete -> poll -> setAvatar and shows the processed avatar', async () => {
      ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        granted: true,
      });
      ImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///picked.jpg', mimeType: 'image/jpeg' }],
      });
      jest.mocked(apiClient.media.presign).mockResolvedValue({
        mediaId: 'media-1',
        uploadUrl: 'http://minio.test/upload',
        expiresAt: '2026-01-01T00:05:00.000Z',
      });
      jest.mocked(apiClient.media.waitUntilProcessed).mockResolvedValue({
        id: 'media-1',
        purpose: 'AVATAR',
        status: 'READY',
        variants: {
          thumbnail: 'http://minio.test/thumb.webp',
          feed: 'http://minio.test/feed.webp',
        },
        width: 300,
        height: 300,
        blurhash: 'hash',
        failureReason: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      } as never);
      jest.mocked(apiClient.users.updateAvatar).mockResolvedValue({
        id: 'media-1',
        variants: { thumbnail: 'http://minio.test/thumb.webp' },
      } as never);

      render(<EditProfileScreen />);
      fireEvent.press(screen.getByRole('button', { name: 'Change photo' }));

      await waitFor(() => {
        expect(apiClient.media.presign).toHaveBeenCalledWith({
          purpose: 'AVATAR',
          contentType: 'image/jpeg',
          byteSize: 1024,
        });
      });
      expect(apiClient.media.uploadToPresignedUrl).toHaveBeenCalledWith(
        'http://minio.test/upload',
        { size: 1024 },
        'image/jpeg',
      );
      await waitFor(() => {
        expect(apiClient.media.complete).toHaveBeenCalledWith('media-1');
      });
      await waitFor(() => {
        expect(apiClient.users.updateAvatar).toHaveBeenCalledWith('media-1');
      });
      await waitFor(() => {
        expect(screen.getByLabelText('Your avatar')).toBeTruthy();
      });
    });

    it('surfaces a processing failure as an error', async () => {
      ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        granted: true,
      });
      ImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///picked.jpg', mimeType: 'image/jpeg' }],
      });
      jest.mocked(apiClient.media.presign).mockResolvedValue({
        mediaId: 'media-1',
        uploadUrl: 'http://minio.test/upload',
        expiresAt: '2026-01-01T00:05:00.000Z',
      });
      jest.mocked(apiClient.media.waitUntilProcessed).mockResolvedValue({
        id: 'media-1',
        status: 'FAILED',
        failureReason: 'sharp blew up',
      } as never);

      render(<EditProfileScreen />);
      fireEvent.press(screen.getByRole('button', { name: 'Change photo' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeTruthy();
      });
      expect(apiClient.users.updateAvatar).not.toHaveBeenCalled();
    });
  });
});
