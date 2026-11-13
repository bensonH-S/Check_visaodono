import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  getUsuario,
  podeConsultarNfe,
  podeVerConciliacao,
  podeVerContasPagar,
  podeVerCustos,
  podeVerFinanceiro,
  podeVerResumoFinanceiro,
} from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';

type Props = {
  children: ReactNode;
  /** Agenda banco em modo visualização (financeiro.resumo.ver). */
  permitirResumo?: boolean;
  /** Agenda banco (contas a pagar). A contabilidade entra só para consultar. */
  permitirContas?: boolean;
  /** Inbox de notas para o perfil da contabilidade. */
  permitirConsulta?: boolean;
  /** Custos (C_O_) sem o módulo financeiro completo. */
  permitirCustos?: boolean;
  /** Conciliação bancária sem o módulo financeiro completo. */
  permitirConciliacao?: boolean;
};

export default function RotaFinanceiro({
  children,
  permitirResumo = false,
  permitirContas = false,
  permitirConsulta = false,
  permitirCustos = false,
  permitirConciliacao = false,
}: Props) {
  const user = getUsuario();
  const ok = permitirCustos
    ? podeVerCustos(user)
    : permitirConciliacao
      ? podeVerConciliacao(user)
      : permitirConsulta
        ? podeConsultarNfe(user)
        : permitirContas
          ? podeVerContasPagar(user)
          : permitirResumo
            ? podeVerResumoFinanceiro(user)
            : podeVerFinanceiro(user);
  if (!user || !ok) {
    return <Navigate to={primeiraRotaPermitida(user)} replace />;
  }
  return <>{children}</>;
}
