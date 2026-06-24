import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getUsuario, temPermissao, podeGerenciarChecklistPerguntas, podeVerAuditoria } from '../lib/auth';
import { primeiraRotaPermitida } from '../config/navPermissions';

type Props = {
  children: ReactNode;
};

export default function RotaConfiguracoes({ children }: Props) {
  const user = getUsuario();
  const permitido =
    temPermissao('configuracoes.ver', user) ||
    podeGerenciarChecklistPerguntas(user) ||
    temPermissao('usuarios.gerenciar', user) ||
    temPermissao('portal.lojas.ver', user) ||
    podeVerAuditoria(user);
  if (!permitido) return <Navigate to={primeiraRotaPermitida(user)} replace />;
  return <>{children}</>;
}
