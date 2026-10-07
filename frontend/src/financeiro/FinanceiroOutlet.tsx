import { Outlet } from 'react-router-dom';
import { PrefsProvider } from './prefs';

/** Páginas Azimut no shell Meridian — só idioma/prefs locais, sem Shell próprio. */
export default function FinanceiroOutlet() {
  return (
    <PrefsProvider>
      <Outlet />
    </PrefsProvider>
  );
}
