'use client';

import { useFa } from 'src/locales/fa-provider';

import { Stack, PageHeader, ProgramTiles } from 'src/components/ui';

import { useSession } from './session';

export function ProgramsScreen() {
  const t = useFa();
  const me = useSession();
  return (
    <Stack>
      <PageHeader title={t('programs')} hint={t('programsHint')} />
      <ProgramTiles showCamps={me.capabilities.viewCamps} />
    </Stack>
  );
}
