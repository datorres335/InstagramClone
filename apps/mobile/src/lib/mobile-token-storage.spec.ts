import * as SecureStore from 'expo-secure-store';

import { createMobileTokenStorage } from './mobile-token-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('createMobileTokenStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes tokens as a single JSON-serialized SecureStore item', async () => {
    const storage = createMobileTokenStorage();
    const tokens = {
      accessToken: 'access-token',
      accessTokenExpiresAt: '2026-01-01T00:15:00.000Z',
      refreshToken: 'refresh-token',
    };

    await storage.write(tokens);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'session',
      JSON.stringify(tokens),
    );
  });

  it('reads back exactly what was written', async () => {
    const tokens = {
      accessToken: 'access-token',
      accessTokenExpiresAt: '2026-01-01T00:15:00.000Z',
      refreshToken: 'refresh-token',
    };
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(JSON.stringify(tokens));

    const storage = createMobileTokenStorage();

    await expect(storage.read()).resolves.toEqual(tokens);
  });

  it('returns null when nothing has been stored yet', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);

    const storage = createMobileTokenStorage();

    await expect(storage.read()).resolves.toBeNull();
  });

  it('returns null for malformed JSON rather than throwing', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('not-json');

    const storage = createMobileTokenStorage();

    await expect(storage.read()).resolves.toBeNull();
  });

  it('returns null when the parsed value has no refreshToken', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(JSON.stringify({ accessToken: 'x' }));

    const storage = createMobileTokenStorage();

    await expect(storage.read()).resolves.toBeNull();
  });

  it('clear deletes the stored item', async () => {
    const storage = createMobileTokenStorage();

    await storage.clear();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('session');
  });
});
