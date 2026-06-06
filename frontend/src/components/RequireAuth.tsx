import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { getToken, setSessao } from '../lib/auth';
import { api } from '../api/client';
import { normalizeAppRoute } from '../config/paths';

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
      .catch(() => {
        if (ativo) setOk(false);
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
    return <Navigate to="/login" replace state={{ from: normalizeAppRoute(location.pathname) }} />;
  }

  return <>{children}</>;
}
