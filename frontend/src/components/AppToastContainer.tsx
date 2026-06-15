import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { TOAST_DURATION_MS } from '../utils/toast';

/** Toasts globais no estilo ngx-toastr (canto superior direito, empilhados). */
export default function AppToastContainer() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={TOAST_DURATION_MS}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnHover
      draggable
      theme="colored"
      limit={5}
      rtl={false}
      toastStyle={{
        borderRadius: 8,
        fontFamily: '"Segoe UI", system-ui, sans-serif',
        fontSize: '0.875rem',
        boxShadow: '0 8px 24px rgba(27, 42, 107, 0.18)',
      }}
      style={{ zIndex: 10000 }}
    />
  );
}
