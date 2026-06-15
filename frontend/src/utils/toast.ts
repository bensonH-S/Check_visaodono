import { toast, type ToastOptions } from 'react-toastify';
import type { AlertColor } from '@mui/material/Alert';

export const TOAST_DURATION_MS = 3500;

const emitters: Record<AlertColor, (message: string, opts?: ToastOptions) => void> = {
  success: (message, opts) => toast.success(message, opts),
  error: (message, opts) => toast.error(message, opts),
  warning: (message, opts) => toast.warning(message, opts),
  info: (message, opts) => toast.info(message, opts),
};

export function showToast(
  message: string,
  severity: AlertColor = 'success',
  opts?: ToastOptions,
) {
  const fn = emitters[severity] ?? emitters.info;
  fn(message, {
    autoClose: TOAST_DURATION_MS,
    ...opts,
  });
}
