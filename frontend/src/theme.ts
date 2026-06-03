import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: { main: '#E8520A' },
    secondary: { main: '#1B2A6B' },
    success: { main: '#3B6D11' },
    warning: { main: '#854F0B' },
    error: { main: '#A32D2D' },
    background: { default: '#f5f5f3' },
  },
  typography: {
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
});
