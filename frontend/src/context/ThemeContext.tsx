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

function readForceLightMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return deveForcarTemaClaroMobile();
}

function useForceLightMobile(): boolean {
  const [forceLight, setForceLight] = useState(readForceLightMobile);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899.95px)');
    const onChange = () => setForceLight(deveForcarTemaClaroMobile());
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return forceLight;
}

export function CustomThemeProvider({ children }: { children: React.ReactNode }) {
  const forceLightMobile = useForceLightMobile();
  const [preferredMode, setPreferredMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('app-theme-mode');
    return saved === 'light' ? 'light' : 'dark';
  });

  // App (telefone/tablet): sempre claro. Desktop guarda a preferência (sol/lua).
  const mode: ThemeMode = forceLightMobile ? 'light' : preferredMode;

  const setMode = (newMode: ThemeMode) => {
    setPreferredMode(newMode);
    localStorage.setItem('app-theme-mode', newMode);
  };

  const toggleTheme = () => {
    if (forceLightMobile) return;
    setMode(preferredMode === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
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
