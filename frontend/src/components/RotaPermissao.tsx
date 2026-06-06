import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, temPermissao } from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';

type Props = {
  permissoes: string[];
  children: ReactNode;
};

export default function RotaPermissao({ permissoes, children }: Props) {
  const user = getUsuario();
  const permitido = permissoes.some((p) => temPermissao(p, user));
  if (!permitido) return <Navigate to={primeiraRotaPermitida(user)} replace />;
  return <>{children}</>;
}
