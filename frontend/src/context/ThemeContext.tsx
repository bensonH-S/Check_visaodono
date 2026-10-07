import React, { createContext, useContext, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme } from '../theme';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Tema escuro desligado por enquanto — portal só no claro (chrome Azimut). */
const DARK_THEME_ENABLED = false;

export function CustomThemeProvider({ children }: { children: React.ReactNode }) {
  const mode: ThemeMode = 'light';

  const setMode = (_newMode: ThemeMode) => {
    if (!DARK_THEME_ENABLED) return;
  };

  const toggleTheme = () => {
    if (!DARK_THEME_ENABLED) return;
  };

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('app-theme-mode', 'light');
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setMode }}>
      <MuiThemeProvider theme={lightTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within a CustomThemeProvider');
  }
  return context;
}
