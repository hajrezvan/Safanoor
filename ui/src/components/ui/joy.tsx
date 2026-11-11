'use client';

import Link from 'next/link';

import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import SchoolRounded from '@mui/icons-material/SchoolRounded';
import MenuBookRounded from '@mui/icons-material/MenuBookRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded';
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded';

import { useFa } from 'src/locales/fa-provider';
import { tokens, type JoyTone } from 'src/theme/tokens';

export const JoyIllustration = styled('img')(({ theme }) => ({
  display: 'block',
  width: tokens.artwork.hero,
  maxWidth: '100%',
  height: 'auto',
  aspectRatio: '1',
  objectFit: 'contain',
  flexShrink: 0,
  borderRadius: tokens.radius.card,
  userSelect: 'none',
  [theme.breakpoints.down('sm')]: { width: tokens.artwork.compact },
}));
const Links = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
  gap: tokens.space.lg,
  [theme.breakpoints.down('lg')]: { gridTemplateColumns: 'repeat(2,minmax(0,1fr))' },
  [theme.breakpoints.down('sm')]: { gap: tokens.space.md },
}));
const Shortcut = styled(Link, {
  shouldForwardProp: (prop) => prop !== '$tone',
})<{ $tone: JoyTone }>(({ theme, $tone }) => {
  const tone = tokens.joy[theme.palette.mode][$tone];
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: tokens.space.sm,
    minWidth: 0,
    padding: tokens.space.xl,
    borderRadius: tokens.radius.card,
    border: `1px solid ${tone.edge}`,
    color: tone.ink,
    background: `linear-gradient(145deg, ${theme.palette.background.paper}, ${tone.surface})`,
    transition: `transform ${tokens.motion.duration}ms, box-shadow ${tokens.motion.duration}ms`,
    '&:hover': {
      transform: `translateY(-${tokens.space.xs}px)`,
      boxShadow: tokens.shadow[theme.palette.mode],
    },
    '&:active': { transform: 'translateY(0)' },
    '&:focus-visible': { outline: `2px solid ${tone.ink}`, outlineOffset: tokens.space.xs },
    '& > .MuiSvgIcon-root': { alignSelf: 'flex-end', fontSize: tokens.type.subtitle },
    [theme.breakpoints.down('sm')]: { padding: tokens.space.lg },
  };
});
const ClayIcon = styled('span', {
  shouldForwardProp: (prop) => prop !== '$tone',
})<{ $tone: JoyTone }>(({ theme, $tone }) => {
  const tone = tokens.joy[theme.palette.mode][$tone];
  return {
    display: 'grid',
    placeItems: 'center',
    width: tokens.layout.touch + tokens.space.sm,
    height: tokens.layout.touch + tokens.space.sm,
    borderRadius: tokens.radius.input,
    background: `linear-gradient(145deg, ${theme.palette.background.paper}, ${tone.surface})`,
    border: `1px solid ${tone.edge}`,
    boxShadow: `inset 0 -${tokens.space.xs}px ${tokens.space.sm}px ${tone.edge}, 0 ${tokens.space.sm}px ${tokens.space.md}px ${tone.edge}`,
    transform: 'rotate(-8deg)',
    marginBottom: tokens.space.sm,
    '& .MuiSvgIcon-root': { fontSize: tokens.type.title, transform: 'rotate(8deg)' },
  };
});
const Intro = styled('div')({ marginBottom: tokens.space.lg });
const ShortcutTitle = styled(Typography)({ fontSize: tokens.type.subtitle, fontWeight: 650 });
const ShortcutHint = styled(Typography)({
  fontSize: tokens.type.caption,
  lineHeight: tokens.type.line,
});
const items = [
  {
    href: '/library',
    title: 'library',
    hint: 'exploreLibrary',
    tone: 'lavender',
    icon: MenuBookRounded,
  },
  { href: '/classes', title: 'classes', hint: 'exploreClasses', tone: 'sky', icon: SchoolRounded },
  {
    href: '/group-album',
    title: 'groupAlbum',
    hint: 'exploreAlbum',
    tone: 'peach',
    icon: PhotoLibraryRounded,
  },
  {
    href: '/camp-attendance',
    title: 'campAttendance',
    hint: 'exploreCamps',
    tone: 'mint',
    icon: EventAvailableRounded,
  },
] as const;
export function QuickAccess() {
  const t = useFa();
  return (
    <section aria-label={t('quickAccess')}>
      <Intro>
        <Typography component="h2" variant="h3">
          {t('quickAccess')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('quickAccessHint')}
        </Typography>
      </Intro>
      <Links>
        {items.map(({ href, title, hint, tone, icon: Icon }) => (
          <Shortcut key={href} href={href} $tone={tone}>
            <ClayIcon $tone={tone}>
              <Icon />
            </ClayIcon>
            <ShortcutTitle>{t(title)}</ShortcutTitle>
            <ShortcutHint>{t(hint)}</ShortcutHint>
            <ArrowBackRounded aria-hidden="true" />
          </Shortcut>
        ))}
      </Links>
    </section>
  );
}
