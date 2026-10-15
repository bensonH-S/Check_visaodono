import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeGerenciarTicketsTi } from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';

type Props = { children: ReactNode };

export default function RotaTicketsTi({ children }: Props) {
  const user = getUsuario();
  if (!podeGerenciarTicketsTi(user)) {
    return <Navigate to={primeiraRotaPermitida(user)} replace />;
  }
  return <>{children}</>;
}
