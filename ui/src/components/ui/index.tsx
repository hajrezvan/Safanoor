'use client';

import type { ReactNode, ChangeEventHandler } from 'react';
import type { TextKey } from 'src/locales/fa';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatNumber } from '@safanoor/shared';

import AddRounded from '@mui/icons-material/AddRounded';
import SpaRounded from '@mui/icons-material/SpaRounded';
import HomeRounded from '@mui/icons-material/HomeRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import InboxRounded from '@mui/icons-material/InboxRounded';
import { styled, ThemeProvider } from '@mui/material/styles';
import PersonRounded from '@mui/icons-material/PersonRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import FileUploadRounded from '@mui/icons-material/FileUploadRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import NotificationsRounded from '@mui/icons-material/NotificationsRounded';
import {
  Box,
  Tab,
  Paper,
  Alert,
  Table,
  Badge,
  Drawer,
  Divider,
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
  DialogContent,
  DialogActions,
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
  BottomNavigationAction,
  Skeleton as MuiSkeleton,
} from '@mui/material';

import { tokens } from 'src/theme/tokens';
import { useFa } from 'src/locales/fa-provider';
import { useMode } from 'src/theme/mode-context';
import { makeTheme } from 'src/theme/safanoor-theme';

const icons = {
  home: HomeRounded,
  notifications: NotificationsRounded,
  profile: PersonRounded,
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
  brand: SpaRounded,
  empty: InboxRounded,
  lock: LockRounded,
};
export type IconName = keyof typeof icons;
export function Icon({ name }: { name: IconName }) {
  const Component = icons[name];
  return <Component />;
}
export const Stack = styled(MuiStack)({ gap: tokens.space.lg, minWidth: 0 });
export const Row = styled(Stack)({ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' });
export const Spread = styled(Row)({ justifyContent: 'space-between' });
export const Grid = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: tokens.space.xl,
  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))',
  [theme.breakpoints.down('sm')]: { gap: tokens.space.lg },
}));
export const FormGrid = styled(Grid)({
  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))',
});
export const Card = styled(Paper)(({ theme }) => ({
  borderRadius: tokens.radius.card,
  padding: tokens.space.xl,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: tokens.shadow[theme.palette.mode],
  minWidth: 0,
  overflow: 'hidden',
}));
export const Section = styled(Stack)({ gap: tokens.space.xl });
export const Form = styled('form')({
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.xl,
});
export function Text({
  children,
  variant = 'body',
  muted = false,
}: {
  children: ReactNode;
  variant?: 'display' | 'title' | 'subtitle' | 'body' | 'caption';
  muted?: boolean;
}) {
  const map = {
    display: 'h1',
    title: 'h2',
    subtitle: 'h3',
    body: 'body1',
    caption: 'caption',
  } as const;
  return (
    <Typography variant={map[variant]} color={muted ? 'text.secondary' : 'text.primary'}>
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
  icon,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'error' | 'secondary';
  icon?: IconName;
  href?: string;
}) {
  return href ? (
    <MuiButton
      component={Link}
      href={href}
      variant={variant}
      color={color}
      startIcon={icon ? <Icon name={icon} /> : undefined}
    >
      {children}
    </MuiButton>
  ) : (
    <MuiButton
      type={type}
      disabled={disabled}
      onClick={onClick}
      variant={variant}
      color={color}
      startIcon={icon ? <Icon name={icon} /> : undefined}
    >
      {children}
    </MuiButton>
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
  helperText,
  multiline = false,
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
  helperText?: string;
  multiline?: boolean;
}) {
  return (
    <TextField
      fullWidth
      label={label}
      value={value ?? ''}
      onChange={onChange}
      error={!!error}
      helperText={error || helperText}
      type={type}
      name={name}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      multiline={multiline}
      minRows={multiline ? 3 : undefined}
      slotProps={{ htmlInput: { dir: type === 'tel' || type === 'password' ? 'ltr' : undefined } }}
    />
  );
}
export function Search({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useFa();
  return (
    <TextField
      label={t('search')}
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
export function JalaliInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  error?: string;
}) {
  return (
    <DatePicker
      label={label}
      value={value}
      onChange={onChange}
      format="yyyy/MM/dd"
      slotProps={{ textField: { fullWidth: true, error: !!error, helperText: error } }}
    />
  );
}
export function Chip({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'error';
}) {
  return <MuiChip size="small" label={children} color={tone} variant="outlined" />;
}
export function Avatar({ name }: { name: string }) {
  return <MuiAvatar>{name.slice(0, 1)}</MuiAvatar>;
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
      <Alert severity="success" onClose={onClose}>
        {message}
      </Alert>
    </Snackbar>
  );
}
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'error' | 'success';
}) {
  return <Alert severity={tone}>{children}</Alert>;
}
const Empty = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  textAlign: 'center',
  padding: tokens.space.xxl,
  color: theme.palette.text.secondary,
}));
export function EmptyState({
  title,
  hint,
  icon = 'empty',
  action,
}: {
  title?: string;
  hint?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  const t = useFa();
  return (
    <Empty>
      <Avatar name="✦" />
      <Icon name={icon} />
      <Text variant="subtitle">{title || t('empty')}</Text>
      <Text muted>{hint || t('emptyHint')}</Text>
      {action}
    </Empty>
  );
}
export function PageHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Spread>
      <Stack>
        <Text variant="title">{title}</Text>
        {hint && <Text muted>{hint}</Text>}
      </Stack>
      {action}
    </Spread>
  );
}
export function StatCard({
  title,
  value,
  icon = 'groups',
}: {
  title: string;
  value: number;
  icon?: IconName;
}) {
  return (
    <Card>
      <Spread>
        <Text muted>{title}</Text>
        <Icon name={icon} />
      </Spread>
      <Text variant="display">{formatNumber(value)}</Text>
    </Card>
  );
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
}: {
  loading: boolean;
  error: unknown;
  empty?: boolean;
  retry: () => void;
  children: ReactNode;
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
        <EmptyState />
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
}: {
  columns: { label: string; render: (row: T) => ReactNode }[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  return (
    <TableContainer component={Paper} sx={{ maxHeight: tokens.layout.tableHeight }}>
      <Table stickyHeader size="small" sx={{ minWidth: tokens.layout.tableMin }}>
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
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  const t = useFa();
  return (
    <Spread>
      <Text muted>
        {t('total')}: {formatNumber(total)}
      </Text>
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
export function FileInput({ onChange }: { onChange: (file: File | null) => void }) {
  const t = useFa();
  return (
    <TextField
      type="file"
      label={t('file')}
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { accept: '.csv,.xlsx' } }}
      onChange={(event) => onChange((event.target as HTMLInputElement).files?.[0] ?? null)}
    />
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
export const Rule = Divider;
const ShellRoot = styled('div')({ minHeight: '100dvh' });
const Header = styled('header')(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 20,
  background: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));
const HeaderBody = styled(Spread)({
  maxWidth: tokens.layout.max,
  marginInline: 'auto',
  padding: `${tokens.space.sm}px ${tokens.space.page}px`,
  flexWrap: 'nowrap',
});
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
const Layout = styled('div', {
  shouldForwardProp: (prop) => !['admin', 'theme', 'sx', 'as', 'ownerState'].includes(String(prop)),
})<{
  admin?: boolean;
}>(({ admin, theme }) => ({
  display: 'grid',
  gridTemplateColumns: admin ? `${tokens.layout.sidebar}px minmax(0,1fr)` : 'minmax(0,1fr)',
  maxWidth: tokens.layout.max,
  marginInline: 'auto',
  [theme.breakpoints.down('md')]: { gridTemplateColumns: 'minmax(0,1fr)' },
}));
const Main = styled('main')(({ theme }) => ({
  padding: tokens.space.page,
  paddingBottom: tokens.space.huge * 2,
  minWidth: 0,
  [theme.breakpoints.down('sm')]: {
    padding: tokens.space.lg,
    paddingBottom: tokens.space.huge * 2,
  },
}));
const Sidebar = styled('nav')(({ theme }) => ({
  position: 'sticky',
  top: 80,
  alignSelf: 'start',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space.sm,
  padding: tokens.space.page,
  [theme.breakpoints.down('md')]: {
    position: 'static',
    flexDirection: 'row',
    overflowX: 'auto',
    flexWrap: 'nowrap',
    padding: tokens.space.lg,
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
}));
const Bottom = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  bottom: tokens.space.md,
  insetInline: tokens.space.md,
  zIndex: 30,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: tokens.shadow[theme.palette.mode],
  overflow: 'hidden',
  maxWidth: 520,
  marginInline: 'auto',
}));
export type NavItem = { key: TextKey; href: string; icon: IconName; visible?: boolean };
export function Shell({
  children,
  admin = false,
  nav = [],
  canAdmin,
  onLogout,
}: {
  children: ReactNode;
  admin?: boolean;
  nav?: NavItem[];
  canAdmin: boolean;
  onLogout: () => void;
}) {
  const t = useFa();
  const path = usePathname();
  return (
    <ShellRoot>
      <Header>
        <HeaderBody>
          <Link href="/">
            <Brand>
              <Icon name="brand" />
              <BrandWords>
                <Text variant="subtitle">{t('brand')}</Text>
                <Text variant="caption" muted>
                  {t('tagline')}
                </Text>
              </BrandWords>
            </Brand>
          </Link>
          <HeaderActions>
            <ThemeSwitch />
            {canAdmin && (
              <Button href={admin ? '/' : '/admin'} variant="text">
                {t(admin ? 'home' : 'admin')}
              </Button>
            )}
            <IconButton aria-label={t('logout')} onClick={onLogout}>
              <Icon name="logout" />
            </IconButton>
          </HeaderActions>
        </HeaderBody>
      </Header>
      <Layout admin={admin}>
        {admin && (
          <Sidebar>
            {nav
              .filter((item) => item.visible !== false)
              .map((item) => (
                <NavLink key={item.href} href={item.href} active={path === item.href}>
                  <Icon name={item.icon} />
                  {t(item.key)}
                </NavLink>
              ))}
          </Sidebar>
        )}
        <Main>
          <Section>{children}</Section>
        </Main>
      </Layout>
      {!admin && (
        <Bottom>
          <BottomNavigation showLabels value={path}>
            {[
              { href: '/', key: 'home', icon: 'home' },
              { href: '/notifications', key: 'notifications', icon: 'notifications' },
              { href: '/profile', key: 'profile', icon: 'profile' },
            ].map((item) => (
              <BottomNavigationAction
                component={Link}
                href={item.href}
                key={item.href}
                value={item.href}
                label={t(item.key as TextKey)}
                icon={<Icon name={item.icon as IconName} />}
              />
            ))}
          </BottomNavigation>
        </Bottom>
      )}
    </ShellRoot>
  );
}
const AuthRoot = styled('main')(({ theme }) => ({
  minHeight: '100dvh',
  display: 'grid',
  gridTemplateColumns: '1.05fr 1fr',
  alignItems: 'center',
  gap: tokens.space.huge,
  padding: tokens.space.huge,
  maxWidth: tokens.layout.max,
  marginInline: 'auto',
  [theme.breakpoints.down('md')]: { gridTemplateColumns: '1fr', padding: tokens.space.xl },
}));
const AuthArtwork = styled(Stack)(({ theme }) => ({
  minHeight: 440,
  borderRadius: tokens.radius.dialog,
  padding: tokens.space.huge,
  justifyContent: 'center',
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down('md')]: { minHeight: 'auto', padding: tokens.space.xl },
}));
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useFa();
  return (
    <AuthRoot>
      <AuthArtwork>
        <Brand>
          <Icon name="brand" />
          <Text variant="title">{t('brand')}</Text>
        </Brand>
        <Text variant="display">{t('tagline')}</Text>
        <Text muted>{t('dashboardHint')}</Text>
        <Rule />
        <Row>
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
  background: theme.palette.background.paper,
  padding: tokens.space.xxl,
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space.xl,
  justifyContent: 'space-between',
}));
export function Hero({ name }: { name: string }) {
  const t = useFa();
  return (
    <HeroCard>
      <Stack>
        <Chip>{t('hello', { name })}</Chip>
        <Text variant="title">{t('dashboardTitle')}</Text>
        <Text muted>{t('dashboardHint')}</Text>
      </Stack>
      <Icon name="brand" />
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
const FeedCopy = styled(Stack)({ flex: 1, overflow: 'hidden', gap: tokens.space.xs });
export function FeedItem({
  title,
  time,
  unread,
  onRead,
}: {
  title: string;
  time: string;
  unread: boolean;
  onRead: () => void;
}) {
  const t = useFa();
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
      <Chip tone={unread ? 'success' : 'default'}>{t(unread ? 'unread' : 'read')}</Chip>
    </FeedButton>
  );
}
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
    </Grid>
  );
}

export const DesignLayout = styled('main')({
  maxWidth: tokens.layout.max,
  marginInline: 'auto',
  padding: tokens.space.page,
});
