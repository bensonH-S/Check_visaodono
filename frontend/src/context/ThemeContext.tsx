import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from '../theme';

type ThemeMode = 'light' | 'dark';

/** Alinhado ao breakpoint `md` do MUI / layout mobile do portal. */
const MOBILE_VIEWPORT_MQ = '(max-width: 899.95px)';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readIsMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_VIEWPORT_MQ).matches;
}

function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(readIsMobileViewport);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_VIEWPORT_MQ);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

export function CustomThemeProvider({ children }: { children: React.ReactNode }) {
  const isMobileViewport = useIsMobileViewport();
  const [preferredMode, setPreferredMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('app-theme-mode');
    return saved === 'light' ? 'light' : 'dark';
  });

  // Mobile: força claro (preferência do usuário permanece para o desktop).
  const mode: ThemeMode = isMobileViewport ? 'light' : preferredMode;

  const setMode = (newMode: ThemeMode) => {
    setPreferredMode(newMode);
    localStorage.setItem('app-theme-mode', newMode);
  };

  const toggleTheme = () => {
    if (isMobileViewport) return;
    setMode(preferredMode === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    // Add class to body for tailwind or raw css usage if needed
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
