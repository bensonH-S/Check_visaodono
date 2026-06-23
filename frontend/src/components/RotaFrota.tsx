import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeUsarFrota, usaFluxoChamadosMobile } from '../lib/auth';

type Props = {
  children: ReactNode;
};

export default function RotaFrota({ children }: Props) {
  const user = getUsuario();
  if (!podeUsarFrota(user)) {
    const destino = usaFluxoChamadosMobile(user) ? '/chamados/mobile' : '/dashboard';
    return <Navigate to={destino} replace />;
  }
  return <>{children}</>;
}
