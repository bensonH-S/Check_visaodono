export type PerfilUsuario = 'administrador' | 'coordenador' | 'gerente' | 'tecnico';
export type CargoAprovacao = string;

export type LojaResumo = {
  id_loja: number;
  nome: string;
  codigo_bkn?: string | null;
};

export type UsuarioSessao = {
  id_usuario: number;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  cargo?: string;
  cargo_aprovacao?: CargoAprovacao | null;
  cargo_nome?: string | null;
  avatar_inicial?: string;
  lojas: LojaResumo[];
  permissoes: string[];
  acesso_todas_lojas?: boolean;
};

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getUsuario(): UsuarioSessao | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('usuario');
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as UsuarioSessao;
    if (!u.permissoes) u.permissoes = [];
    return u;
  } catch {
    return null;
  }
}

export function setSessao(accessToken: string, usuario: UsuarioSessao) {
  localStorage.setItem('token', accessToken);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

export function logout() {
  const token = getToken();
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  void import('../utils/pushNotifications').then((m) => m.cancelarPushNotificacoes(token));
}

const PERMISSOES_DASHBOARD = new Set([
  'portal.dashboard.ver',
  'portal.ranking.ver',
  'portal.ncs.ver',
]);

export function temPermissao(codigo: string, usuario?: UsuarioSessao | null) {
  const u = usuario ?? getUsuario();
  const perms = u?.permissoes || [];
  if (perms.includes(codigo)) return true;
  if (codigo === 'portal.dashboard.ver' && perms.some((p) => PERMISSOES_DASHBOARD.has(p))) {
    return true;
  }
  return false;
}

export function labelPerfil(perfil: string) {
  const map: Record<string, string> = {
    administrador: 'Administrador',
    coordenador: 'Coordenador',
    gerente: 'Gerente',
    tecnico: 'Técnico',
  };
  return map[perfil] || perfil;
}

/** Nome exibido na sessão: prioriza cargo da tabela Cargos, não o perfil interno legado. */
export function nomeExibicaoUsuario(usuario?: Pick<UsuarioSessao, 'cargo_nome' | 'cargo' | 'perfil'> | null) {
  if (!usuario) return '—';
  if (usuario.cargo_nome) return usuario.cargo_nome;
  if (usuario.cargo) return usuario.cargo;
  if (usuario.perfil) return labelPerfil(usuario.perfil);
  return '—';
}

/** Destino após login em /login/mobile (app PWA). */
export function destinoPosLoginMobile(usuario: UsuarioSessao): string {
  return primeiraRotaMobileApp(usuario);
}

/** Primeira aba do app mobile conforme permissões do usuário. */
export function primeiraRotaMobileApp(usuario: UsuarioSessao): string {
  if (temPermissao('chamados.ver', usuario) || temPermissao('chamados.abrir', usuario)) {
    return '/chamados/mobile';
  }
  if (podeUsarChecklist(usuario)) return '/checklist/mobile';
  if (podeUsarFrota(usuario)) return '/frota/mobile';
  return '/chamados/mobile';
}

const CARGOS_COM_CHECKLIST = new Set([
  'supervisor_regional',
  'coordenador',
  'diretor',
  'administrador',
  'ceo',
]);

/** Cargo vinculado a algum tipo de checklist (tabela cargo_checklist). */
export function cargoComChecklist(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  if (!u) return false;
  const codigo = (u.cargo_aprovacao || u.perfil || '').toLowerCase();
  if (CARGOS_COM_CHECKLIST.has(codigo)) return true;
  const nome = (u.cargo_nome || u.cargo || '').toLowerCase();
  return nome.includes('supervisor') || nome === 'diretor' || nome === 'administrador' || nome === 'ceo';
}

export function podeUsarChecklist(usuario?: UsuarioSessao | null): boolean {
  return (
    temPermissao('checklist.ver', usuario) ||
    temPermissao('checklist.executar', usuario) ||
    cargoComChecklist(usuario)
  );
}

const CARGOS_FROTA = new Set(['supervisor_regional', 'coordenador']);

export function podeUsarFrota(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  if (!u) return false;
  if (temPermissao('frota.usar', u) || temPermissao('frota.gerenciar', u)) return true;
  const codigo = (u.cargo_aprovacao || u.perfil || '').toLowerCase();
  return CARGOS_FROTA.has(codigo);
}

export function podeGerenciarFrota(usuario?: UsuarioSessao | null): boolean {
  return temPermissao('frota.gerenciar', usuario);
}

export function podeGerenciarRegioesFrota(usuario?: UsuarioSessao | null): boolean {
  if (temPermissao('frota.gerenciar', usuario) || temPermissao('frota.regioes', usuario)) return true;
  const codigo = (usuario ?? getUsuario())?.cargo_aprovacao || (usuario ?? getUsuario())?.perfil || '';
  return String(codigo).toLowerCase() === 'supervisor_regional';
}

const CARGOS_AUDITORIA = new Set(['administrador', 'ceo', 'diretor']);

/** Auditoria do sistema: apenas Administrador, CEO ou Diretor. */
export function podeVerAuditoria(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  if (!u) return false;
  const codigo = (u.cargo_aprovacao || u.perfil || '').toLowerCase();
  if (CARGOS_AUDITORIA.has(codigo)) return true;
  const nome = (u.cargo_nome || u.cargo || '').toLowerCase();
  return nome === 'administrador' || nome === 'ceo' || nome === 'diretor';
}

/** Usuário autenticado no app mobile unificado (ChamadosMobileLayout). */
export function usaFluxoChamadosMobile(usuario?: UsuarioSessao | null): boolean {
  return !!(usuario ?? getUsuario());
}

export function usaFluxoMobileApp(usuario?: UsuarioSessao | null): boolean {
  return usaFluxoChamadosMobile(usuario);
}
