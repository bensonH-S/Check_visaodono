import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from '../theme';
import { deveForcarTemaClaroMobile } from '../utils/device';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function CustomThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (deveForcarTemaClaroMobile()) return 'light';
    const saved = localStorage.getItem('app-theme-mode');
    return saved === 'light' ? 'light' : 'dark';
  });

  const setMode = (newMode: ThemeMode) => {
    if (deveForcarTemaClaroMobile()) {
      setModeState('light');
      return;
    }
    setModeState(newMode);
    localStorage.setItem('app-theme-mode', newMode);
  };

  const toggleTheme = () => {
    if (deveForcarTemaClaroMobile()) return;
    setMode(mode === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    if (deveForcarTemaClaroMobile()) {
      setModeState('light');
      document.documentElement.classList.remove('dark');
      return;
    }
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [mode]);

  const activeTheme = mode === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setMode }}>
      <MuiThemeProvider theme={activeTheme}>
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
