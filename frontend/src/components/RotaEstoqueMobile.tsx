import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeConferenciaEstoque, primeiraRotaMobileApp } from '../lib/auth';

type Props = {
  children: ReactNode;
};

export default function RotaEstoqueMobile({ children }: Props) {
  const user = getUsuario();
  if (!user || !podeConferenciaEstoque(user)) {
    return <Navigate to={user ? primeiraRotaMobileApp(user) : '/login/mobile'} replace />;
  }
  return <>{children}</>;
}
