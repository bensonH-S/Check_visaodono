import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeBreakEstoque, primeiraRotaMobileApp } from '../lib/auth';

type Props = {
  children: ReactNode;
};

export default function RotaEstoqueBreakMobile({ children }: Props) {
  const user = getUsuario();
  if (!user || !podeBreakEstoque(user)) {
    return <Navigate to={user ? primeiraRotaMobileApp(user) : '/login/mobile'} replace />;
  }
  return <>{children}</>;
}
