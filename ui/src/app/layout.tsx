import '@fontsource-variable/vazirmatn';

import type { Metadata, Viewport } from 'next';

import { cookies } from 'next/headers';

import { fa } from 'src/locales/fa';
import { tokens } from 'src/theme/tokens';

import Providers from './providers';

export const metadata: Metadata = {
  title: { default: fa.brand, template: `%s | ${fa.brand}` },
  description: fa.tagline,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: '/icon-192.png',
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: fa.brand },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: tokens.palette.light.brand,
};
export default async function Layout({ children }: { children: React.ReactNode }) {
  const mode = (await cookies()).get('sf_theme')?.value === 'dark' ? 'dark' : 'light';
  return (
    <html lang="fa" dir="rtl">
      <body>
        <Providers initialMode={mode}>{children}</Providers>
      </body>
    </html>
  );
}
