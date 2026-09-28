import type { StoredTokens, TokenStorage } from '../token-storage';

/** An in-memory `TokenStorage` for tests — no cookies, no SecureStore, just a box. */
export function createFakeTokenStorage(
  initial: StoredTokens | null = null,
): TokenStorage {
  let current = initial;
  return {
    async read() {
      return current;
    },
    async write(tokens) {
      current = tokens;
    },
    async clear() {
      current = null;
    },
  };
}
