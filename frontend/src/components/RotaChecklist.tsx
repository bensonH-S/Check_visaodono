import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeUsarChecklist, usaFluxoChamadosMobile } from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';

type Props = {
  children: ReactNode;
  mobile?: boolean;
};

export default function RotaChecklist({ children, mobile }: Props) {
  const user = getUsuario();
  if (!podeUsarChecklist(user)) {
    const destino = mobile && usaFluxoChamadosMobile(user) ? '/chamados/mobile' : primeiraRotaPermitida(user);
    return <Navigate to={destino} replace />;
  }
  return <>{children}</>;
}
