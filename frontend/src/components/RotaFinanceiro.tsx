import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeVerFinanceiro, podeVerResumoFinanceiro } from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';

type Props = {
  children: ReactNode;
  /** Agenda banco em modo visualização (financeiro.resumo.ver). */
  permitirResumo?: boolean;
};

export default function RotaFinanceiro({ children, permitirResumo = false }: Props) {
  const user = getUsuario();
  const ok = permitirResumo ? podeVerResumoFinanceiro(user) : podeVerFinanceiro(user);
  if (!user || !ok) {
    return <Navigate to={primeiraRotaPermitida(user)} replace />;
  }
  return <>{children}</>;
}
