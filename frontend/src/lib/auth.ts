export type PerfilUsuario = 'administrador' | 'coordenador' | 'gerente' | 'tecnico';
export type CargoAprovacao = string;

export type LojaResumo = {
  id_loja: number;
  nome: string;
  codigo_bkn?: string | null;
};

export type TipoChecklistResumo = {
  id_tipo_checklist: number;
  codigo: string;
  nome: string;
};

export type RegiaoAtuacaoResumo = {
  id_regiao: number;
  nome: string;
  nome_regional?: string | null;
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
  tipos_checklist?: TipoChecklistResumo[];
  regioes_atuacao?: RegiaoAtuacaoResumo[];
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
  if (podeUsarChecklist(usuario) && !temPermissao('chamados.ver', usuario) && !temPermissao('chamados.abrir', usuario)) {
    return '/checklist/mobile';
  }
  if (temPermissao('chamados.ver', usuario) || temPermissao('chamados.abrir', usuario)) {
    return '/chamados/mobile';
  }
  if (podeUsarChecklist(usuario)) return '/checklist/mobile';
  if (podeVerVisitasMobile(usuario)) return '/visitas/mobile';
  if (podeUsarFrota(usuario)) return '/frota/mobile';
  return '/chamados/mobile';
}

/** Acesso ao módulo checklist — somente permissões marcadas em Usuários. */
export function podeUsarChecklist(usuario?: UsuarioSessao | null): boolean {
  return (
    temPermissao('checklist.ver', usuario) ||
    temPermissao('checklist.executar', usuario)
  );
}

export function podeVerVisitasMobile(usuario?: UsuarioSessao | null): boolean {
  return temPermissao('portal.visitas.ver', usuario);
}

/** Configurações → aba Perguntas (somente esta permissão habilita a aba). */
export function podeGerenciarChecklistPerguntas(usuario?: UsuarioSessao | null): boolean {
  return (
    temPermissao('configuracoes.perguntas', usuario) ||
    temPermissao('checklist.gerenciar', usuario)
  );
}

export function rotuloRegioesAtuacao(usuario?: UsuarioSessao | null): string | null {
  const regioes = usuario?.regioes_atuacao ?? [];
  if (!regioes.length) return null;
  return regioes.map((r) => r.nome).join(' · ');
}

/** Cabeçalho de contexto no app mobile de chamados: região, loja ou oculto. */
export function modoCabecalhoContextoMobile(
  usuario?: UsuarioSessao | null,
): 'regiao' | 'loja' | null {
  const u = usuario ?? getUsuario();
  if (!u) return null;

  if (temPermissao('chamados.assumir', u) || temPermissao('frota.regioes', u)) {
    return 'regiao';
  }

  if (temPermissao('lojas.todas', u)) {
    return null;
  }

  if (temPermissao('chamados.ver', u) || temPermissao('chamados.abrir', u)) {
    return 'loja';
  }

  return null;
}

export function filtraChamadosPorLojaMobile(usuario?: UsuarioSessao | null): boolean {
  return modoCabecalhoContextoMobile(usuario) === 'loja';
}

export function filtraNotificacoesPorRegiaoMobile(usuario?: UsuarioSessao | null): boolean {
  return modoCabecalhoContextoMobile(usuario) === 'regiao';
}

export function podeUsarFrota(usuario?: UsuarioSessao | null): boolean {
  return (
    temPermissao('frota.usar', usuario) ||
    temPermissao('frota.gerenciar', usuario)
  );
}

export function podeGerenciarFrota(usuario?: UsuarioSessao | null): boolean {
  return temPermissao('frota.gerenciar', usuario);
}

export function podeGerenciarRegioesFrota(usuario?: UsuarioSessao | null): boolean {
  return (
    temPermissao('frota.gerenciar', usuario) ||
    temPermissao('frota.regioes', usuario)
  );
}

/** Auditoria do sistema — somente permissão marcada em Usuários. */
export function podeVerAuditoria(usuario?: UsuarioSessao | null): boolean {
  return temPermissao('configuracoes.auditoria', usuario);
}

/** Usuário autenticado no app mobile unificado (ChamadosMobileLayout). */
export function usaFluxoChamadosMobile(usuario?: UsuarioSessao | null): boolean {
  return !!(usuario ?? getUsuario());
}

export function usaFluxoMobileApp(usuario?: UsuarioSessao | null): boolean {
  return usaFluxoChamadosMobile(usuario);
}

/** Técnicos de campo cujo GPS deve ser rastreado (portal ou app mobile). */
export function deveRastrearGpsTecnico(usuario?: UsuarioSessao | null): boolean {
  return temPermissao('chamados.assumir', usuario);
}
