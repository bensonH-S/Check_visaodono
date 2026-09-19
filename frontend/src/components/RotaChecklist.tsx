import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeUsarChecklist, primeiraRotaMobileApp, usaFluxoChamadosMobile } from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';
import { moduloNoCanal } from '../config/modulosCanal';
import { useAppConfig } from '../hooks/useAppConfig';

type Props = {
  children: ReactNode;
  mobile?: boolean;
};

export default function RotaChecklist({ children, mobile }: Props) {
  const user = getUsuario();
  const { modulos } = useAppConfig();
  const canalOk = moduloNoCanal(modulos, 'checklist', mobile ? 'mobile' : 'portal');
  if (!podeUsarChecklist(user) || !canalOk) {
    const destino = mobile
      ? user
        ? primeiraRotaMobileApp(user)
        : '/login/mobile'
      : usaFluxoChamadosMobile(user)
        ? '/chamados/mobile'
        : primeiraRotaPermitida(user);
    return <Navigate to={destino} replace />;
  }
  return <>{children}</>;
}
