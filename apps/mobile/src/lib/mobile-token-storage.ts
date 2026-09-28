import * as SecureStore from 'expo-secure-store';

import type { StoredTokens, TokenStorage } from '@instagram-clone/api-client';

/**
 * `TokenStorage` backed by `expo-secure-store` (iOS Keychain / Android
 * Keystore — never `AsyncStorage`, which is unencrypted; see
 * docs/ARCHITECTURE.md §5.3/§7). Unlike `apps/web`'s adapter, there's no
 * "can only write outside a render" restriction here, so both tokens are
 * simply persisted together as one JSON value — the straightforward design
 * docs/ARCHITECTURE.md §7 originally described for both platforms.
 */
const SESSION_KEY = 'session';

export function createMobileTokenStorage(): TokenStorage {
  return {
    async read() {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as StoredTokens;
        if (typeof parsed.refreshToken !== 'string') return null;
        return parsed;
      } catch {
        return null;
      }
    },

    async write(tokens: StoredTokens) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(tokens));
    },

    async clear() {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    },
  };
}
