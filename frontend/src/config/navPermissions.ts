import { temPermissao, type UsuarioSessao } from '../lib/auth';

export type RotaNav = {
  path: string;
  permissoes: string[];
};

/** Ordem de fallback quando o usuário acessa rota sem permissão */
export const ROTAS_NAV: RotaNav[] = [
  { path: '/', permissoes: ['portal.dashboard.ver'] },
  { path: '/checklist', permissoes: ['checklist.ver', 'checklist.executar'] },
  { path: '/chamados', permissoes: ['chamados.ver'] },
  { path: '/chamados/aprovacoes', permissoes: ['chamados.aprovar'] },
  { path: '/visitas', permissoes: ['portal.visitas.ver'] },
  { path: '/ranking', permissoes: ['portal.ranking.ver'] },
  { path: '/lojas', permissoes: ['portal.lojas.ver'] },
  { path: '/nao-conformidades', permissoes: ['portal.ncs.ver'] },
  { path: '/usuarios', permissoes: ['usuarios.gerenciar'] },
  { path: '/configuracoes', permissoes: ['configuracoes.ver'] },
];

export function primeiraRotaPermitida(user: UsuarioSessao | null): string {
  for (const rota of ROTAS_NAV) {
    if (rota.permissoes.some((p) => temPermissao(p, user))) return rota.path;
  }
  return '/login';
}

export function usuarioTemAlgumaPermissaoNav(user: UsuarioSessao | null): boolean {
  return ROTAS_NAV.some((rota) => rota.permissoes.some((p) => temPermissao(p, user)));
}
