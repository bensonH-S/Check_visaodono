import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { TOAST_DURATION_MS } from '../utils/toast';
import { colors, radius, shadows } from '../theme/tokens';

export default function AppToastContainer() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={TOAST_DURATION_MS}
      hideProgressBar
      newestOnTop
      closeOnClick
      pauseOnHover
      draggable={false}
      theme="light"
      limit={3}
      toastStyle={{
        borderRadius: radius.md,
        fontFamily: '"Inter", sans-serif',
        fontSize: '0.8125rem',
        fontWeight: 500,
        color: colors.textPrimary,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.card,
        padding: '12px 16px',
      }}
      style={{
        zIndex: 10000,
        top: 'max(20px, env(safe-area-inset-top, 0px))',
        right: 'max(20px, env(safe-area-inset-right, 0px))',
      }}
    />
  );
}
