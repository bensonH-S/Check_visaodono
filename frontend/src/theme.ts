import { createTheme } from '@mui/material/styles';
import { colors, radius, shadows } from './theme/tokens';

export { colors, shadows, radius } from './theme/tokens';
export { portalPanelSx, portalCardSx, portalIconBoxSx, sectionLabelSx } from './theme/tokens';

export const theme = createTheme({
  palette: {
    primary: { main: colors.navy, dark: colors.navyDark, contrastText: '#fff' },
    secondary: { main: colors.orange, dark: colors.orangeHover, contrastText: '#fff' },
    success: { main: '#059669', contrastText: '#fff' },
    warning: { main: '#D97706', contrastText: '#fff' },
    error: { main: '#DC2626', contrastText: '#fff' },
    background: { default: colors.canvas, paper: colors.surface },
    text: { primary: colors.textPrimary, secondary: colors.textSecondary },
    divider: colors.border,
  },
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
          '&.MuiButton-containedPrimary': { '&:hover': { backgroundColor: colors.navyDark } },
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
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 500,
            fontSize: '0.75rem',
            color: colors.textSecondary,
            bgcolor: colors.canvas,
            borderBottom: `1px solid ${colors.border}`,
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
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          bgcolor: colors.surface,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.borderStrong },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.navy, borderWidth: 1 },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: radius.lg, border: `1px solid ${colors.border}`, boxShadow: shadows.cardHover },
      },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 4, bgcolor: colors.canvasAlt } },
    },
  },
});
