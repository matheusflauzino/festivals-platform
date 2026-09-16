'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { loginRequest, meRequest, refreshRequest, type AdminUser } from '../api/admin-auth';
import { apiClient } from '../api/client';
import { registerAuthInterceptors } from '../api/auth-interceptors';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  admin: AdminUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  const setAccessToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setAccessTokenState(token);
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setAdmin(null);
    setStatus('unauthenticated');
  }, [setAccessToken]);

  useEffect(() => {
    registerAuthInterceptors(apiClient, {
      getAccessToken: () => accessTokenRef.current,
      onTokenRefreshed: (token) => setAccessToken(token),
      onAuthFailure: () => logout(),
    });
  }, [setAccessToken, logout]);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const { accessToken: token } = await refreshRequest();
        const restoredAdmin = await meRequest(token);
        if (cancelled) return;
        setAccessToken(token);
        setAdmin(restoredAdmin);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        setStatus('unauthenticated');
      }
    }
    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [setAccessToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken: token, admin: loggedInAdmin } = await loginRequest(email, password);
      setAccessToken(token);
      setAdmin(loggedInAdmin);
      setStatus('authenticated');
    },
    [setAccessToken],
  );

  return (
    <AuthContext.Provider value={{ status, admin, accessToken, login, logout }}>
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
