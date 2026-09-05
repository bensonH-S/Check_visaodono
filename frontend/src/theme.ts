import { createTheme } from '@mui/material/styles';
import { colors, radius, shadows } from './theme/tokens';

export { colors, shadows, radius } from './theme/tokens';
export { portalPanelSx, portalCardSx, portalIconBoxSx, sectionLabelSx } from './theme/tokens';

const baseThemeOptions = {
  typography: {
    htmlFontSize: 14,
    fontSize: 14,
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h6: { fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 500, fontSize: '0.9375rem' },
    subtitle2: { fontWeight: 500, fontSize: '0.8125rem' },
    body1: { fontSize: '0.875rem', lineHeight: 1.6 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.55 },
    button: { fontWeight: 500, textTransform: 'none' as const },
  },
  shape: { borderRadius: radius.md },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontSize: '0.875rem', lineHeight: 1.6, color: colors.textPrimary },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: radius.md, padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 500 },
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
        root: { fontWeight: 500, fontSize: '0.75rem' },
        outlined: { borderColor: colors.border },
        outlinedSuccess: {
          borderColor: 'rgba(5, 150, 105, 0.55)',
          color: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.12)',
          '& .MuiChip-icon': { color: '#059669' },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            color: 'var(--ga-text-secondary)',
            backgroundColor: 'var(--ga-surface) !important',
            borderBottom: '1px solid var(--ga-border)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: { root: { fontSize: '0.8125rem', borderColor: colors.border } },
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
          '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.borderStrong },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.orange,
            borderWidth: 1.5,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          '&.Mui-focused': { color: colors.orange },
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
        paper: { borderRadius: radius.lg, border: `1px solid ${colors.border}`, boxShadow: shadows.cardHover },
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
    primary: { main: '#1B2A6B', dark: '#152056', contrastText: '#fff' },
    secondary: { main: '#1B2A6B', dark: '#152056', contrastText: '#fff' },
    success: { main: '#059669', contrastText: '#fff' },
    warning: { main: '#D97706', contrastText: '#fff' },
    error: { main: '#DC2626', contrastText: '#fff' },
    background: { default: '#F9FAFB', paper: '#FFFFFF' },
    text: { primary: '#111827', secondary: '#6B7280' },
    divider: '#E5E7EB',
  },
});

export const darkTheme = createTheme({
  ...baseThemeOptions,
  palette: {
    mode: 'dark',
    primary: { main: '#E8520A', dark: '#c94508', light: '#FB923C', contrastText: '#fff' },
    secondary: { main: '#E8520A', dark: '#F97316', contrastText: '#E5E7EB' },
    success: { main: '#34D399', contrastText: '#052e16' },
    warning: { main: '#FB923C', contrastText: '#431407' },
    error: { main: '#F87171', contrastText: '#450a0a' },
    background: { default: '#0F172A', paper: '#1E293B' },
    text: { primary: '#F8FAFC', secondary: '#94A3B8' },
    divider: '#334155',
  },
});

export const theme = lightTheme;




