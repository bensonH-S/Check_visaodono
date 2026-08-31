import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeVerEnergia } from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';

type Props = {
  children: ReactNode;
};

export default function RotaEnergia({ children }: Props) {
  const user = getUsuario();
  if (!user || !podeVerEnergia(user)) {
    return <Navigate to={primeiraRotaPermitida(user)} replace />;
  }
  return <>{children}</>;
}
