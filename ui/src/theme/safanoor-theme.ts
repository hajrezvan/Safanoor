import { faIR } from '@mui/material/locale';
import { createTheme } from '@mui/material/styles';

import { tokens, type Mode } from './tokens';

export function makeTheme(mode: Mode) {
  const p = tokens.palette[mode];
  return createTheme(
    {
      direction: 'rtl',
      spacing: tokens.space.unit,
      shape: { borderRadius: tokens.radius.card },
      palette: {
        mode,
        primary: { main: p.brand, contrastText: p.onBrand },
        secondary: { main: p.accent },
        background: { default: p.bg, paper: p.surface },
        text: { primary: p.text, secondary: p.secondary },
        divider: p.border,
        info: { main: p.brand },
        success: { main: p.success },
        warning: { main: p.warning },
        error: { main: p.error },
      },
      typography: {
        fontFamily: tokens.type.font,
        fontSize: tokens.type.body,
        allVariants: { fontVariantNumeric: 'tabular-nums' },
        h1: { fontSize: tokens.type.display, fontWeight: 700, lineHeight: 1.4 },
        h2: { fontSize: tokens.type.title, fontWeight: 650, lineHeight: 1.7 },
        h3: { fontSize: tokens.type.subtitle, fontWeight: 650, lineHeight: 1.7 },
        body1: { lineHeight: tokens.type.line },
        body2: { lineHeight: tokens.type.line },
        button: { fontWeight: 600, textTransform: 'none' },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            '*': { boxSizing: 'border-box' },
            body: { margin: 0 },
            a: { color: 'inherit', textDecoration: 'none' },
            'button,input,textarea': { fontFamily: tokens.type.font },
            '@media (prefers-reduced-motion: reduce)': {
              '*,*::before,*::after': {
                transition: 'none !important',
                animation: 'none !important',
                scrollBehavior: 'auto !important',
              },
            },
          },
        },
        MuiAvatar: {
          styleOverrides: {
            root: { background: p.elevated, color: p.brand, borderRadius: tokens.radius.round },
          },
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              borderRadius: tokens.radius.button,
              minHeight: tokens.layout.touch,
              paddingInline: tokens.space.xl,
              transition: `all ${tokens.motion.duration}ms ease`,
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: { minWidth: tokens.layout.touch, minHeight: tokens.layout.touch },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: { borderRadius: tokens.radius.input, minHeight: tokens.layout.touch },
          },
        },
        MuiPaper: {
          defaultProps: { elevation: 0 },
          styleOverrides: { root: { backgroundImage: 'none', borderRadius: tokens.radius.card } },
        },
        MuiDialog: { styleOverrides: { paper: { borderRadius: tokens.radius.dialog } } },
        MuiChip: {
          styleOverrides: {
            root: { borderRadius: tokens.radius.round, fontWeight: 600, alignSelf: 'flex-start' },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              borderColor: p.border,
              padding: tokens.space.lg,
              whiteSpace: 'nowrap',
              '& .MuiStack-root': { gap: tokens.space.xs },
            },
            head: { background: p.elevated, fontWeight: 600, whiteSpace: 'nowrap' },
          },
        },
        MuiSkeleton: { styleOverrides: { root: { borderRadius: tokens.radius.input } } },
        MuiTabs: { styleOverrides: { root: { minHeight: tokens.layout.touch } } },
        MuiAlert: { styleOverrides: { root: { borderRadius: tokens.radius.input } } },
      },
    },
    faIR
  );
}
