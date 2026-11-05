import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, podeConsultarNfe, podeVerFinanceiro, podeVerResumoFinanceiro } from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';

type Props = {
  children: ReactNode;
  /** Agenda banco em modo visualização (financeiro.resumo.ver). */
  permitirResumo?: boolean;
  /** Inbox de notas para o perfil da contabilidade. */
  permitirConsulta?: boolean;
};

export default function RotaFinanceiro({ children, permitirResumo = false, permitirConsulta = false }: Props) {
  const user = getUsuario();
  const ok = permitirConsulta
    ? podeConsultarNfe(user)
    : permitirResumo
      ? podeVerResumoFinanceiro(user)
      : podeVerFinanceiro(user);
  if (!user || !ok) {
    return <Navigate to={primeiraRotaPermitida(user)} replace />;
  }
  return <>{children}</>;
}
