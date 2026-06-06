import { useCallback, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import type { AlertColor } from '@mui/material/Alert';

type ToastState = {
  message: string;
  severity: AlertColor;
};

export const TOAST_DURATION_MS = 2000;

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, severity: AlertColor = 'success') => {
    setToast({ message, severity });
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  function ToastSnackbar() {
    return (
      <Snackbar
        open={!!toast}
        autoHideDuration={TOAST_DURATION_MS}
        onClose={hideToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.severity || 'success'}
          variant="filled"
          onClose={hideToast}
          sx={{ width: '100%' }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    );
  }

  return { showToast, ToastSnackbar };
}
