import { useCallback } from 'react';
import type { AlertColor } from '@mui/material/Alert';
import { showToast as globalShowToast, TOAST_DURATION_MS } from '../utils/toast';

export { TOAST_DURATION_MS };

export function useToast() {
  const showToast = useCallback((message: string, severity: AlertColor = 'success') => {
    globalShowToast(message, severity);
  }, []);

  /** Container global em App.tsx — mantido por compatibilidade com páginas existentes. */
  function ToastSnackbar() {
    return null;
  }

  return { showToast, ToastSnackbar };
}
