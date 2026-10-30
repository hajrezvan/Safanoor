'use client';

import { Session } from 'src/features/session';
import { useFa } from 'src/locales/fa-provider';
import { EmptyState, PageHeader, Stack } from 'src/components/ui';

function ClassesScreen() {
  const t = useFa();
  return (
    <Stack>
      <PageHeader title={t('classes')} />
      <EmptyState />
    </Stack>
  );
}

export default function Page() {
  return (
    <Session>
      <ClassesScreen />
    </Session>
  );
}
