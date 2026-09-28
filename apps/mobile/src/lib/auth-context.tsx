import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import type { UserResponse } from '@instagram-clone/validation';

import { apiClient } from './api-client';

interface AuthContextValue {
  user: UserResponse | null;
  /** True until the initial `apiClient.auth.session()` check resolves. */
  loading: boolean;
  setUser: (user: UserResponse | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * No Server Components/Actions here (unlike `apps/web`) — the whole app runs
 * on-device, so session state is plain React state, checked once on mount
 * via `apiClient.auth.session()` (which itself reads the persisted refresh
 * token from `expo-secure-store` and mints a fresh access token if needed).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient.auth
      .session()
      .then((sessionUser) => {
        if (!cancelled) setUser(sessionUser);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await apiClient.auth.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
