import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeVerMapaTecnicosMobile, primeiraRotaMobileApp } from '../lib/auth';

type Props = {
  children: ReactNode;
};

export default function RotaMapaTecnicos({ children }: Props) {
  const user = getUsuario();
  if (!user || !podeVerMapaTecnicosMobile(user)) {
    return <Navigate to={user ? primeiraRotaMobileApp(user) : '/login/mobile'} replace />;
  }
  return <>{children}</>;
}
