import { podeVerEscalaGestores, temPermissao, type UsuarioSessao } from '../lib/auth';
import { codigoModuloPortal, lerModulosCanalCache, moduloNoCanal } from './modulosCanal';

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
  { path: '/energia', permissoes: ['energia.ver', 'energia.abrir'] },
  { path: '/chamados/aprovacoes', permissoes: ['chamados.aprovar'] },
  { path: '/visitas', permissoes: ['portal.visitas.ver'] },
  { path: '/metas', permissoes: ['metas.ver', 'metas.gerenciar'] },
  { path: '/nao-conformidades', permissoes: ['portal.dashboard.ver'] },
  { path: '/ranking', permissoes: ['portal.dashboard.ver'] },
  { path: '/checklist', permissoes: ['checklist.ver', 'checklist.executar'] },
  { path: '/configuracoes', permissoes: ['configuracoes.ver'] },
  { path: '/configuracoes/contagem', permissoes: ['estoque.produtos'] },
  { path: '/configuracoes/usuarios', permissoes: ['usuarios.gerenciar'] },
  { path: '/configuracoes/lojas', permissoes: ['portal.lojas.ver'] },
  { path: '/configuracoes/cargos', permissoes: ['usuarios.gerenciar', 'configuracoes.ver'] },
];

export function primeiraRotaPermitida(user: UsuarioSessao | null): string {
  const modulos = lerModulosCanalCache();
  for (const rota of ROTAS_NAV) {
    const codigo = codigoModuloPortal(rota.path);
    if (codigo && !moduloNoCanal(modulos, codigo, 'portal')) continue;
    if (rota.permissoes.some((p) => temPermissao(p, user))) return rota.path;
  }
  if (podeVerEscalaGestores(user) && moduloNoCanal(modulos, 'escala', 'portal')) {
    return '/escalas/visitas';
  }
  return '/login';
}

export function usuarioTemAlgumaPermissaoNav(user: UsuarioSessao | null): boolean {
  return ROTAS_NAV.some((rota) => rota.permissoes.some((p) => temPermissao(p, user)));
}
