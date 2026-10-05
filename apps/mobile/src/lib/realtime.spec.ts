import { renderHook, waitFor } from '@testing-library/react-native';

import { apiClient } from './api-client';
import { useRealtimeEvents } from './realtime';

jest.mock('./api-client', () => ({
  apiClient: { http: { getAccessToken: jest.fn() } },
}));

// Jest hoists `jest.mock()` above regular `const` declarations, so this
// factory can only close over variables prefixed `mock` (its own
// allowance for "ensured lazy" access) — not plain module-scope consts.
jest.mock('react-native-sse', () => {
  const mockListeners: Record<string, ((event: { data?: string | null }) => void)[]> = {};
  const mockClose = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      addEventListener: jest.fn((type, listener) => {
        mockListeners[type] = mockListeners[type] ?? [];
        mockListeners[type].push(listener);
      }),
      close: mockClose,
    })),
    mockListeners,
    mockClose,
  };
});

const sseModule = jest.requireMock('react-native-sse') as {
  mockListeners: Record<string, ((event: { data?: string | null }) => void)[]>;
  mockClose: jest.Mock;
};

function emit(type: string, event: { data?: string | null } = {}) {
  sseModule.mockListeners[type]?.forEach((listener) => listener(event));
}

const notification = {
  id: '018f2c1e-1234-7abc-89de-abcdef012345',
  type: 'FOLLOW',
  actor: {
    id: '018f2c1e-1234-7abc-89de-abcdef012346',
    username: 'bob',
    fullName: 'Bob',
    avatarUrl: null,
  },
  post: null,
  comment: null,
  isRead: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('useRealtimeEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(sseModule.mockListeners).forEach(
      (key) => delete sseModule.mockListeners[key],
    );
    jest.mocked(apiClient.http.getAccessToken).mockResolvedValue('a-token');
  });

  it('calls onConnect when the stream opens', async () => {
    const onConnect = jest.fn();
    renderHook(() => useRealtimeEvents(jest.fn(), onConnect));

    await waitFor(() => expect(sseModule.mockListeners.open).toBeDefined());
    emit('open');

    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('parses a real event payload and forwards it to onEvent', async () => {
    const onEvent = jest.fn();
    renderHook(() => useRealtimeEvents(onEvent));

    await waitFor(() => expect(sseModule.mockListeners.message).toBeDefined());
    emit('message', {
      data: JSON.stringify({ type: 'notification', notification }),
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: 'notification',
      notification,
    });
  });

  it('ignores a message that fails schema validation', async () => {
    const onEvent = jest.fn();
    renderHook(() => useRealtimeEvents(onEvent));

    await waitFor(() => expect(sseModule.mockListeners.message).toBeDefined());
    emit('message', { data: JSON.stringify({ type: 'not-a-real-type' }) });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('closes the connection on unmount', async () => {
    const { unmount } = renderHook(() => useRealtimeEvents(jest.fn()));
    await waitFor(() =>
      expect(apiClient.http.getAccessToken).toHaveBeenCalled(),
    );

    unmount();

    expect(sseModule.mockClose).toHaveBeenCalledTimes(1);
  });

  it('never connects when there is no session', async () => {
    jest
      .mocked(apiClient.http.getAccessToken)
      .mockRejectedValue(new Error('no session'));
    const onEvent = jest.fn();

    renderHook(() => useRealtimeEvents(onEvent));
    await waitFor(() =>
      expect(apiClient.http.getAccessToken).toHaveBeenCalled(),
    );

    expect(sseModule.mockListeners.message).toBeUndefined();
  });
});
