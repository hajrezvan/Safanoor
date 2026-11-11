'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';

import { useFa } from 'src/locales/fa-provider';
import { tokens, type JoyTone } from 'src/theme/tokens';

const destinations = [
  {
    href: '/library',
    key: 'library',
    image: 'library',
    hint: 'programLibraryHint',
    tone: 'lavender',
  },
  {
    href: '/meetings',
    key: 'meetings',
    image: 'meetings',
    hint: 'programMeetingsHint',
    tone: 'sky',
  },
  {
    href: '/consultations',
    key: 'consultations',
    image: 'consultations',
    hint: 'programConsultationsHint',
    tone: 'peach',
  },
  { href: '/classes', key: 'classes', image: 'classes', hint: 'programClassesHint', tone: 'sky' },
  {
    href: '/group-album',
    key: 'groupAlbum',
    image: 'album',
    hint: 'programAlbumHint',
    tone: 'lavender',
  },
  { href: '/finance', key: 'finance', image: 'finance', hint: 'programFinanceHint', tone: 'honey' },
  {
    href: '/camp-attendance',
    key: 'campAttendance',
    image: 'camps',
    hint: 'programCampsHint',
    tone: 'mint',
  },
] as const;

const Tiles = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
  gap: tokens.space.xl,
  [theme.breakpoints.down('lg')]: { gridTemplateColumns: 'repeat(3,minmax(0,1fr))' },
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
    gap: tokens.space.md,
  },
}));
const Tile = styled(Link, {
  shouldForwardProp: (prop) => prop !== '$tone',
})<{ $tone: JoyTone }>(({ theme, $tone }) => {
  const tone = tokens.joy[theme.palette.mode][$tone];
  return {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: tokens.radius.card,
    background: theme.palette.background.paper,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: tokens.shadow[theme.palette.mode],
    textDecoration: 'none',
    transition: `transform ${tokens.motion.duration}ms ease, border-color ${tokens.motion.duration}ms ease`,
    '&:hover': { transform: `translateY(-${tokens.space.xs}px)`, borderColor: tone.ink },
    '&:active': { transform: 'translateY(0)' },
    '&:focus-visible': { outline: `2px solid ${tone.ink}`, outlineOffset: tokens.space.xs },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&:hover': { transform: 'none' },
    },
  };
});
const ArtSurface = styled('div', {
  shouldForwardProp: (prop) => prop !== '$tone',
})<{ $tone: JoyTone }>(({ theme, $tone }) => ({
  display: 'grid',
  placeItems: 'center',
  minWidth: 0,
  padding: tokens.space.lg,
  background: `radial-gradient(ellipse at center, ${tokens.joy[theme.palette.mode][$tone].surface}, ${theme.palette.background.paper})`,
}));
const Artwork = styled('img')(({ theme }) => ({
  display: 'block',
  width: tokens.artwork.program,
  height: tokens.artwork.program,
  maxWidth: '100%',
  objectFit: 'contain',
  borderRadius: tokens.radius.input,
  [theme.breakpoints.down('sm')]: {
    width: tokens.artwork.programMobile,
    height: tokens.artwork.programMobile,
  },
}));
const Copy = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space.sm,
  justifyContent: 'space-between',
  padding: tokens.space.lg,
  borderTop: `1px solid ${theme.palette.divider}`,
  flex: 1,
  '& > div': { minWidth: 0 },
  '& > .MuiSvgIcon-root': {
    flexShrink: 0,
    color: theme.palette.text.secondary,
    fontSize: tokens.type.subtitle,
  },
  [theme.breakpoints.down('sm')]: { padding: tokens.space.md },
}));
const Title = styled('h2')({
  margin: 0,
  fontFamily: tokens.type.font,
  fontSize: tokens.type.subtitle,
  fontWeight: 650,
  lineHeight: tokens.type.line,
});
const Hint = styled(Typography)({
  fontSize: tokens.type.caption,
  lineHeight: tokens.type.line,
  overflowWrap: 'anywhere',
});
const ImageFallback = styled('span')(({ theme }) => ({
  display: 'grid',
  placeItems: 'center',
  width: tokens.artwork.program,
  height: tokens.artwork.program,
  maxWidth: '100%',
  color: theme.palette.text.secondary,
  fontSize: tokens.type.display,
  [theme.breakpoints.down('sm')]: {
    width: tokens.artwork.programMobile,
    height: tokens.artwork.programMobile,
  },
}));
function ProgramArt({ name, title }: { name: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <ImageFallback aria-hidden="true">{title.slice(0, 1)}</ImageFallback>
  ) : (
    <Artwork
      src={`/assets/illustrations/programs/${name}.webp`}
      alt=""
      width={480}
      height={480}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
export function ProgramTiles() {
  const t = useFa();
  return (
    <Tiles>
      {destinations.map((item) => (
        <Tile key={item.href} href={item.href} $tone={item.tone} aria-label={t(item.key)}>
          <ArtSurface $tone={item.tone}>
            <ProgramArt name={item.image} title={t(item.key)} />
          </ArtSurface>
          <Copy>
            <div>
              <Title>{t(item.key)}</Title>
              <Hint color="text.secondary">{t(item.hint)}</Hint>
            </div>
            <ArrowBackRounded aria-hidden="true" />
          </Copy>
        </Tile>
      ))}
    </Tiles>
  );
}
