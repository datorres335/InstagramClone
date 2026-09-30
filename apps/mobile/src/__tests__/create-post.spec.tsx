import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { apiClient } from '../lib/api-client';
import NewPostScreen from '../app/post/new';

jest.mock('../lib/api-client', () => ({
  apiClient: {
    media: {
      presign: jest.fn(),
      uploadToPresignedUrl: jest.fn(),
      complete: jest.fn(),
      waitUntilProcessed: jest.fn(),
    },
    posts: { create: jest.fn() },
  },
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const ImagePicker = jest.requireMock('expo-image-picker') as {
  requestMediaLibraryPermissionsAsync: jest.Mock;
  launchImageLibraryAsync: jest.Mock;
};
const { router } = jest.requireMock('expo-router') as {
  router: { replace: jest.Mock };
};

describe('NewPostScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue({ size: 1024 }),
    });
  });

  it('shows an error and never opens the picker when permission is denied', async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: false,
    });

    render(<NewPostScreen />);
    fireEvent.press(screen.getByText('Add photos'));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Photo library access is required to add photos.',
      ),
    );
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is canceled', async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: true,
    });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: [],
    });

    render(<NewPostScreen />);
    fireEvent.press(screen.getByText('Add photos'));

    await waitFor(() =>
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled(),
    );
    expect(apiClient.media.presign).not.toHaveBeenCalled();
  });

  it('uploads a selected image through the full pipeline and enables Share once ready', async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: true,
    });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photo.jpg', mimeType: 'image/jpeg' }],
    });
    jest.mocked(apiClient.media.presign).mockResolvedValue({
      mediaId: 'media-1',
      uploadUrl: 'http://minio.test/upload',
      expiresAt: '2026-01-01T00:05:00.000Z',
    });
    jest.mocked(apiClient.media.waitUntilProcessed).mockResolvedValue({
      id: 'media-1',
      purpose: 'POST_IMAGE',
      status: 'READY',
      variants: {
        thumbnail: 'http://minio.test/thumb.webp',
        feed: 'http://minio.test/feed.webp',
      },
      width: 800,
      height: 600,
      blurhash: 'hash',
      failureReason: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    } as never);

    render(<NewPostScreen />);
    fireEvent.press(screen.getByText('Add photos'));

    await waitFor(() => {
      expect(apiClient.media.presign).toHaveBeenCalledWith({
        purpose: 'POST_IMAGE',
        contentType: 'image/jpeg',
        byteSize: 1024,
      });
    });
    await waitFor(() => expect(screen.getByText('Ready')).toBeTruthy());

    const post = {
      id: 'post-1',
      author: {
        id: 'user-1',
        username: 'alice',
        fullName: null,
        avatarUrl: null,
      },
      caption: null,
      location: null,
      media: [],
      likesCount: 0,
      commentsCount: 0,
      isLikedByMe: null,
      isSavedByMe: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    jest.mocked(apiClient.posts.create).mockResolvedValue(post);

    fireEvent.press(screen.getByText('Share'));

    await waitFor(() => {
      expect(apiClient.posts.create).toHaveBeenCalledWith({
        caption: null,
        location: null,
        mediaIds: ['media-1'],
      });
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/post/[id]',
        params: { id: 'post-1' },
      });
    });
  });

  it('shows a per-image error when processing fails', async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: true,
    });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photo.jpg', mimeType: 'image/jpeg' }],
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

    render(<NewPostScreen />);
    fireEvent.press(screen.getByText('Add photos'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(apiClient.posts.create).not.toHaveBeenCalled();
  });
});
