import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { getToken, getUsuario, setSessao } from '../lib/auth';
import { api } from '../api/client';
import { normalizeAppRoute } from '../config/paths';
import { isMobileDevice } from '../utils/device';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setOk(false);
      return;
    }

    let ativo = true;
    setOk(null);

    api
      .me()
      .then((usuario) => {
        if (!ativo) return;
        setSessao(token, usuario);
        setOk(true);
      })
      .catch((err) => {
        if (!ativo) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'Sessão expirada') {
          setOk(false);
          return;
        }
        // Ao reabrir o app (PWA), rede lenta não deve deslogar quem já tem sessão local.
        if (getToken() && getUsuario()) {
          setOk(true);
          return;
        }
        setOk(false);
      });

    return () => {
      ativo = false;
    };
  }, [location.pathname]);

  if (ok === null) {
    return (
      <Box className="flex items-center justify-center min-h-screen bg-[#f5f5f3]">
        <CircularProgress />
      </Box>
    );
  }

  if (!ok) {
    const loginPath = isMobileDevice() ? '/login/mobile' : '/login';
    return <Navigate to={loginPath} replace state={{ from: normalizeAppRoute(location.pathname) }} />;
  }

  return <>{children}</>;
}
