'use client';

import { useFa } from 'src/locales/fa-provider';

import { Button, AuthShell, EmptyState } from 'src/components/ui';

export default function Page() {
  const t = useFa();
  return (
    <AuthShell>
      <EmptyState title={t('notFound')} action={<Button href="/">{t('returnHome')}</Button>} />
    </AuthShell>
  );
}
