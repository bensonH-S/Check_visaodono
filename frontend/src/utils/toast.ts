import { toast, cssTransition, type ToastOptions, type Id } from 'react-toastify';
import type { AlertColor } from '@mui/material/Alert';

export const TOAST_DURATION_MS = 3500;
/** Visível ~0,7 s + saída ~0,08 s → menos de 1 s no total. */
export const WELCOME_TOAST_DURATION_MS = 700;

const welcomeTransition = cssTransition({
  enter: 'toast-welcome-enter',
  exit: 'toast-welcome-exit',
  collapse: false,
});

const WELCOME_TOAST_OPTS: ToastOptions = {
  autoClose: WELCOME_TOAST_DURATION_MS,
  pauseOnHover: false,
  pauseOnFocusLoss: false,
  closeOnClick: true,
  draggable: false,
  hideProgressBar: true,
  transition: welcomeTransition,
  className: 'toast-welcome-flash',
};

export function showWelcomeToast(nome: string) {
  const msg = `Bem-vindo, ${nome}!`;
  const toastId = `welcome:${nome}`;
  if (toast.isActive(toastId)) toast.dismiss(toastId);
  return toast.success(msg, { ...WELCOME_TOAST_OPTS, toastId });
}

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
    toastId: id,
    autoClose: TOAST_DURATION_MS,
    ...opts,
  });
}
