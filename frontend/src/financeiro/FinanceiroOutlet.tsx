import { Outlet, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import { PrefsProvider } from './prefs';
import FinancePrefsBar from './FinancePrefsBar';

/** Páginas Azimut no shell Meridian — prefs locais + barra PT/EN na Configuração. */
export default function FinanceiroOutlet() {
  return (
    <PrefsProvider>
      <FinanceiroShell />
    </PrefsProvider>
  );
}

function FinanceiroShell() {
  const { pathname } = useLocation();
  const emConfig = pathname.includes('/financeiro/configuracoes');

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {emConfig ? <FinancePrefsBar /> : null}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
