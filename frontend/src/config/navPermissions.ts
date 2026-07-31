import { temPermissao, type UsuarioSessao } from '../lib/auth';

export type RotaNav = {
  path: string;
  permissoes: string[];
};

/** Ordem de fallback quando o usuário acessa rota sem permissão */
export const ROTAS_NAV: RotaNav[] = [
  { path: '/dashboard', permissoes: ['portal.dashboard.ver'] },
  {
    path: '/estoque',
    permissoes: ['estoque.produtos', 'estoque.conferencia', 'estoque.operacional', 'estoque.break'],
  },
  { path: '/frota', permissoes: ['frota.gerenciar', 'frota.regioes'] },
  { path: '/chamados', permissoes: ['chamados.ver'] },
  { path: '/chamados/aprovacoes', permissoes: ['chamados.aprovar'] },
  { path: '/visitas', permissoes: ['portal.visitas.ver'] },
  { path: '/checklist', permissoes: ['checklist.ver', 'checklist.executar'] },
  { path: '/configuracoes', permissoes: ['configuracoes.ver'] },
  { path: '/configuracoes/usuarios', permissoes: ['usuarios.gerenciar'] },
  { path: '/configuracoes/lojas', permissoes: ['portal.lojas.ver'] },
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
