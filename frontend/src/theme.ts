import { createTheme } from '@mui/material/styles';
import { colors, radius, shadows } from './theme/tokens';

export { colors, shadows, radius } from './theme/tokens';
export { portalPanelSx, portalCardSx, portalIconBoxSx, sectionLabelSx } from './theme/tokens';

const baseThemeOptions = {
  /* Densidade ~90% do zoom do browser: UI mais compacta em 100%. */
  spacing: 7,
  typography: {
    /* Escala Azimut: corpo 12px, pesos 400/500/600 */
    htmlFontSize: 14.5,
    fontSize: 12,
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeightLight: 400,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
    h5: { fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em' },
    h6: { fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' },
    subtitle1: { fontWeight: 500, fontSize: 13 },
    subtitle2: { fontWeight: 500, fontSize: 12 },
    body1: { fontSize: 12, fontWeight: 400, lineHeight: 1.45 },
    body2: { fontSize: 12, fontWeight: 400, lineHeight: 1.45 },
    button: { fontWeight: 500, textTransform: 'none' as const, fontSize: 12 },
    caption: { fontWeight: 400, fontSize: 11 },
  },
  shape: { borderRadius: radius.md },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 12,
          fontWeight: 400,
          lineHeight: 1.45,
          color: colors.textPrimary,
          WebkitFontSmoothing: 'antialiased',
          textRendering: 'optimizeLegibility',
        },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: {
      defaultProps: { disableElevation: true, size: 'small' as const },
      styleOverrides: {
        root: { borderRadius: 7, fontWeight: 500, fontSize: 12, padding: '4px 12px', minHeight: 30 },
        sizeSmall: { fontSize: 12, padding: '3px 10px', minHeight: 28 },
        contained: {
          '&.MuiButton-containedPrimary': {
            backgroundColor: 'var(--ga-primary-btn) !important',
            color: '#FFFFFF !important',
            '&:hover': { backgroundColor: 'var(--ga-primary-hover) !important' },
          },
        },
        outlined: {
          borderColor: colors.border,
          color: colors.textPrimary,
          '&:hover': { borderColor: colors.borderStrong, bgcolor: colors.canvasAlt },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, fontSize: 11, height: 24 },
        sizeSmall: { height: 20, fontSize: 11 },
        outlined: { borderColor: colors.border },
        outlinedSuccess: {
          borderColor: 'rgba(5, 150, 105, 0.55)',
          color: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.12)',
          '& .MuiChip-icon': { color: '#059669' },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: 12, fontWeight: 400, minHeight: 32 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: 10,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--ga-text-muted)',
            backgroundColor: 'var(--ga-surface) !important',
            borderBottom: '1px solid var(--ga-border)',
            padding: '6px 10px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { fontSize: 12, fontWeight: 400, borderColor: colors.border, padding: '5px 10px' },
        sizeSmall: { padding: '4px 8px' },
      },
    },
    MuiTableRow: {
      styleOverrides: { root: { '&:hover': { bgcolor: colors.canvas } } },
    },
    MuiTextField: { defaultProps: { size: 'small' as const } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          color: colors.textPrimary,
          borderRadius: radius.md,
          bgcolor: colors.surface,
          fontSize: 12,
          '& .MuiOutlinedInput-input': { paddingTop: 7, paddingBottom: 7 },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.borderStrong },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--ga-navy)',
            borderWidth: 1.5,
          },
        },
        sizeSmall: {
          '& .MuiOutlinedInput-input': { paddingTop: 6, paddingBottom: 6 },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          '&.Mui-focused': { color: 'var(--ga-navy)' },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: colors.textSecondary },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.cardHover,
          bgcolor: colors.surface,
          backgroundImage: 'none',
          color: colors.textPrimary,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          color: colors.textPrimary,
          fontWeight: 700,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          color: colors.textPrimary,
          bgcolor: colors.surface,
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          bgcolor: colors.surface,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          '&.MuiAlert-standardInfo': {
            backgroundColor: 'var(--ga-canvas-alt)',
            color: 'var(--ga-text-primary)',
            border: '1px solid var(--ga-border)',
            '& .MuiAlert-icon': { color: 'var(--ga-text-secondary)' },
          },
          '&.MuiAlert-outlinedInfo': {
            borderColor: 'var(--ga-border)',
            color: 'var(--ga-text-primary)',
            '& .MuiAlert-icon': { color: 'var(--ga-text-secondary)' },
          },
          '&.MuiAlert-filledInfo': {
            backgroundColor: 'var(--ga-canvas-alt)',
            color: 'var(--ga-text-primary)',
            '& .MuiAlert-icon': { color: 'var(--ga-text-secondary)' },
          },
        },
      },
    },
    MuiLinearProgress: {
      defaultProps: { color: 'inherit' as const },
      styleOverrides: {
        root: { borderRadius: 4, bgcolor: 'var(--ga-progress-track)', color: 'var(--ga-progress-bar)' },
        bar: { borderRadius: 4, bgcolor: 'var(--ga-progress-bar)' },
      },
    },
  },
};

export const lightTheme = createTheme({
  ...baseThemeOptions,
  palette: {
    mode: 'light',
    primary: { main: '#1B6EF3', dark: '#0D4ECC', light: '#60A5FA', contrastText: '#fff' },
    secondary: { main: '#1B6EF3', dark: '#0D4ECC', light: '#60A5FA', contrastText: '#fff' },
    success: { main: '#059669', contrastText: '#fff' },
    warning: { main: '#D97706', contrastText: '#fff' },
    error: { main: '#DC2626', contrastText: '#fff' },
    background: { default: '#F7F9FC', paper: '#FFFFFF' },
    text: { primary: '#111827', secondary: '#64748B' },
    divider: '#E2E8F0',
  },
});

export const darkTheme = createTheme({
  ...baseThemeOptions,
  palette: {
    mode: 'dark',
    primary: { main: '#fe6c22', dark: '#e85f1a', light: '#ff9a5c', contrastText: '#fff' },
    secondary: { main: '#fe6c22', dark: '#e85f1a', contrastText: '#f5f5f5' },
    success: { main: '#22c55e', contrastText: '#052e16' },
    warning: { main: '#eab308', contrastText: '#431407' },
    error: { main: '#ef4444', contrastText: '#450a0a' },
    background: { default: '#0b1721', paper: '#333840' },
    text: { primary: '#f5f5f5', secondary: '#8d8d8d' },
    divider: 'rgba(255, 255, 255, 0.1)',
  },
});

export const theme = lightTheme;




