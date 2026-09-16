'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { loginRequest, meRequest, refreshRequest, type AdminUser } from '../api/admin-auth';

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
  const [accessToken, setAccessToken] = useState<string | null>(null);

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
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken: token, admin: loggedInAdmin } = await loginRequest(email, password);
    setAccessToken(token);
    setAdmin(loggedInAdmin);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setAdmin(null);
    setStatus('unauthenticated');
  }, []);

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
