import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeVerAuditoria } from '../lib/auth';
import { primeiraRotaConfig } from '../pages/configuracoes/configNav';

type Props = {
  children: ReactNode;
};

export default function RotaAuditoria({ children }: Props) {
  const user = getUsuario();
  if (!podeVerAuditoria(user)) {
    return <Navigate to={primeiraRotaConfig(user)} replace />;
  }
  return <>{children}</>;
}
