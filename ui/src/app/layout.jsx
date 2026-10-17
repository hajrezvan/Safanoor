import 'src/global.css';

import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

import { CONFIG } from 'src/global-config';
import { themeConfig, ThemeProvider, primary as primaryColor } from 'src/theme';
import { I18nProvider, LocalizationProvider } from 'src/locales';
import ScreenSize from 'src/layouts/screen-size';

import { ProgressBar } from 'src/components/progress-bar';
import { MotionLazy } from 'src/components/animate/motion-lazy';
import { detectSettings } from 'src/components/settings/server';
import { SettingsDrawer, defaultSettings, SettingsProvider } from 'src/components/settings';

import { AuthProvider } from 'src/auth/context/jwt';

import Providers from './providers';

// ----------------------------------------------------------------------

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: primaryColor.main,
};

export const metadata = {
  icons: [
    {
      rel: 'icon',
      url: `${CONFIG.assetsDir}/favicon.ico`,
    },
  ],
};

// ----------------------------------------------------------------------

async function getAppConfig() {
  if (CONFIG.isStaticExport) {
    return {
      cookieSettings: undefined,
      dir: defaultSettings.direction,
    };
  } else {
    const [settings] = await Promise.all([detectSettings()]);

    return {
      cookieSettings: settings,
      dir: settings.direction,
    };
  }
}

export default async function RootLayout({ children }) {
  const appConfig = await getAppConfig();

  return (
    <html lang="en" dir={appConfig.dir} suppressHydrationWarning>
      <body>
        <InitColorSchemeScript
          modeStorageKey={themeConfig.modeStorageKey}
          attribute={themeConfig.cssVariables.colorSchemeSelector}
          defaultMode={themeConfig.defaultMode}
        />

        <I18nProvider>
          <Providers>
            <AuthProvider>
              <LocalizationProvider>
                <SettingsProvider
                  cookieSettings={appConfig.cookieSettings}
                  defaultSettings={defaultSettings}
                >
                  <AppRouterCacheProvider options={{ key: 'css' }}>
                    <ThemeProvider
                      modeStorageKey={themeConfig.modeStorageKey}
                      defaultMode={themeConfig.defaultMode}
                    >
                      <MotionLazy>
                        <ScreenSize>
                          <ProgressBar />
                          <SettingsDrawer defaultSettings={defaultSettings} />
                          {children}
                        </ScreenSize>
                      </MotionLazy>
                    </ThemeProvider>
                  </AppRouterCacheProvider>
                </SettingsProvider>
              </LocalizationProvider>
            </AuthProvider>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
