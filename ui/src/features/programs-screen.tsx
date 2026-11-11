'use client';

import { useFa } from 'src/locales/fa-provider';

import { Stack, PageHeader, ProgramTiles } from 'src/components/ui';

export function ProgramsScreen() {
  const t = useFa();
  return (
    <Stack>
      <PageHeader title={t('programs')} hint={t('programsHint')} />
      <ProgramTiles />
    </Stack>
  );
}
