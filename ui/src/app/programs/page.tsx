'use client';

import type { TextKey } from 'src/locales/fa';
import type { IconName } from 'src/components/ui';

import Link from 'next/link';

import { styled } from '@mui/material/styles';

import { tokens } from 'src/theme/tokens';
import { Session } from 'src/features/session';
import { useFa } from 'src/locales/fa-provider';

import { Icon, Text, Stack, PageHeader } from 'src/components/ui';

type ProgramLink = { href: string; key: TextKey; icon: IconName };

const destinations: ProgramLink[] = [
  { href: '/library', key: 'library', icon: 'library' },
  { href: '/meetings', key: 'meetings', icon: 'meetings' },
  { href: '/consultations', key: 'consultations', icon: 'consultations' },
  { href: '/classes', key: 'classes', icon: 'classes' },
  { href: '/group-album', key: 'groupAlbum', icon: 'groupAlbum' },
  { href: '/finance', key: 'finance', icon: 'finance' },
  { href: '/camp-attendance', key: 'campAttendance', icon: 'campAttendance' },
];

const ProgramGrid = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: tokens.space.sm,
});

const ProgramCard = styled(Link)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space.xs,
  minWidth: 0,
  minHeight: tokens.layout.touch + tokens.space.xl,
  padding: `${tokens.space.sm}px ${tokens.space.xs}px`,
  borderRadius: tokens.radius.button,
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  boxShadow: tokens.shadow[theme.palette.mode],
  color: theme.palette.text.primary,
  textAlign: 'center',
  textDecoration: 'none',
  transition: `background ${tokens.motion.duration}ms, border-color ${tokens.motion.duration}ms`,
  '& .MuiSvgIcon-root': { fontSize: 22 },
  '& .MuiTypography-root': {
    fontSize: tokens.type.caption,
    lineHeight: 1.35,
    overflowWrap: 'anywhere',
  },
  '&:hover': {
    background: theme.palette.action.hover,
    borderColor: theme.palette.primary.main,
  },
}));

function ProgramsScreen() {
  const t = useFa();
  return (
    <Stack>
      <PageHeader title={t('programs')} />
      <ProgramGrid>
        {destinations.map((item) => (
          <ProgramCard key={item.href} href={item.href}>
            <Icon name={item.icon} />
            <Text variant="caption">{t(item.key)}</Text>
          </ProgramCard>
        ))}
      </ProgramGrid>
    </Stack>
  );
}

export default function Page() {
  return (
    <Session>
      <ProgramsScreen />
    </Session>
  );
}
