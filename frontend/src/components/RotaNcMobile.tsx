import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeVerNcMobile, primeiraRotaMobileApp } from '../lib/auth';

type Props = {
  children: ReactNode;
};

export default function RotaNcMobile({ children }: Props) {
  const user = getUsuario();
  if (!user || !podeVerNcMobile(user)) {
    return <Navigate to={user ? primeiraRotaMobileApp(user) : '/login/mobile'} replace />;
  }
  return <>{children}</>;
}
