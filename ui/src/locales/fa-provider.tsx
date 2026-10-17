'use client';

import { createInstance } from 'i18next';
import { useTranslation, I18nextProvider } from 'react-i18next';

import { fa, type TextKey } from './fa';

const instance = createInstance();
void instance.init({
  lng: 'fa',
  fallbackLng: 'fa',
  resources: { fa: { translation: fa } },
  interpolation: { escapeValue: false },
  initImmediate: false,
});
export function FaProvider({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
export function useFa() {
  const { t } = useTranslation();
  return (key: TextKey, values?: Record<string, string | number>) => t(key, values);
}
