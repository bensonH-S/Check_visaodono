import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { getToken, getUsuario } from '../lib/auth';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    setOk(!!getToken() && !!getUsuario());
  }, [location.pathname]);

  if (ok === null) {
    return (
      <Box className="flex items-center justify-center min-h-screen bg-[#f5f5f3]">
        <CircularProgress />
      </Box>
    );
  }

  if (!ok) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
