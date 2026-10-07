import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeVerFinanceiro } from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';

type Props = {
  children: ReactNode;
};

export default function RotaFinanceiro({ children }: Props) {
  const user = getUsuario();
  if (!user || !podeVerFinanceiro(user)) {
    return <Navigate to={primeiraRotaPermitida(user)} replace />;
  }
  return <>{children}</>;
}
