import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import '@fontsource-variable/inter';
import './styles/index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { PlatformViewProvider } from './context/PlatformViewContext';
import { getErrorMessage } from './api/client';

const isUnauthorized = (error) => error?.response?.status === 401;

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (isUnauthorized(error) || query.meta?.silent) return;
      toast.error(getErrorMessage(error), { id: `query-${query.queryHash}` });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (isUnauthorized(error) || mutation.meta?.silent) return;
      toast.error(getErrorMessage(error));
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={routerFuture} basename="/hostel">
      <QueryClientProvider client={queryClient}>
        <PlatformViewProvider>
          <AuthProvider>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                className: '!rounded-xl !text-sm',
              }}
            />
          </AuthProvider>
        </PlatformViewProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
