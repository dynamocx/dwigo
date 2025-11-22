import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';

import App from './App';
import './index.css';
import { AuthProvider } from './auth/AuthContext';
import { AnalyticsProvider } from './analytics/AnalyticsProvider';
import { FeatureFlagProvider } from './flags/FeatureFlagContext';
import theme from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FeatureFlagProvider>
          <AnalyticsProvider>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ThemeProvider>
          </AnalyticsProvider>
        </FeatureFlagProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
