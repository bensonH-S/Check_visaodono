import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeVerEnergia, primeiraRotaMobileApp } from '../lib/auth';

type Props = {
  children: ReactNode;
};

export default function RotaEnergiaMobile({ children }: Props) {
  const user = getUsuario();
  if (!user || !podeVerEnergia(user)) {
    return <Navigate to={user ? primeiraRotaMobileApp(user) : '/login/mobile'} replace />;
  }
  return <>{children}</>;
}
