import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#1B2A6B',
      light: '#D6DCF0',
      dark: '#121d4a',
      contrastText: '#fff',
    },
    secondary: { main: '#1B2A6B' },
    success: { main: '#16A34A', contrastText: '#fff' },
    warning: { main: '#EAB308', contrastText: '#422006' },
    error: { main: '#DC2626', contrastText: '#fff' },
    background: { default: '#f5f5f3' },
  },
  typography: {
    htmlFontSize: 14,
    fontSize: 14,
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    h6: { fontWeight: 600, fontSize: '1rem' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          fontSize: '14px',
          WebkitTextSizeAdjust: '100%',
          textSizeAdjust: '100%',
        },
        body: {
          fontSize: '0.875rem',
          lineHeight: 1.45,
        },
      },
    },
  },
});
