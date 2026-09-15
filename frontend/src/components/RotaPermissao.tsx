import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeVerEscalaGestores, temPermissao } from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';

type Props = {
  permissoes: string[];
  children: ReactNode;
  extra?: boolean;
};

export default function RotaPermissao({ permissoes, children, extra = false }: Props) {
  const user = getUsuario();
  const isAdmin = user?.perfil === 'administrador' || user?.cargo_aprovacao === 'administrador';
  const extraOk = extra && podeVerEscalaGestores(user);
  const permitido = extraOk || isAdmin || permissoes.some((p) => temPermissao(p, user));
  if (!permitido) return <Navigate to={primeiraRotaPermitida(user)} replace />;
  return <>{children}</>;
}
