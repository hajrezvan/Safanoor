'use client';

import type { Ref, ReactNode, MouseEvent, KeyboardEvent, ChangeEventHandler } from 'react';
import type { TextKey } from 'src/locales/fa';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatNumber } from '@safanoor/shared';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState, useEffect } from 'react';

import AddRounded from '@mui/icons-material/AddRounded';
import useMediaQuery from '@mui/material/useMediaQuery';
import ChatRounded from '@mui/icons-material/ChatRounded';
import HomeRounded from '@mui/icons-material/HomeRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import InboxRounded from '@mui/icons-material/InboxRounded';
import ForumRounded from '@mui/icons-material/ForumRounded';
import SchoolRounded from '@mui/icons-material/SchoolRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import MenuBookRounded from '@mui/icons-material/MenuBookRounded';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import PsychologyRounded from '@mui/icons-material/PsychologyRounded';
import FileUploadRounded from '@mui/icons-material/FileUploadRounded';
import { styled, useTheme, ThemeProvider } from '@mui/material/styles';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import NotificationsRounded from '@mui/icons-material/NotificationsRounded';
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import {
  Box,
  Tab,
  Menu,
  Paper,
  Alert,
  Table,
  Badge,
  Drawer,
  Divider,
  Tooltip,
  MenuItem,
  Snackbar,
  TableRow,
  Checkbox,
  TextField,
  TableBody,
  TableCell,
  TableHead,
  Typography,
  IconButton,
  DialogTitle,
  Autocomplete,
  DialogContent,
  DialogActions,
  LinearProgress,
  TableContainer,
  InputAdornment,
  Chip as MuiChip,
  Tabs as MuiTabs,
  FormControlLabel,
  BottomNavigation,
  Stack as MuiStack,
  Button as MuiButton,
  Avatar as MuiAvatar,
  Dialog as MuiDialog,
  createFilterOptions,
  BottomNavigationAction,
  Skeleton as MuiSkeleton,
} from '@mui/material';

import { api } from 'src/api/client';
import { useFa } from 'src/locales/fa-provider';
import { useMode } from 'src/theme/mode-context';
import { makeTheme } from 'src/theme/safanoor-theme';
import { tokens, type JoyTone } from 'src/theme/tokens';

import { Iconify } from 'src/components/iconify';

import { JoyIllustration } from './joy';
import { AvatarCropPanel } from './avatar-crop';

export { ProgramTiles } from './programs';

const DEFAULT_AVATAR_ICON = 'solar:user-rounded-bold';
function AvatarFallbackIcon({ size }: { size: number }) {
  const width = Math.round(size * 0.55);
  // Iconify is a JS component; optional props are inferred as required.
  return <Iconify icon={DEFAULT_AVATAR_ICON} width={width} height={width} className="" sx={{}} />;
}

const icons = {
  home: HomeRounded,
  library: MenuBookRounded,
  meetings: ForumRounded,
  consultations: PsychologyRounded,
  classes: SchoolRounded,
  groupAlbum: PhotoLibraryRounded,
  finance: AccountBalanceWalletRounded,
  campAttendance: EventAvailableRounded,
  notifications: NotificationsRounded,
  profile: PersonRounded,
  programs: GridViewRounded,
  communications: ChatRounded,
  people: GroupsRounded,
  groups: GroupsRounded,
  access: ShieldRounded,
  admin: GridViewRounded,
  imports: FileUploadRounded,
  audit: HistoryRounded,
  settings: SettingsRounded,
  moon: DarkModeRounded,
  sun: LightModeRounded,
  logout: LogoutRounded,
  back: ArrowBackRounded,
  search: SearchRounded,
  add: AddRounded,
  check: CheckCircleRounded,
  empty: InboxRounded,
  lock: LockRounded,
};
export type IconName = keyof typeof icons;
export function Icon({ name }: { name: IconName }) {
  const Component = icons[name];
  return <Component />;
}
const BrandMark = styled('img')({
  height: tokens.artwork.logo,
  width: tokens.artwork.logo,
  objectFit: 'contain',
  display: 'block',
  flexShrink: 0,
  borderRadius: tokens.radius.button,
});
function BrandLogo({ alt }: { alt: string }) {
  return <BrandMark src="/logo.png" alt={alt} />;
}
export const Stack = styled(MuiStack)({ gap: tokens.space.lg, minWidth: 0 });
/** Horizontal stack. `&&` beats MuiStack's default direction:'column' style function. */
export const Row = styled(Stack)({
  '&&': { flexDirection: 'row' },
  alignItems: 'center',
  flexWrap: 'wrap',
});
/** Avatar + name/meta in one compact row (Twitter-style); does not wrap. */
export const PersonCardRow = styled(Row)({
  flexWrap: 'nowrap',
  alignItems: 'flex-start',
  gap: tokens.space.sm,
  '& > .MuiAvatar-root': { flexShrink: 0 },
});
export const PersonCardMeta = styled(Stack)({
  flex: 1,
  minWidth: 0,
  gap: tokens.space.xs,
  '& > .MuiTypography-root': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});
export const Spread = styled(Row)({ justifyContent: 'space-between' });
export const Grid = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: tokens.space.xl,
  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))',
  [theme.breakpoints.down('sm')]: { gap: tokens.space.lg },
}));
/** Readable dashboard stats: 2 per row on phone, 5 on desktop. */
export const StatsGrid = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: tokens.space.sm,
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  [theme.breakpoints.up('md')]: {
    gap: tokens.space.md,
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  },
}));
/** Recent threads: two conversation cards per row. */
export const ThreadsFeedGrid = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: tokens.space.md,
  gridTemplateColumns: '1fr',
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
}));
export const FormGrid = styled(Grid)({
  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))',
});
/** Three compact cards per row on desktop; 2 on tablet; 1 on phone. Children stretch to equal height. */
export const CardsGrid = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: tokens.space.lg,
  gridTemplateColumns: '1fr',
  alignItems: 'stretch',
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(2, 1fr)',
  },
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: 'repeat(3, 1fr)',
  },
  '& > *': { minHeight: 0, height: '100%' },
}));
/** Cover-first card shell: equal-height column so actions share a baseline in CardsGrid. */
export const CoverCard = styled('div')(({ theme }) => ({
  borderRadius: tokens.radius.card,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: tokens.shadow[theme.palette.mode],
  backgroundColor: theme.palette.background.paper,
  padding: 0,
  overflow: 'hidden',
  minWidth: 0,
  minHeight: '100%',
  height: '100%',
  alignSelf: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
}));
export const CoverCardButton = styled('button')(({ theme }) => ({
  appearance: 'none',
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: tokens.shadow[theme.palette.mode],
  backgroundColor: theme.palette.background.paper,
  borderRadius: tokens.radius.card,
  padding: 0,
  overflow: 'hidden',
  minWidth: 0,
  width: '100%',
  minHeight: '100%',
  height: '100%',
  alignSelf: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  textAlign: 'start',
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
  boxSizing: 'border-box',
  transition: `background-color ${tokens.motion.duration}ms, border-color ${tokens.motion.duration}ms`,
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    borderColor: theme.palette.primary.main,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));
export const CoverCardMedia = styled('img')(({ theme }) => ({
  width: '100%',
  aspectRatio: '16 / 10',
  objectFit: 'cover',
  display: 'block',
  flexShrink: 0,
  backgroundColor: theme.palette.action.hover,
}));
export const CoverCardMediaPlaceholder = styled('div')(({ theme }) => ({
  width: '100%',
  aspectRatio: '16 / 10',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.secondary,
}));
export const CoverCardBody = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 auto',
  gap: tokens.space.sm,
  padding: tokens.space.lg,
  minWidth: 0,
  minHeight: 0,
});
export const CoverCardAction = styled('div')({
  marginTop: 'auto',
  paddingTop: tokens.space.md,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.sm,
  flexShrink: 0,
});
/** Book-sized columns preserve portrait covers on every viewport. */
export const PathSequence = styled('div')({
  display: 'grid',
  gap: tokens.space.lg,
  gridTemplateColumns: `repeat(auto-fill, minmax(0, ${tokens.layout.bookWidth}px))`,
  alignItems: 'stretch',
  minWidth: 0,
  '& > *': { minHeight: 0, height: '100%' },
});
export const PathSequenceStep = styled('div')({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  height: '100%',
});
export const PathSequenceRail = styled('div')({
  display: 'none',
});
export const PathSequenceNode = styled('div')(({ theme }) => ({
  position: 'absolute',
  top: tokens.space.sm,
  insetInlineStart: tokens.space.sm,
  width: tokens.space.xxl,
  height: tokens.space.xxl,
  borderRadius: tokens.radius.round,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: tokens.type.caption,
  flexShrink: 0,
  zIndex: 2,
  boxShadow: tokens.shadow[theme.palette.mode],
}));
export const PathSequenceConnector = styled('div')({
  display: 'none',
});
export const PathSequenceCard = styled('div')(({ theme }) => ({
  borderRadius: tokens.radius.card,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: tokens.shadow[theme.palette.mode],
  backgroundColor: theme.palette.background.paper,
  padding: 0,
  minWidth: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  height: '100%',
  flex: 1,
}));
const BookCoverImage = styled('img')(({ theme }) => ({
  width: '100%',
  aspectRatio: '3 / 4',
  objectFit: 'cover',
  display: 'block',
  flexShrink: 0,
  backgroundColor: theme.palette.action.hover,
}));
export const BookCoverPlaceholder = styled('div')(({ theme }) => ({
  width: '100%',
  aspectRatio: '3 / 4',
  flexShrink: 0,
  backgroundColor: theme.palette.action.hover,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.text.secondary,
}));
export function BookCoverThumb({ src, alt }: { src: string; alt: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return failedSrc === src ? (
    <BookCoverPlaceholder role="img" aria-label={alt}>
      <Icon name="library" />
    </BookCoverPlaceholder>
  ) : (
    <BookCoverImage src={src} alt={alt} onError={() => setFailedSrc(src)} />
  );
}
export const BookCoverButton = styled('button')(({ theme }) => ({
  appearance: 'none',
  border: 0,
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  display: 'block',
  width: '100%',
  background: 'transparent',
  position: 'relative',
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
  '&:disabled': { cursor: 'default' },
}));
export const BookCardBody = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 auto',
  gap: tokens.space.sm,
  padding: tokens.space.lg,
  minWidth: 0,
});
export const BookCardActions = styled('div')({
  marginTop: 'auto',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: tokens.space.sm,
});
export const ClassAudioPlayer = styled('audio')({
  width: '100%',
  display: 'block',
});
/** YouTube-like class playlist: main player + session list when sessionCount > 1. */
export const ClassPlaylistLayout = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: tokens.space.lg,
  gridTemplateColumns: '1fr',
  alignItems: 'start',
  minWidth: 0,
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: 'minmax(0, 1.6fr) minmax(220px, 0.9fr)',
  },
}));
export const ClassPlaylistMain = styled('div')({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.lg,
});
export const ClassPlaylist = styled('div')(({ theme }) => ({
  borderRadius: tokens.radius.card,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  boxShadow: tokens.shadow[theme.palette.mode],
  padding: tokens.space.md,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.sm,
  minWidth: 0,
  maxHeight: 560,
  overflow: 'auto',
}));
export const ClassPlaylistItem = styled('button')<{ $active?: boolean }>(({ theme, $active }) => ({
  appearance: 'none',
  border: `1px solid ${$active ? theme.palette.primary.main : theme.palette.divider}`,
  backgroundColor: $active ? theme.palette.action.selected : theme.palette.background.paper,
  borderRadius: tokens.radius.button,
  padding: tokens.space.md,
  textAlign: 'start',
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.xs,
  minWidth: 0,
  transition: `background-color ${tokens.motion.duration}ms, border-color ${tokens.motion.duration}ms`,
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  '&:hover': { borderColor: theme.palette.primary.main },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));
/** Dense consultation tiles: up to 5–6 per row on wide screens. */
export const ConsultationCardsGrid = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: tokens.space.sm,
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  },
  [theme.breakpoints.up('md')]: {
    gap: tokens.space.md,
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  },
  [theme.breakpoints.up('lg')]: {
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  },
}));
/** People / my-group: 2 cols on phone, 3 on desktop (narrower cards). */
export const PeopleCardsGrid = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: tokens.space.sm,
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  [theme.breakpoints.up('md')]: {
    gap: tokens.space.md,
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  },
  [theme.breakpoints.up('lg')]: {
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  },
}));
export const PhotoGrid = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: tokens.space.lg,
  gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))',
  [theme.breakpoints.down('sm')]: {
    gap: tokens.space.md,
    gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))',
  },
}));
const PhotoThumbButton = styled('button')(({ theme }) => ({
  appearance: 'none',
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  borderRadius: tokens.radius.card,
  padding: 0,
  overflow: 'hidden',
  cursor: 'pointer',
  textAlign: 'start',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  transition: `transform ${tokens.motion.duration}ms ease`,
  '&:hover': { transform: 'scale(1.01)' },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));
const PhotoThumbImage = styled('img')({
  width: '100%',
  aspectRatio: '1 / 1',
  objectFit: 'cover',
  display: 'block',
});
const PhotoThumbMeta = styled('div')({
  padding: `${tokens.space.sm}px ${tokens.space.md}px ${tokens.space.md}px`,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.xs,
  minWidth: 0,
});
export function PhotoThumb({
  src,
  alt,
  title,
  subtitle,
  onClick,
}: {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <PhotoThumbButton type="button" onClick={onClick}>
      <PhotoThumbImage src={src} alt={alt} loading="lazy" />
      {(title || subtitle) && (
        <PhotoThumbMeta>
          {title && <Text variant="caption">{title}</Text>}
          {subtitle && (
            <Text variant="caption" muted>
              {subtitle}
            </Text>
          )}
        </PhotoThumbMeta>
      )}
    </PhotoThumbButton>
  );
}
const PhotoDetailImage = styled('img')({
  width: '100%',
  maxHeight: 420,
  objectFit: 'contain',
  borderRadius: tokens.radius.card,
  display: 'block',
  background: 'transparent',
});
export function PhotoViewer({ src, alt }: { src: string; alt: string }) {
  return <PhotoDetailImage src={src} alt={alt} />;
}
export const Card = styled(Paper)(({ theme }) => ({
  borderRadius: tokens.radius.card,
  padding: tokens.space.xl,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: tokens.shadow[theme.palette.mode],
  minWidth: 0,
  overflow: 'hidden',
}));
/** Shorter dashboard hero / dense panels. */
export const CompactCard = styled(Card)({
  padding: `${tokens.space.md}px ${tokens.space.lg}px`,
});
export const ProfileColumns = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0,1fr)',
  alignItems: 'start',
  gap: tokens.space.lg,
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: `minmax(0,1fr) ${tokens.layout.profileAside}px`,
  },
}));
export const ProfileFormGrid = styled(FormGrid)({
  gap: tokens.space.lg,
  gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${tokens.layout.profileFieldMin}px),1fr))`,
});
/** Dense person card: small padding, tight stacks, truncated chips. */
export const PeoplePersonCard = styled(Card)({
  padding: tokens.space.sm,
  '& .MuiChip-root': {
    maxWidth: '100%',
    height: 22,
    '& .MuiChip-label': {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      paddingInline: tokens.space.sm,
      fontSize: tokens.type.caption,
      lineHeight: 1.4,
    },
  },
});
export const PeopleCardBody = styled(Stack)({
  gap: tokens.space.sm,
});
export const PeopleCardChips = styled(Row)({
  gap: tokens.space.xs,
  flexWrap: 'wrap',
  minWidth: 0,
});
export const Section = styled(Stack)({ gap: tokens.space.xl });
export const Form = styled('form')({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.xl,
});
export const CompactForm = styled(Form)({ gap: tokens.space.lg });
export function Text({
  children,
  variant = 'body',
  muted = false,
  dir,
}: {
  children: ReactNode;
  variant?: 'display' | 'title' | 'subtitle' | 'body' | 'caption';
  muted?: boolean;
  dir?: 'ltr' | 'rtl';
}) {
  const map = {
    display: 'h1',
    title: 'h2',
    subtitle: 'h3',
    body: 'body1',
    caption: 'caption',
  } as const;
  return (
    <Typography
      variant={map[variant]}
      color={muted ? 'text.secondary' : 'text.primary'}
      dir={dir}
      sx={dir === 'ltr' ? { direction: 'ltr', unicodeBidi: 'isolate' } : undefined}
    >
      {children}
    </Typography>
  );
}
export function Button({
  children,
  onClick,
  type = 'button',
  disabled = false,
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  icon,
  iconify,
  href,
  iconOnly = false,
  iconOnlyOnMobile = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'error' | 'secondary';
  size?: 'small' | 'medium';
  icon?: IconName;
  /** Registered Iconify name (e.g. solar:verified-check-bold). Wins over `icon`. */
  iconify?: string;
  href?: string;
  /** Icon-only control; `children` is the accessible label (aria + tooltip). */
  iconOnly?: boolean;
  /** Hide the text label below `md`; keep the icon. Use for compact mobile toolbars. */
  iconOnlyOnMobile?: boolean;
}) {
  const ariaLabel =
    (iconOnly || iconOnlyOnMobile) && typeof children === 'string' ? children : undefined;
  const label = iconOnly ? null : iconOnlyOnMobile ? (
    <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
      {children}
    </Box>
  ) : (
    children
  );
  const iconSize = size === 'small' ? 20 : 22;
  const startIcon = iconify ? (
    // Iconify is a JS component; optional props are inferred as required.
    <Iconify icon={iconify} width={iconSize} height={iconSize} className="" sx={{}} />
  ) : icon ? (
    <Icon name={icon} />
  ) : undefined;
  const iconSx = iconOnly
    ? {
        minWidth: tokens.layout.touch,
        width: tokens.layout.touch,
        height: tokens.layout.touch,
        paddingInline: tokens.space.sm,
        '& .MuiButton-startIcon': { marginInline: 0 },
      }
    : iconOnlyOnMobile
      ? {
          '@media (max-width:899.95px)': {
            minWidth: tokens.layout.touch,
            paddingInline: tokens.space.sm,
            '& .MuiButton-startIcon': { marginInline: 0 },
          },
        }
      : undefined;
  const button = href ? (
    <MuiButton
      component={Link}
      href={href}
      variant={variant}
      color={color}
      size={size}
      startIcon={startIcon}
      aria-label={ariaLabel}
      sx={iconSx}
    >
      {label}
    </MuiButton>
  ) : (
    <MuiButton
      type={type}
      disabled={disabled}
      onClick={onClick}
      variant={variant}
      color={color}
      size={size}
      startIcon={startIcon}
      aria-label={ariaLabel}
      sx={iconSx}
    >
      {label}
    </MuiButton>
  );
  return iconOnly && typeof children === 'string' ? (
    <Tooltip title={children}>{button}</Tooltip>
  ) : (
    button
  );
}
export function Input({
  label,
  value,
  onChange,
  error,
  type = 'text',
  name,
  placeholder,
  autoComplete,
  disabled = false,
  readOnly = false,
  size = 'medium',
  helperText,
  multiline = false,
  maxLength,
  inputMode,
  inputRef,
}: {
  label: string;
  value?: string | number;
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  error?: string;
  type?: string;
  name?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  readOnly?: boolean;
  size?: 'small' | 'medium';
  helperText?: string;
  multiline?: boolean;
  maxLength?: number;
  inputRef?: Ref<HTMLInputElement>;
  inputMode?: 'text' | 'tel' | 'numeric' | 'decimal' | 'email' | 'url' | 'search' | 'none';
}) {
  const t = useFa();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === 'password';
  return (
    <TextField
      fullWidth
      inputRef={inputRef}
      label={label}
      value={value ?? ''}
      onChange={onChange}
      error={!!error}
      helperText={error || helperText}
      type={isPassword && passwordVisible ? 'text' : type}
      name={name}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      size={size}
      multiline={multiline}
      minRows={multiline ? 3 : undefined}
      sx={
        type === 'tel'
          ? {
              // Theme uses tabular-nums globally; Persian phone digits look too wide with it.
              '& .MuiInputBase-input': { letterSpacing: 0, fontVariantNumeric: 'normal' },
            }
          : undefined
      }
      slotProps={{
        input: isPassword
          ? {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    aria-label={t(passwordVisible ? 'hidePassword' : 'showPassword')}
                    aria-pressed={passwordVisible}
                    disabled={disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  >
                    {passwordVisible ? <VisibilityOffRounded /> : <VisibilityRounded />}
                  </IconButton>
                </InputAdornment>
              ),
            }
          : undefined,
        htmlInput: {
          dir: type === 'tel' || type === 'password' ? 'ltr' : undefined,
          readOnly,
          maxLength,
          inputMode,
        },
      }}
    />
  );
}
export function Search({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const t = useFa();
  return (
    <TextField
      fullWidth
      label={label ?? t('search')}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Icon name="search" />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
  disabled = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  error?: string;
}) {
  return (
    <TextField
      select
      fullWidth
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      error={!!error}
      helperText={error}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
export type AutocompleteOption = {
  value: string;
  label: string;
  photoUrl?: string;
  inputValue?: string;
};
export function ProfileAvatarEditor({
  name,
  photoUrl,
  disabled,
  busy,
  onSelect,
}: {
  name: string;
  photoUrl?: string;
  disabled: boolean;
  busy: boolean;
  onSelect: (file: File) => void;
}) {
  const t = useFa();
  const input = useRef<HTMLInputElement>(null);
  const compact = useCompactLayout();
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const closeCrop = () => {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const cropActions = ({
    disabled: cropDisabled,
    confirmDisabled,
    onConfirm,
  }: {
    disabled: boolean;
    confirmDisabled: boolean;
    onConfirm: () => void;
  }) => (
    <Row sx={{ justifyContent: 'flex-end', width: 1, gap: tokens.space.md }}>
      <Button variant="text" disabled={cropDisabled} onClick={closeCrop}>
        {t('cancel')}
      </Button>
      <Button disabled={confirmDisabled} onClick={onConfirm}>
        {t(cropDisabled ? 'busy' : 'avatarCropConfirm')}
      </Button>
    </Row>
  );

  const cropPanel = cropSrc ? (
    <AvatarCropPanel
      imageSrc={cropSrc}
      busy={busy}
      actions={cropActions}
      onConfirm={(file) => {
        closeCrop();
        onSelect(file);
      }}
    />
  ) : null;

  return (
    <Stack>
      <Text variant="subtitle">{t('profilePhoto')}</Text>
      <Row>
        <ProfileAvatar name={name} photoUrl={photoUrl} size={tokens.layout.profileAvatar} />
        <Button
          size="small"
          variant="outlined"
          icon="imports"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
        >
          {t(busy ? 'busy' : photoUrl ? 'changeProfilePhoto' : 'uploadProfilePhoto')}
        </Button>
      </Row>
      <input
        ref={input}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={t('uploadProfilePhoto')}
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setCropSrc((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
          });
        }}
      />
      {compact ? (
        <BottomSheet open={!!cropSrc} title={t('avatarCropTitle')} onClose={closeCrop}>
          {cropPanel}
        </BottomSheet>
      ) : (
        <Dialog open={!!cropSrc} title={t('avatarCropTitle')} onClose={closeCrop}>
          {cropPanel}
        </Dialog>
      )}
    </Stack>
  );
}
const defaultFilter = createFilterOptions<AutocompleteOption>();
/** Compact profile avatar: photo when present, otherwise Iconify user icon (never name initials). */
export function ProfileAvatar({
  name,
  photoUrl,
  size = 32,
}: {
  name: string;
  photoUrl?: string;
  size?: number;
}) {
  return (
    <MuiAvatar src={photoUrl || undefined} alt={name} sx={{ width: size, height: size }}>
      <AvatarFallbackIcon size={size} />
    </MuiAvatar>
  );
}
export function AutocompleteSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
  loading = false,
  error,
  limit,
  showAvatar = false,
  freeSolo = false,
  createLabel,
  onInputChange,
  clearOnSelect = false,
}: {
  label: string;
  value: string;
  onChange: (value: string, option?: AutocompleteOption) => void;
  options: AutocompleteOption[];
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  limit?: number;
  showAvatar?: boolean;
  freeSolo?: boolean;
  createLabel?: (input: string) => string;
  onInputChange?: (value: string) => void;
  clearOnSelect?: boolean;
}) {
  const [inputValue, setInputValue] = useState('');
  const selected =
    options.find((option) => option.value === value) ?? (value ? { value, label: value } : null);
  return (
    <Autocomplete
      fullWidth
      disabled={disabled}
      loading={loading}
      freeSolo={freeSolo}
      options={options}
      value={clearOnSelect ? null : selected}
      inputValue={inputValue}
      filterOptions={(items, params) => {
        const filtered = defaultFilter(items, params);
        const capped = limit && limit > 0 ? filtered.slice(0, limit) : [...filtered];
        const typed = params.inputValue.trim();
        if (
          freeSolo &&
          typed &&
          !items.some((item) => item.label === typed || item.inputValue === typed) &&
          !capped.some((item) => item.label === typed)
        ) {
          capped.push({
            value: `__create__:${typed}`,
            label: typed,
            inputValue: typed,
          });
        }
        return capped;
      }}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : option.inputValue || option.label
      }
      isOptionEqualToValue={(option, current) => option.value === current.value}
      onInputChange={(_event, next, reason) => {
        if (reason === 'reset' && clearOnSelect) {
          setInputValue('');
          onInputChange?.('');
          return;
        }
        setInputValue(next);
        onInputChange?.(next);
      }}
      onChange={(_event, next) => {
        if (next == null) {
          onChange('');
          return;
        }
        if (typeof next === 'string') {
          const typed = next.trim();
          if (!typed) return;
          onChange(typed, { value: typed, label: typed, inputValue: typed });
          if (clearOnSelect) setInputValue('');
          return;
        }
        onChange(next.value.startsWith('__create__:') ? next.label : next.value, next);
        if (clearOnSelect) setInputValue('');
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        const isCreate = !!option.inputValue;
        return (
          <li key={key} {...rest}>
            <MuiStack
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ py: 0.25, minWidth: 0 }}
            >
              {showAvatar && !isCreate && (
                <ProfileAvatar name={option.label} photoUrl={option.photoUrl} size={28} />
              )}
              <Typography noWrap>
                {isCreate && createLabel ? createLabel(option.label) : option.label}
              </Typography>
            </MuiStack>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={!!error}
          helperText={error}
          InputProps={{
            ...params.InputProps,
            startAdornment:
              showAvatar && selected && !clearOnSelect ? (
                <>
                  <InputAdornment position="start">
                    <ProfileAvatar name={selected.label} photoUrl={selected.photoUrl} size={24} />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ) : (
                params.InputProps.startAdornment
              ),
          }}
        />
      )}
    />
  );
}
export function JalaliInput({
  label,
  value,
  onChange,
  error,
  size = 'medium',
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  error?: string;
  size?: 'small' | 'medium';
}) {
  return (
    <DatePicker
      label={label}
      value={value}
      onChange={onChange}
      format="yyyy/MM/dd"
      formatDensity="dense"
      slotProps={{
        textField: { fullWidth: true, error: !!error, helperText: error, size },
      }}
    />
  );
}
export function Chip({
  children,
  tone = 'default',
  onDelete,
  avatar,
  href,
}: {
  children: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'error';
  onDelete?: () => void;
  avatar?: ReactNode;
  href?: string;
}) {
  return (
    <MuiChip
      size="small"
      label={children}
      color={tone}
      variant="outlined"
      onDelete={onDelete}
      {...(avatar ? { avatar: avatar as never } : {})}
      {...(href ? { component: Link, href, clickable: true } : {})}
    />
  );
}
/** Decorative Iconify glyph for list rows (muted). */
export function SoftIcon({
  icon,
  label,
  size = 22,
}: {
  icon: string;
  label: string;
  size?: number;
}) {
  return (
    <SoftIconRoot role="img" aria-label={label} title={label}>
      <Iconify icon={icon} width={size} height={size} className="" sx={{}} />
    </SoftIconRoot>
  );
}
const SoftIconRoot = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  color: theme.palette.text.secondary,
  flexShrink: 0,
}));
/** Icon-only action with Persian tooltip/aria-label (Iconify). Stops card navigation. */
export function IconAction({
  label,
  icon,
  onClick,
  color = 'default',
  disabled = false,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  color?: 'default' | 'primary' | 'error';
  disabled?: boolean;
}) {
  const handle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (!disabled) onClick();
  };
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          size="small"
          color={color}
          aria-label={label}
          disabled={disabled}
          onClick={handle}
          onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.stopPropagation()}
        >
          <Iconify icon={icon} width={20} height={20} className="" sx={{}} />
        </IconButton>
      </span>
    </Tooltip>
  );
}
export const IconActionRow = styled(Row)({
  gap: tokens.space.xs,
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
});
export const PeopleCardActions = styled(IconActionRow)({
  gap: 0,
  flexWrap: 'nowrap',
  marginTop: 0,
});
/** Clickable card body (link semantics) without nested-button issues for sibling actions. */
export function CardNav({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <CardNavRoot href={href} aria-label={label}>
      {children}
    </CardNavRoot>
  );
}
const CardNavRoot = styled(Link)(({ theme }) => ({
  display: 'block',
  minWidth: 0,
  textDecoration: 'none',
  color: 'inherit',
  borderRadius: tokens.radius.button,
  outlineOffset: 2,
  transition: `background-color ${tokens.motion.duration}ms`,
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  '&:hover': { backgroundColor: theme.palette.action.hover },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}` },
}));
/** Whole-card press target when the card itself navigates (no nested actions). */
export function PressableCard({
  onActivate,
  label,
  children,
}: {
  onActivate: () => void;
  label: string;
  children: ReactNode;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate();
    }
  };
  return (
    <PressableCardRoot
      role="link"
      tabIndex={0}
      aria-label={label}
      onClick={onActivate}
      onKeyDown={onKeyDown}
    >
      {children}
    </PressableCardRoot>
  );
}
const PressableCardRoot = styled(Card)(({ theme }) => ({
  ...statCardInteractive(theme),
  cursor: 'pointer',
}));
/** Person/list avatar: photo when present, otherwise Iconify user icon (never name initials). */
export function Avatar({
  name,
  photoUrl,
  size = 40,
}: {
  name: string;
  photoUrl?: string;
  size?: number;
}) {
  return (
    <MuiAvatar src={photoUrl || undefined} alt={name} sx={{ width: size, height: size }}>
      <AvatarFallbackIcon size={size} />
    </MuiAvatar>
  );
}
export function Check({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <FormControlLabel
      control={
        <Checkbox
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
      }
      label={label}
    />
  );
}
export function Dialog({
  open,
  title,
  children,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}) {
  return (
    <MuiDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack>{children}</Stack>
      </DialogContent>
      {actions && <DialogActions>{actions}</DialogActions>}
    </MuiDialog>
  );
}
const SheetBody = styled(Stack)({ padding: tokens.space.xl, paddingBottom: tokens.space.xxl });
export function BottomSheet({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: tokens.radius.dialog,
            borderTopRightRadius: tokens.radius.dialog,
            maxHeight: '90dvh',
          },
        },
      }}
    >
      <SheetBody>
        <Text variant="subtitle">{title}</Text>
        {children}
      </SheetBody>
    </Drawer>
  );
}
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Snackbar open={!!message} autoHideDuration={5000} onClose={onClose}>
      <Alert severity="success" variant="filled" onClose={onClose}>
        {message}
      </Alert>
    </Snackbar>
  );
}
export function Notice({
  children,
  tone = 'info',
  emphasis = false,
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'error' | 'success';
  /** Filled high-contrast alert so the message is hard to miss. */
  emphasis?: boolean;
}) {
  return (
    <Alert severity={tone} variant={emphasis ? 'filled' : 'standard'}>
      {children}
    </Alert>
  );
}
const Empty = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  textAlign: 'center',
  padding: tokens.space.xxl,
  color: theme.palette.text.secondary,
}));
const EmptyIcon = styled('span')(({ theme }) => ({
  display: 'grid',
  placeItems: 'center',
  width: tokens.layout.touch + tokens.space.xl,
  height: tokens.layout.touch + tokens.space.xl,
  borderRadius: tokens.radius.card,
  color: tokens.joy[theme.palette.mode].lavender.ink,
  background: tokens.joy[theme.palette.mode].lavender.surface,
  boxShadow: `inset 0 -${tokens.space.xs}px ${tokens.space.sm}px ${tokens.joy[theme.palette.mode].lavender.edge}`,
  transform: 'rotate(-6deg)',
  '& .MuiSvgIcon-root': { fontSize: tokens.type.display, transform: 'rotate(6deg)' },
}));
export function EmptyState({
  title,
  hint,
  icon = 'empty',
  action,
}: {
  title?: string;
  hint?: string | null;
  icon?: IconName;
  action?: ReactNode;
}) {
  const t = useFa();
  return (
    <Empty>
      <EmptyIcon>
        <Icon name={icon} />
      </EmptyIcon>
      <Text variant="subtitle">{title || t('empty')}</Text>
      {hint !== null && <Text muted>{hint || t('emptyHint')}</Text>}
      {action}
    </Empty>
  );
}
const HeaderCopy = styled(Stack, {
  shouldForwardProp: (prop) => prop !== 'compact',
})<{ compact: boolean }>(({ compact }) => ({
  gap: compact ? tokens.space.xs : tokens.space.lg,
}));
const ReadingProgressTrack = styled(LinearProgress)({
  height: tokens.space.sm,
  borderRadius: tokens.radius.round,
  '& .MuiLinearProgress-bar': {
    borderRadius: tokens.radius.round,
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  },
});
export function ReadingProgress({ value, label }: { value: number; label: string }) {
  return (
    <Stack>
      <Text muted variant="caption">
        {label}
      </Text>
      <ReadingProgressTrack variant="determinate" value={value} aria-label={label} />
    </Stack>
  );
}

export function PageHeader({
  title,
  hint,
  action,
  compact = false,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <Spread>
      <HeaderCopy compact={compact}>
        <Text variant={compact ? 'subtitle' : 'title'}>{title}</Text>
        {hint && <Text muted>{hint}</Text>}
      </HeaderCopy>
      {action}
    </Spread>
  );
}
const statCardInteractive = (theme: {
  palette: { action: { hover: string }; primary: { main: string } };
}) => ({
  cursor: 'pointer',
  textDecoration: 'none',
  color: 'inherit',
  transition: `background-color ${tokens.motion.duration}ms, border-color ${tokens.motion.duration}ms`,
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    borderColor: theme.palette.primary.main,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
});
export const ClickableCard = styled('button')(({ theme }) => ({
  ...statCardInteractive(theme),
  margin: 0,
  borderRadius: tokens.radius.card,
  padding: tokens.space.lg,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: tokens.shadow[theme.palette.mode],
  backgroundColor: theme.palette.background.paper,
  width: '100%',
  minWidth: 0,
  overflow: 'hidden',
  textAlign: 'start',
  font: 'inherit',
  color: 'inherit',
  appearance: 'none',
  display: 'block',
}));
/** Dense clickable row for list screens (camps, etc.). */
export const CompactClickableCard = styled(ClickableCard)({
  padding: `${tokens.space.md}px ${tokens.space.lg}px`,
});
const StatCardShell = {
  display: 'block',
  minWidth: 0,
  borderRadius: tokens.radius.card,
  padding: tokens.space.lg,
  overflow: 'hidden',
} as const;
const StatCardButton = styled(Card)(({ theme }) => ({
  ...StatCardShell,
  ...statCardInteractive(theme),
}));
const StatCardLink = styled(Link)(({ theme }) => ({
  ...StatCardShell,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: tokens.shadow[theme.palette.mode],
  backgroundColor: theme.palette.background.paper,
  ...statCardInteractive(theme),
}));
const StatCardBody = styled(Stack)({
  '&&': { gap: tokens.space.xs },
  minWidth: 0,
});
const StatCardHeader = styled(Row)({
  '&&': { flexDirection: 'row', flexWrap: 'nowrap', gap: tokens.space.xs },
  alignItems: 'center',
  justifyContent: 'space-between',
  minWidth: 0,
});
const StatCardTitle = styled(Text)({
  '&&': {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'normal',
    lineHeight: tokens.type.line,
    fontSize: tokens.type.caption,
  },
});
const StatCardValue = styled(Text)({
  '&&': {
    fontSize: tokens.type.title,
    lineHeight: 1.4,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
});
function iconTone(icon: IconName): JoyTone {
  if (['finance', 'imports'].includes(icon)) return 'honey';
  if (['consultations', 'library', 'access'].includes(icon)) return 'lavender';
  if (['campAttendance', 'profile', 'groupAlbum'].includes(icon)) return 'peach';
  if (['classes', 'meetings', 'communications'].includes(icon)) return 'sky';
  return 'mint';
}
const StatCardIcon = styled('span', {
  shouldForwardProp: (prop) => prop !== '$tone',
})<{ $tone: JoyTone }>(({ theme, $tone }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: tokens.layout.touch,
  height: tokens.layout.touch,
  borderRadius: tokens.radius.input,
  background: tokens.joy[theme.palette.mode][$tone].surface,
  color: tokens.joy[theme.palette.mode][$tone].ink,
  flexShrink: 0,
  '& .MuiSvgIcon-root': { fontSize: tokens.type.subtitle },
}));
export function StatCard({
  title,
  value,
  icon = 'groups',
  href,
  onClick,
}: {
  title: string;
  value: number;
  icon?: IconName;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <StatCardBody>
      <StatCardHeader>
        <StatCardTitle muted variant="caption">
          {title}
        </StatCardTitle>
        <StatCardIcon $tone={iconTone(icon)}>
          <Icon name={icon} />
        </StatCardIcon>
      </StatCardHeader>
      <StatCardValue variant="subtitle">{formatNumber(value)}</StatCardValue>
    </StatCardBody>
  );
  if (href) {
    return (
      <StatCardLink href={href} aria-label={title}>
        {body}
      </StatCardLink>
    );
  }
  if (onClick) {
    return (
      <StatCardButton
        role="button"
        tabIndex={0}
        aria-label={title}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        }}
      >
        {body}
      </StatCardButton>
    );
  }
  return <Card>{body}</Card>;
}
export function Skeleton() {
  return (
    <Grid>
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <MuiSkeleton height={32} width="50%" />
          <MuiSkeleton height={90} />
        </Card>
      ))}
    </Grid>
  );
}
export function QueryState({
  loading,
  error,
  empty = false,
  retry,
  children,
  emptyTitle,
  emptyHint,
  emptyIcon,
  emptyAction,
}: {
  loading: boolean;
  error: unknown;
  empty?: boolean;
  retry: () => void;
  children: ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  emptyIcon?: IconName;
  emptyAction?: ReactNode;
}) {
  const t = useFa();
  if (loading) return <Skeleton />;
  if (error)
    return (
      <Card>
        <EmptyState title={t('error')} action={<Button onClick={retry}>{t('retry')}</Button>} />
      </Card>
    );
  if (empty)
    return (
      <Card>
        <EmptyState title={emptyTitle} hint={emptyHint} icon={emptyIcon} action={emptyAction} />
      </Card>
    );
  return <>{children}</>;
}
export function Tabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <MuiTabs
      value={value}
      onChange={(_, next: string) => onChange(next)}
      variant="scrollable"
      allowScrollButtonsMobile
    >
      {items.map((item) => (
        <Tab key={item.value} value={item.value} label={item.label} />
      ))}
    </MuiTabs>
  );
}
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  density = 'default',
}: {
  columns: { label: string; render: (row: T) => ReactNode }[];
  rows: T[];
  rowKey: (row: T) => string;
  density?: 'default' | 'compact';
}) {
  return (
    <TableContainer component={Paper} sx={{ maxHeight: tokens.layout.tableHeight }}>
      <Table
        stickyHeader
        size="small"
        sx={{
          minWidth: tokens.layout.tableMin,
          ...(density === 'compact' && {
            '& .MuiTableCell-root': {
              paddingBlock: tokens.space.xs,
            },
          }),
        }}
      >
        <TableHead>
          <TableRow>
            {columns.map((column, i) => (
              <TableCell key={i}>{column.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)} hover>
              {columns.map((column, i) => (
                <TableCell key={i}>{column.render(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
export function Pagination({
  page,
  total,
  limit,
  onChange,
  hideTotal = false,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
  hideTotal?: boolean;
}) {
  const t = useFa();
  return (
    <Spread>
      {hideTotal ? (
        <span />
      ) : (
        <Text muted>
          {t('total')}: {formatNumber(total)}
        </Text>
      )}
      <Row>
        <Button variant="text" disabled={page === 1} onClick={() => onChange(page - 1)}>
          {t('previous')}
        </Button>
        <Text>{formatNumber(page)}</Text>
        <Button variant="text" disabled={page * limit >= total} onClick={() => onChange(page + 1)}>
          {t('next')}
        </Button>
      </Row>
    </Spread>
  );
}
const FileName = styled(Typography)({ minWidth: 0, overflowWrap: 'anywhere' });
export function FileInput({
  onChange,
  accept = '.csv,.xlsx',
  label,
}: {
  onChange: (file: File | null) => void;
  accept?: string;
  label?: string;
}) {
  const t = useFa();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const caption = label ?? t('file');
  return (
    <Stack>
      <Text variant="caption">{caption}</Text>
      <Row>
        <Button variant="outlined" icon="imports" onClick={() => input.current?.click()}>
          {t('chooseFile')}
        </Button>
        <FileName variant="caption" color="text.secondary">
          {name || t('noFile')}
        </FileName>
      </Row>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        aria-label={caption}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setName(file?.name ?? '');
          onChange(file);
        }}
      />
    </Stack>
  );
}
export function ThemeSwitch() {
  const { mode, toggle } = useMode();
  const t = useFa();
  return (
    <IconButton aria-label={t('theme')} onClick={toggle}>
      <Icon name={mode === 'light' ? 'moon' : 'sun'} />
    </IconButton>
  );
}
const RingBell = styled('span', {
  shouldForwardProp: (prop) => prop !== 'ring',
})<{ ring?: boolean }>(({ ring }) => ({
  display: 'inline-flex',
  transformOrigin: 'top center',
  ...(ring
    ? {
        animation: `safanoor-bell-ring ${tokens.motion.duration * 4}ms ease-in-out 1`,
      }
    : {}),
  '@keyframes safanoor-bell-ring': {
    '0%, 100%': { transform: 'rotate(0deg)' },
    '12%': { transform: 'rotate(14deg)' },
    '24%': { transform: 'rotate(-12deg)' },
    '36%': { transform: 'rotate(10deg)' },
    '48%': { transform: 'rotate(-8deg)' },
    '60%': { transform: 'rotate(4deg)' },
    '72%': { transform: 'rotate(-2deg)' },
  },
}));
export function HeaderNotifications() {
  const t = useFa();
  const [ring, setRing] = useState(false);
  const didRing = useRef(false);
  const query = useQuery({
    queryKey: ['notifications', 1],
    queryFn: () => api.notifications(1),
  });
  const unread = query.data?.items.filter((item) => !item.readAt).length ?? 0;
  useEffect(() => {
    if (didRing.current || unread < 1) return;
    didRing.current = true;
    setRing(true);
  }, [unread]);
  return (
    <IconButton component={Link} href="/notifications" aria-label={t('notifications')}>
      <Badge color="error" variant="dot" invisible={unread < 1} overlap="circular">
        <RingBell ring={ring}>
          <Icon name="notifications" />
        </RingBell>
      </Badge>
    </IconButton>
  );
}
export const Rule = Divider;
const ShellRoot = styled('div')({ minHeight: '100dvh' });
const Header = styled('header')(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 20,
  background: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));
const HeaderBody = styled(Spread)(({ theme }) => ({
  maxWidth: tokens.layout.max,
  marginInline: 'auto',
  padding: `${tokens.space.sm}px ${tokens.space.page}px`,
  flexWrap: 'nowrap',
  [theme.breakpoints.down('sm')]: {
    paddingInline: tokens.space.sm,
  },
}));
const HeaderActions = styled(Row)({ flexWrap: 'nowrap', gap: tokens.space.xs });
const BrandWords = styled(Stack)(({ theme }) => ({
  gap: 0,
  [theme.breakpoints.down('sm')]: { '& .MuiTypography-caption': { display: 'none' } },
}));
const Brand = styled(Row)(({ theme }) => ({
  color: theme.palette.primary.main,
  flexWrap: 'nowrap',
  gap: tokens.space.md,
}));
const Layout = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: `${tokens.layout.sidebar}px minmax(0,1fr)`,
  maxWidth: tokens.layout.max,
  marginInline: 'auto',
  [theme.breakpoints.down('md')]: { gridTemplateColumns: 'minmax(0,1fr)' },
}));
const Main = styled('main', {
  shouldForwardProp: (prop) =>
    !['member', 'theme', 'sx', 'as', 'ownerState'].includes(String(prop)),
})<{ member?: boolean }>(({ theme, member }) => ({
  padding: tokens.space.page,
  paddingBottom: member ? tokens.space.huge * 2 : tokens.space.page,
  minWidth: 0,
  [theme.breakpoints.up('md')]: { paddingBottom: tokens.space.page },
  [theme.breakpoints.down('sm')]: {
    padding: tokens.space.lg,
    paddingBottom: member ? tokens.space.huge * 2 : tokens.space.lg,
  },
}));
const Sidebar = styled('nav')(({ theme }) => ({
  position: 'sticky',
  top: tokens.artwork.logo + tokens.space.lg,
  alignSelf: 'start',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.sm,
  padding: tokens.space.page,
  minHeight: `calc(100dvh - ${tokens.artwork.logo + tokens.space.lg + tokens.space.lg}px)`,
  marginBlock: tokens.space.lg,
  borderRadius: tokens.radius.card,
  background: theme.palette.background.paper,
  boxShadow: tokens.shadow[theme.palette.mode],
  border: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down('md')]: { display: 'none' },
}));
const SidebarUser = styled(Stack)(({ theme }) => ({
  gap: tokens.space.xs,
  padding: `${tokens.space.sm}px ${tokens.space.md}px`,
  marginBottom: tokens.space.sm,
  borderRadius: tokens.radius.input,
  background: theme.palette.action.hover,
  alignItems: 'center',
  textAlign: 'center',
  '& .MuiAvatar-root': {
    width: 32,
    height: 32,
    fontSize: tokens.type.caption,
  },
}));
const SidebarUserMeta = styled(Stack)({
  gap: 0,
  minWidth: 0,
  width: '100%',
  alignItems: 'center',
  textAlign: 'center',
  '& .MuiTypography-root': { lineHeight: 1.35 },
});
const SidebarLinks = styled(Stack)({
  gap: tokens.space.sm,
  flex: 1,
});
const SidebarLogout = styled('button')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space.md,
  padding: tokens.space.md,
  marginTop: 'auto',
  border: `1px solid ${theme.palette.error.main}33`,
  borderRadius: tokens.radius.input,
  minHeight: tokens.layout.touch,
  background: `${theme.palette.error.main}14`,
  color: theme.palette.error.main,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: `background ${tokens.motion.duration}ms, border-color ${tokens.motion.duration}ms`,
  '&:hover': {
    background: `${theme.palette.error.main}24`,
    borderColor: `${theme.palette.error.main}55`,
  },
}));
const NavLink = styled(Link, {
  shouldForwardProp: (prop) =>
    !['active', 'theme', 'sx', 'as', 'ownerState'].includes(String(prop)),
})<{
  active?: boolean;
}>(({ theme, active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space.md,
  padding: tokens.space.md,
  borderRadius: tokens.radius.input,
  minHeight: tokens.layout.touch,
  color: active ? theme.palette.primary.main : theme.palette.text.secondary,
  background: active ? theme.palette.action.selected : 'transparent',
  whiteSpace: 'nowrap',
  transition: `background ${tokens.motion.duration}ms`,
  '&:hover': { background: theme.palette.action.hover },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: tokens.space.xs,
  },
  ...Object.fromEntries(
    Object.entries(tokens.joy[theme.palette.mode]).map(([tone, color]) => [
      `&[data-tone="${tone}"] > .MuiSvgIcon-root`,
      {
        color: color.ink,
        background: color.surface,
        padding: tokens.space.xs,
        borderRadius: tokens.radius.button,
        width: tokens.space.xxl,
        height: tokens.space.xxl,
      },
    ])
  ),
}));
const Bottom = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  bottom: tokens.space.md,
  insetInline: 0,
  zIndex: 30,
  width: 'fit-content',
  maxWidth: 'calc(100% - 24px)',
  marginInline: 'auto',
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: tokens.shadow[theme.palette.mode],
  overflow: 'hidden',
  [theme.breakpoints.up('md')]: { display: 'none' },
  '& .MuiBottomNavigation-root': {
    width: 'fit-content',
    height: tokens.layout.touch + tokens.space.xl,
    minHeight: tokens.layout.touch,
    justifyContent: 'center',
    gap: tokens.space.xs,
    paddingInline: tokens.space.sm,
  },
  '& .MuiBottomNavigationAction-root': {
    flex: '0 0 auto',
    minWidth: tokens.layout.touch,
    maxWidth: tokens.layout.touch + tokens.space.xl,
    minHeight: tokens.layout.touch,
    paddingInline: tokens.space.xs,
    paddingBlock: tokens.space.xs,
    color: theme.palette.text.secondary,
    '&.Mui-selected': { color: theme.palette.primary.main },
  },
  '& .MuiBottomNavigationAction-label': {
    fontSize: tokens.type.caption,
    marginTop: tokens.space.xs,
    '&.Mui-selected': { fontSize: tokens.type.caption, fontWeight: 700 },
  },
  '& .MuiSvgIcon-root': { fontSize: 22 },
}));
export type NavItem = { key: TextKey; href: string; icon: IconName; visible?: boolean };
export type ShellRoleOption = { id: string; label: string };
export type ShellUser = {
  name: string;
  role: string;
  /** Prefers server `activeRole.label` (e.g. «صفا ۳۳ - مربی»). */
  roleLabel?: string;
  groupName?: string;
  photoUrl?: string;
  roles?: ShellRoleOption[];
  activeRoleId?: string;
};

/** Desktop sidebar destinations for the member experience. */
const memberNav: NavItem[] = [
  { href: '/', key: 'home', icon: 'home' },
  { href: '/library', key: 'library', icon: 'library' },
  { href: '/meetings', key: 'meetings', icon: 'meetings' },
  { href: '/consultations', key: 'consultations', icon: 'consultations' },
  { href: '/classes', key: 'classes', icon: 'classes' },
  { href: '/group-album', key: 'groupAlbum', icon: 'groupAlbum' },
  { href: '/finance', key: 'finance', icon: 'finance' },
  { href: '/camp-attendance', key: 'campAttendance', icon: 'campAttendance' },
];
/** Mobile bottom bar — DOM order = RTL visual right→left. */
const bottomNav: NavItem[] = [
  { href: '/profile', key: 'profile', icon: 'profile' },
  { href: '/programs', key: 'programs', icon: 'programs' },
  { href: '/', key: 'home', icon: 'home' },
  { href: '/admin/people', key: 'myGroup', icon: 'people' },
  { href: '/communications', key: 'communications', icon: 'communications' },
];
function navActive(path: string, href: string) {
  if (href === '/') return path === '/' || path === '/dashboard';
  return path === href || path.startsWith(`${href}/`);
}
function bottomNavIcon(item: NavItem, user?: ShellUser) {
  if (item.href !== '/profile') return <Icon name={item.icon} />;
  if (!user) return <Icon name="profile" />;
  return <ProfileAvatar name={user.name} photoUrl={user.photoUrl} size={24} />;
}
export function Shell({
  children,
  admin = false,
  nav = [],
  user,
  onLogout,
  onRoleChange,
  roleSwitchBusy = false,
}: {
  children: ReactNode;
  admin?: boolean;
  nav?: NavItem[];
  user?: ShellUser;
  onLogout: () => void;
  onRoleChange?: (roleId: string) => void;
  roleSwitchBusy?: boolean;
}) {
  const t = useFa();
  const path = usePathname();
  const [roleMenu, setRoleMenu] = useState<null | HTMLElement>(null);
  const adminItems = nav.filter((item) => item.visible !== false);
  const items = [...memberNav, ...adminItems];
  const showBottom =
    !admin || bottomNav.some((item) => item.href !== '/' && navActive(path, item.href));
  const bottomValue = bottomNav.find((item) => navActive(path, item.href))?.href ?? false;
  const roleLabel = user
    ? (user.roleLabel ??
      (user.groupName ? `${user.groupName} - ${t(user.role as TextKey)}` : t(user.role as TextKey)))
    : '';
  const canSwitchRole = !!user?.roles && user.roles.length > 1 && !!onRoleChange;
  return (
    <ShellRoot>
      <Header>
        <HeaderBody>
          <Link href="/">
            <Brand>
              <BrandLogo alt={t('brand')} />
              <BrandWords>
                <Text variant="subtitle">{t('brand')}</Text>
                <Text variant="caption" muted>
                  {t('tagline')}
                </Text>
              </BrandWords>
            </Brand>
          </Link>
          <HeaderActions>
            <HeaderNotifications />
            <ThemeSwitch />
          </HeaderActions>
        </HeaderBody>
      </Header>
      <Layout>
        <Sidebar>
          {user && (
            <SidebarUser>
              <Link href="/profile" aria-label={t('profile')}>
                <ProfileAvatar name={user.name} photoUrl={user.photoUrl} />
              </Link>
              <SidebarUserMeta>
                <Text variant="subtitle">{user.name}</Text>
                {canSwitchRole ? (
                  <RoleSwitchButton
                    type="button"
                    aria-label={t('switchRole')}
                    aria-haspopup="menu"
                    aria-expanded={Boolean(roleMenu)}
                    disabled={roleSwitchBusy}
                    onClick={(event) => setRoleMenu(event.currentTarget)}
                  >
                    <Text variant="caption" muted>
                      {roleLabel}
                    </Text>
                    <KeyboardArrowDownRounded fontSize="small" />
                  </RoleSwitchButton>
                ) : (
                  <Text variant="caption" muted>
                    {roleLabel}
                  </Text>
                )}
              </SidebarUserMeta>
              <Menu
                anchorEl={roleMenu}
                open={Boolean(roleMenu)}
                onClose={() => setRoleMenu(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
              >
                {(user.roles ?? []).map((role) => (
                  <MenuItem
                    key={role.id}
                    selected={role.id === user.activeRoleId}
                    disabled={roleSwitchBusy}
                    onClick={() => {
                      setRoleMenu(null);
                      if (role.id !== user.activeRoleId) onRoleChange?.(role.id);
                    }}
                  >
                    {role.label}
                  </MenuItem>
                ))}
              </Menu>
            </SidebarUser>
          )}
          <SidebarLinks>
            {items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                active={navActive(path, item.href)}
                data-tone={iconTone(item.icon)}
                aria-current={navActive(path, item.href) ? 'page' : undefined}
              >
                <Icon name={item.icon} />
                {t(item.key)}
              </NavLink>
            ))}
          </SidebarLinks>
          <SidebarLogout type="button" onClick={onLogout} aria-label={t('logout')}>
            <Icon name="logout" />
            {t('logout')}
          </SidebarLogout>
        </Sidebar>
        <Main member={!admin}>
          <Section>{children}</Section>
        </Main>
      </Layout>
      {showBottom && (
        <Bottom>
          <BottomNavigation showLabels value={bottomValue}>
            {bottomNav.map((item) => (
              <BottomNavigationAction
                component={Link}
                href={item.href}
                key={item.href}
                value={item.href}
                aria-label={t(item.key)}
                label={t(item.key)}
                icon={bottomNavIcon(item, user)}
              />
            ))}
          </BottomNavigation>
        </Bottom>
      )}
    </ShellRoot>
  );
}
const RoleSwitchButton = styled('button')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space.xs,
  margin: 0,
  padding: `2px ${tokens.space.xs}px`,
  border: 'none',
  borderRadius: tokens.radius.input,
  background: 'transparent',
  color: theme.palette.text.secondary,
  cursor: 'pointer',
  minHeight: 44,
  '&:disabled': { opacity: 0.6, cursor: 'default' },
  '& .MuiSvgIcon-root': { fontSize: 18 },
}));
const AuthRoot = styled('main')(({ theme }) => ({
  minHeight: '100dvh',
  display: 'grid',
  gridTemplateColumns: '1.05fr 1fr',
  alignItems: 'center',
  gap: tokens.space.huge,
  padding: tokens.space.huge,
  maxWidth: tokens.layout.max,
  marginInline: 'auto',
  [theme.breakpoints.down('md')]: {
    gridTemplateColumns: '1fr',
    padding: tokens.space.xl,
    gap: tokens.space.xl,
  },
}));
const AuthArtwork = styled(Stack)(({ theme }) => ({
  minHeight: 440,
  borderRadius: tokens.radius.dialog,
  padding: tokens.space.huge,
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'center',
  background: `linear-gradient(145deg, ${tokens.joy[theme.palette.mode].mint.surface}, ${tokens.joy[theme.palette.mode].lavender.surface})`,
  border: `1px solid ${theme.palette.divider}`,
  '& > img': { width: tokens.artwork.auth },
  [theme.breakpoints.down('md')]: {
    minHeight: 'auto',
    order: 2,
    padding: tokens.space.xl,
    '& > img': { width: tokens.artwork.compact },
  },
}));
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useFa();
  return (
    <AuthRoot>
      <AuthArtwork>
        <Brand>
          <BrandLogo alt={t('brand')} />
          <Text variant="title">{t('brand')}</Text>
        </Brand>
        <JoyIllustration
          src="/assets/illustrations/safanoor-3d.webp"
          alt=""
          width={512}
          height={512}
          fetchPriority="high"
        />
        <Text variant="title">{t('loginArtworkTitle')}</Text>
        <Text muted>{t('loginArtworkHint')}</Text>
        <Rule />
        <Row justifyContent="center">
          <Icon name="lock" />
          <Text>{t('private')}</Text>
        </Row>
        <Text muted>{t('privacyHint')}</Text>
      </AuthArtwork>
      <Section>
        <Spread>
          <Text variant="subtitle">{t('welcome')}</Text>
          <ThemeSwitch />
        </Spread>
        <Card>{children}</Card>
      </Section>
    </AuthRoot>
  );
}
const HeroCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(120deg, ${tokens.joy[theme.palette.mode].mint.surface}, ${theme.palette.background.paper}, ${tokens.joy[theme.palette.mode].lavender.surface})`,
  padding: tokens.space.xxl,
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space.xl,
  justifyContent: 'space-between',
  [theme.breakpoints.down('sm')]: {
    padding: tokens.space.xl,
    gap: tokens.space.sm,
    flexWrap: 'wrap',
  },
}));
export function Hero({ name }: { name: string }) {
  const t = useFa();
  return (
    <HeroCard>
      <Stack>
        <Chip>{t('hello', { name })}</Chip>
        <Text variant="title">{t('dashboardTitle')}</Text>
        <Text muted>{t('homeIntro')}</Text>
      </Stack>
      <JoyIllustration
        src="/assets/illustrations/together.webp"
        alt=""
        width={512}
        height={512}
        fetchPriority="high"
      />
    </HeroCard>
  );
}
const FeedButton = styled('button')(({ theme }) => ({
  width: '100%',
  textAlign: 'start',
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space.lg,
  padding: tokens.space.lg,
  border: 0,
  borderRadius: tokens.radius.input,
  background: 'transparent',
  color: theme.palette.text.primary,
  cursor: 'pointer',
  minHeight: tokens.layout.touch,
  '&:hover': { background: theme.palette.action.hover },
}));
const FeedAvatarsOnly = styled(FeedButton)(({ theme }) => ({
  justifyContent: 'flex-start',
  alignItems: 'center',
  padding: `${tokens.space.sm}px ${tokens.space.md}px`,
  minHeight: tokens.layout.touch,
  gap: tokens.space.sm,
  borderRadius: tokens.radius.card,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: tokens.shadow[theme.palette.mode],
  background: theme.palette.background.paper,
  '&:hover': {
    background: theme.palette.action.hover,
    borderColor: theme.palette.primary.main,
  },
}));
const FeedCopy = styled(Stack)({ flex: 1, overflow: 'hidden', gap: tokens.space.xs });
export function FeedItem({
  title,
  time,
  unread,
  onRead,
  names,
  avatarsOnly = false,
}: {
  title: string;
  time: string;
  unread: boolean;
  onRead: () => void;
  names?: string[];
  /** Thread-style preview: overlapping avatars + last message time. */
  avatarsOnly?: boolean;
}) {
  const t = useFa();
  const avatarNames =
    names && names.length > 0
      ? names
      : title
          .split(/\s*[،,↔]\s*/)
          .map((part) => part.trim())
          .filter(Boolean)
          .slice(0, 2);
  if (avatarsOnly) {
    return (
      <FeedAvatarsOnly onClick={onRead} aria-label={title}>
        <DualAvatar names={avatarNames} />
        <Text muted variant="caption">
          {time}
        </Text>
      </FeedAvatarsOnly>
    );
  }
  return (
    <FeedButton onClick={onRead} aria-label={`${title} ${t('markRead')}`}>
      <Badge color="primary" variant="dot" invisible={!unread}>
        <Avatar name={title} />
      </Badge>
      <FeedCopy>
        <Text variant="subtitle">{title}</Text>
        <Text muted variant="caption">
          {time}
        </Text>
      </FeedCopy>
    </FeedButton>
  );
}
/** Full-height chat shell: fills the main column under the app header. */
export const ChatPage = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  height: `calc(100dvh - 72px - ${tokens.space.page * 2}px)`,
  [theme.breakpoints.down('sm')]: {
    height: `calc(100dvh - 72px - ${tokens.space.lg * 2}px - ${tokens.space.huge * 2}px)`,
  },
}));
export const ChatSplit = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)',
  flex: 1,
  minHeight: 0,
  height: '100%',
  borderRadius: tokens.radius.card,
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  boxShadow: tokens.shadow[theme.palette.mode],
  overflow: 'hidden',
  [theme.breakpoints.down('md')]: {
    gridTemplateColumns: '1fr',
  },
}));
export const ChatPane = styled('div')<{ hidden?: boolean }>(({ theme, hidden }) => ({
  display: hidden ? 'none' : 'flex',
  flexDirection: 'column',
  gap: 0,
  minHeight: 0,
  height: '100%',
  overflow: 'hidden',
  background: theme.palette.background.paper,
  '&[data-pane="list"]': {
    border: `1px solid ${theme.palette.divider}`,
  },
  [theme.breakpoints.down('md')]: {
    '&[data-pane="list"]': { borderInlineEnd: 0 },
  },
}));
export const ChatSearchPad = styled('div')({
  padding: `${tokens.space.md}px ${tokens.space.md}px ${tokens.space.sm}px`,
});
export const ChatCenter = styled('div')({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: tokens.space.xl,
  minHeight: 0,
});
export const ChatInset = styled('div')({
  paddingInline: tokens.space.lg,
  paddingBlock: tokens.space.md,
});
export function useCompactLayout() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('md'));
}
const DualAvatarWrap = styled('div')(({ theme }) => ({
  position: 'relative',
  width: 48,
  height: 40,
  flexShrink: 0,
  '& .MuiAvatar-root': { border: `2px solid ${theme.palette.background.paper}` },
}));
const DualAvatarFront = styled('div')({
  position: 'absolute',
  insetInlineStart: 0,
  top: 0,
  zIndex: 1,
});
const DualAvatarBack = styled('div')({
  position: 'absolute',
  insetInlineStart: 16,
  top: 4,
  zIndex: 0,
});
export function DualAvatar({ names }: { names: string[] }) {
  if (names.length === 0) return <Avatar name="…" size={40} />;
  if (names.length === 1) return <Avatar name={names[0]!} size={40} />;
  return (
    <DualAvatarWrap>
      <DualAvatarFront>
        <Avatar name={names[0]!} size={32} />
      </DualAvatarFront>
      <DualAvatarBack>
        <Avatar name={names[1]!} size={28} />
      </DualAvatarBack>
    </DualAvatarWrap>
  );
}
const ThreadButton = styled('button')<{ active?: boolean }>(({ theme, active }) => ({
  width: '100%',
  textAlign: 'start',
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space.md,
  padding: `${tokens.space.md}px ${tokens.space.lg}px`,
  border: 0,
  borderRadius: 0,
  position: 'relative',
  background: active ? theme.palette.action.selected : 'transparent',
  color: theme.palette.text.primary,
  cursor: 'pointer',
  minHeight: tokens.layout.touch + tokens.space.sm,
  transition: `background ${tokens.motion.duration}ms ease`,
  '&::before': active
    ? {
        content: '""',
        position: 'absolute',
        insetInlineStart: 0,
        top: tokens.space.sm,
        bottom: tokens.space.sm,
        width: 3,
        borderRadius: tokens.radius.round,
        background: theme.palette.primary.main,
      }
    : undefined,
  '&:hover': { background: theme.palette.action.hover },
}));
const ThreadMeta = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: tokens.space.xs,
  flexShrink: 0,
  minWidth: 56,
});
export function ThreadListItem({
  title,
  preview,
  time,
  active,
  onSelect,
  names,
  badge,
}: {
  title: string;
  preview?: string | null;
  time?: string | null;
  active?: boolean;
  onSelect: () => void;
  names?: string[];
  badge?: number | null;
}) {
  return (
    <ThreadButton type="button" active={active} onClick={onSelect} aria-current={active}>
      <DualAvatar names={names?.length ? names : [title]} />
      <FeedCopy>
        <Typography
          variant="body1"
          color="text.primary"
          fontWeight={650}
          noWrap
          sx={{ fontSize: tokens.type.body, lineHeight: tokens.type.line }}
        >
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {preview || '—'}
        </Typography>
      </FeedCopy>
      <ThreadMeta>
        {time && (
          <Text muted variant="caption">
            {time}
          </Text>
        )}
        {typeof badge === 'number' && badge > 0 && (
          <Text muted variant="caption">
            {formatNumber(badge)}
          </Text>
        )}
      </ThreadMeta>
    </ThreadButton>
  );
}
const ChatHeaderRoot = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.md,
  padding: `${tokens.space.lg}px ${tokens.space.xl}px`,
  borderBottom: `1px solid ${theme.palette.divider}`,
  flexShrink: 0,
}));
const ChatHeaderPeople = styled('div')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: tokens.space.lg,
});
const ChatHeaderPerson = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space.md,
  minWidth: 0,
});
const ChatHeaderMeta = styled('div')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: `${tokens.space.sm}px ${tokens.space.xl}px`,
  color: theme.palette.text.secondary,
  fontSize: tokens.type.caption,
  lineHeight: tokens.type.line,
}));
const ChatHeaderMetaItem = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: tokens.space.xs,
  color: theme.palette.text.secondary,
  '& .iconify': { flexShrink: 0, opacity: 0.85 },
}));
const ChatHeaderMetaSep = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  color: theme.palette.divider,
  lineHeight: 0,
}));
export function ChatThreadHeader({
  kind,
  title,
  participants,
  messageCount,
  lastActivity,
  onBack,
  backLabel,
  countLabel,
  activityLabel,
  groupLabel,
  directLabel,
}: {
  kind: 'group' | 'direct';
  title: string;
  participants: { id: string; name: string; phone?: string | null }[];
  messageCount: number;
  lastActivity?: string | null;
  onBack?: () => void;
  backLabel?: string;
  countLabel: string;
  activityLabel: string;
  groupLabel: string;
  directLabel: string;
}) {
  const people =
    kind === 'group'
      ? [{ id: 'group', name: title }]
      : participants.length >= 2
        ? participants.slice(0, 2)
        : participants.length > 0
          ? [participants[0]!]
          : [{ id: 'group', name: title }];
  return (
    <ChatHeaderRoot>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: tokens.space.sm }}>
        {onBack && (
          <IconButton aria-label={backLabel} onClick={onBack} size="small">
            <Icon name="back" />
          </IconButton>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ChatHeaderPeople>
            {people.map((person, index) => (
              <Box
                key={person.id}
                sx={{ display: 'flex', alignItems: 'center', gap: tokens.space.lg, minWidth: 0 }}
              >
                {index > 0 && (
                  <Typography color="text.secondary" fontWeight={650} sx={{ flexShrink: 0 }}>
                    ↔
                  </Typography>
                )}
                <ChatHeaderPerson>
                  <Avatar name={person.name} size={44} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={650} noWrap lineHeight={1.4}>
                      {person.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {kind === 'group' ? groupLabel : directLabel}
                    </Typography>
                  </Box>
                </ChatHeaderPerson>
              </Box>
            ))}
          </ChatHeaderPeople>
        </Box>
      </Box>
      <ChatHeaderMeta>
        <ChatHeaderMetaItem>
          <Iconify icon="solar:chat-round-line-bold" width={16} height={16} className="" sx={{}} />
          {countLabel}: {formatNumber(messageCount)}
        </ChatHeaderMetaItem>
        {lastActivity ? (
          <>
            <ChatHeaderMetaSep aria-hidden>
              <Iconify
                icon="solar:alt-arrow-left-linear"
                width={14}
                height={14}
                className=""
                sx={{}}
              />
            </ChatHeaderMetaSep>
            <ChatHeaderMetaItem>
              <Iconify icon="solar:clock-circle-bold" width={16} height={16} className="" sx={{}} />
              {activityLabel}: {lastActivity}
            </ChatHeaderMetaItem>
          </>
        ) : null}
      </ChatHeaderMeta>
    </ChatHeaderRoot>
  );
}
export const MessageList = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.lg,
  flex: 1,
  overflowY: 'auto',
  padding: `${tokens.space.lg}px ${tokens.space.xl}px`,
  minHeight: 0,
});
const BubbleRow = styled('div')<{ mine?: boolean }>(({ mine }) => ({
  display: 'flex',
  width: '100%',
  justifyContent: mine ? 'flex-end' : 'flex-start',
  alignItems: 'flex-start',
  gap: tokens.space.sm,
  flexDirection: mine ? 'row-reverse' : 'row',
}));
const BubbleColumn = styled('div')<{ mine?: boolean }>(({ mine }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.xs,
  alignItems: mine ? 'flex-end' : 'flex-start',
  minWidth: 0,
  maxWidth: 'min(78%, 420px)',
}));
const Bubble = styled('div')<{ mine?: boolean }>(({ theme, mine }) => ({
  maxWidth: '100%',
  padding: `${tokens.space.sm}px ${tokens.space.md}px`,
  borderRadius: tokens.radius.input,
  background: mine
    ? theme.palette.mode === 'light'
      ? tokens.palette.light.elevated
      : tokens.palette.dark.elevated
    : theme.palette.mode === 'light'
      ? theme.palette.grey[100]
      : theme.palette.grey[800],
  color: theme.palette.text.primary,
  border: `1px solid ${mine ? theme.palette.primary.light : theme.palette.divider}`,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.xs,
}));
export function MessageBubble({
  author,
  body,
  time,
  mine,
}: {
  author: string;
  body: string;
  time: string;
  mine?: boolean;
}) {
  return (
    <BubbleRow mine={mine}>
      <Avatar name={author || '…'} size={32} />
      <BubbleColumn mine={mine}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
          {author}
          {author ? ' · ' : ''}
          {time}
        </Typography>
        <Bubble mine={mine}>
          <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{body}</Typography>
        </Bubble>
      </BubbleColumn>
    </BubbleRow>
  );
}
export const Composer = styled('form')(({ theme }) => ({
  display: 'flex',
  gap: tokens.space.sm,
  alignItems: 'flex-end',
  padding: `${tokens.space.md}px ${tokens.space.lg}px`,
  borderTop: `1px solid ${theme.palette.divider}`,
  flexShrink: 0,
}));
const ThreadListScroll = styled('div')({
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
});
export { ThreadListScroll };
export function PreviewTheme({ mode, children }: { mode: 'light' | 'dark'; children: ReactNode }) {
  return (
    <ThemeProvider theme={makeTheme(mode)}>
      <Card>{children}</Card>
    </ThemeProvider>
  );
}
export function TokenSwatches() {
  const { mode } = useMode();
  return (
    <Grid>
      {Object.entries(tokens.palette[mode]).map(([name, value]) => (
        <Card key={name}>
          <Box
            sx={{ background: value, height: tokens.space.huge, borderRadius: tokens.radius.input }}
          />
          <Text>{name}</Text>
          <Text muted>{value}</Text>
        </Card>
      ))}
      {Object.entries(tokens.joy[mode]).map(([name, tone]) => (
        <Card key={name}>
          <Box
            sx={{
              background: tone.surface,
              color: tone.ink,
              padding: tokens.space.lg,
              borderRadius: tokens.radius.input,
            }}
          >
            <Text>{name}</Text>
          </Box>
          <Text muted>
            {tone.ink} · {tone.surface}
          </Text>
        </Card>
      ))}
    </Grid>
  );
}

export const DesignLayout = styled('main')({
  maxWidth: tokens.layout.max,
  marginInline: 'auto',
  padding: tokens.space.page,
});

export { QuickAccess, JoyIllustration } from './joy';
export { DonutChart, BarSeriesChart } from './charts';

export { cropAvatarFile, AvatarCropPanel } from './avatar-crop';
