'use client';

import type { Mode } from 'src/theme/tokens';

import { prefixer } from 'stylis';
import { faIR } from 'date-fns-jalali/locale';
import { useMemo, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import rtlPlugin from '@mui/stylis-plugin-rtl';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import { FaProvider } from 'src/locales/fa-provider';
import { makeTheme } from 'src/theme/safanoor-theme';
import { ModeContext } from 'src/theme/mode-context';
import { PersianJalaliAdapter } from 'src/libs/persian-jalali-adapter';

export default function Providers({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode: Mode;
}) {
  const [mode, setMode] = useState(initialMode);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 20000, refetchOnWindowFocus: false } },
      })
  );
  const theme = useMemo(() => makeTheme(mode), [mode]);
  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js');
  }, []);
  const toggle = () =>
    setMode((old) => {
      const next = old === 'light' ? 'dark' : 'light';
      document.cookie = `sf_theme=${next}; Path=/; SameSite=Lax; Max-Age=31536000`;
      return next;
    });
  return (
    <AppRouterCacheProvider options={{ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin] }}>
      <FaProvider>
        <QueryClientProvider client={queryClient}>
          <ModeContext.Provider value={{ mode, toggle }}>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <LocalizationProvider dateAdapter={PersianJalaliAdapter} adapterLocale={faIR}>
                {children}
              </LocalizationProvider>
            </ThemeProvider>
          </ModeContext.Provider>
        </QueryClientProvider>
      </FaProvider>
    </AppRouterCacheProvider>
  );
}
