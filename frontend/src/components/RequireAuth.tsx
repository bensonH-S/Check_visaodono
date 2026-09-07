import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken, getUsuario, setSessao } from '../lib/auth';
import { api } from '../api/client';
import { normalizeAppRoute } from '../config/paths';
import { isMobileDevice } from '../utils/device';
import PageLoading from './PageLoading';
import Box from '@mui/material/Box';
import { colors } from '../theme/tokens';

function sessaoLocalOk() {
  return Boolean(getToken() && getUsuario());
}

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [ok, setOk] = useState<boolean | null>(() => {
    if (sessaoLocalOk()) return true;
    if (!getToken()) return false;
    return null;
  });
  const jaAutenticado = useRef(sessaoLocalOk());

  useEffect(() => {
    const token = getToken();
    if (!token) {
      jaAutenticado.current = false;
      setOk(false);
      return;
    }

    let ativo = true;
    if (!jaAutenticado.current && !getUsuario()) {
      setOk(null);
    }

    api
      .me()
      .then((usuario) => {
        if (!ativo) return;
        setSessao(token, usuario);
        jaAutenticado.current = true;
        setOk(true);
      })
      .catch((err) => {
        if (!ativo) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'Sessão expirada') {
          jaAutenticado.current = false;
          setOk(false);
          return;
        }
        if (sessaoLocalOk()) {
          jaAutenticado.current = true;
          setOk(true);
          return;
        }
        jaAutenticado.current = false;
        setOk(false);
      });

    return () => {
      ativo = false;
    };
  }, [location.pathname]);

  if (ok === null) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          bgcolor: colors.canvas,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <PageLoading />
      </Box>
    );
  }

  if (!ok) {
    const loginPath = isMobileDevice() ? '/login/mobile' : '/login';
    return <Navigate to={loginPath} replace state={{ from: normalizeAppRoute(location.pathname) }} />;
  }

  return <>{children}</>;
}
