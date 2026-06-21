import { toast, type ToastOptions, type Id } from 'react-toastify';
import type { AlertColor } from '@mui/material/Alert';

export const TOAST_DURATION_MS = 3500;

const emitters: Record<AlertColor, (message: string, opts?: ToastOptions) => Id> = {
  success: (message, opts) => toast.success(message, opts),
  error: (message, opts) => toast.error(message, opts),
  warning: (message, opts) => toast.warning(message, opts),
  info: (message, opts) => toast.info(message, opts),
};

function toastIdFor(message: string, severity: AlertColor, opts?: ToastOptions): Id {
  return opts?.toastId ?? `${severity}:${message}`;
}

export function showToast(
  message: string,
  severity: AlertColor = 'success',
  opts?: ToastOptions,
) {
  const id = toastIdFor(message, severity, opts);
  if (toast.isActive(id)) return id;
  const fn = emitters[severity] ?? emitters.info;
  return fn(message, {
    autoClose: TOAST_DURATION_MS,
    toastId: id,
    ...opts,
  });
}
