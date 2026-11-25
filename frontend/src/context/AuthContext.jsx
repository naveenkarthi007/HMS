import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { onSessionExpired, session } from '../api/client';
import { usePlatformView } from './PlatformViewContext';

const AuthContext = createContext(null);

export const ROLE_HOME = {
  super_admin: '/super/dashboard',
  org_admin: '/admin/dashboard',
  boys_hostel_manager: '/admin/dashboard',
  girls_hostel_manager: '/admin/dashboard',
  warden: '/warden/dashboard',
  student: '/student/home',
};

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { reset: resetPlatformView } = usePlatformView();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (session.get() ? 'loading' : 'anonymous'));
  const bootstrapped = useRef(false);

  const clearSession = useCallback(() => {
    session.clear();
    resetPlatformView();
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient, resetPlatformView]);

  useEffect(() => {
    onSessionExpired(() => {
      resetPlatformView();
      setUser(null);
      setStatus('anonymous');
      queryClient.clear();
    });
    return () => onSessionExpired(null);
  }, [queryClient, resetPlatformView]);

  // Restore the session on first load only when one may exist.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (!session.get()) return;
    authApi
      .me()
      .then((me) => {
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        session.clear();
        setUser(null);
        setStatus('anonymous');
      });
  }, []);

  const login = useCallback(
    async (credentials) => {
      const result = await authApi.login(credentials);
      resetPlatformView();
      queryClient.clear();
      session.set(result.accessTokenExpiresAt);
      setUser(result.user);
      setStatus('authenticated');
      return result.user;
    },
    [queryClient, resetPlatformView],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, status, isAuthenticated: status === 'authenticated', login, logout, setUser }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
