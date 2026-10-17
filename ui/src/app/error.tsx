'use client';

import { useFa } from 'src/locales/fa-provider';

import { Button, AuthShell, EmptyState } from 'src/components/ui';

export default function Error({ reset }: { reset: () => void }) {
  const t = useFa();
  return (
    <AuthShell>
      <EmptyState title={t('error')} action={<Button onClick={reset}>{t('retry')}</Button>} />
    </AuthShell>
  );
}
