import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { viewOrg } from '../api/client';

const PlatformViewContext = createContext(null);

/**
 * Which organisation a super admin is looking at (read-only), persisted across reloads.
 * The API client sends it as `X-Organisation-Id`.
 */
export function PlatformViewProvider({ children }) {
  const [org, setOrg] = useState(() => viewOrg.get());
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const enter = useCallback(
    (next, to = '/admin/dashboard') => {
      viewOrg.set(next);
      setOrg(viewOrg.get());
      queryClient.removeQueries();
      navigate(to);
    },
    [queryClient, navigate],
  );

  const exit = useCallback(
    (to = '/super/dashboard') => {
      viewOrg.clear();
      setOrg(null);
      queryClient.removeQueries();
      if (to) navigate(to);
    },
    [queryClient, navigate],
  );

  /** Forget the view without navigating (sign-in / sign-out). */
  const reset = useCallback(() => {
    viewOrg.clear();
    setOrg(null);
  }, []);

  const value = useMemo(() => ({ org, enter, exit, reset }), [org, enter, exit, reset]);
  return <PlatformViewContext.Provider value={value}>{children}</PlatformViewContext.Provider>;
}

export function usePlatformView() {
  const ctx = useContext(PlatformViewContext);
  if (!ctx) throw new Error('usePlatformView must be used inside <PlatformViewProvider>');
  return ctx;
}
