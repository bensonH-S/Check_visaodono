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
  gps_captura_habilitada?: boolean;
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
  if (token) {
    void import('../config/paths')
      .then(({ apiBasePath }) =>
        fetch(`${apiBasePath}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: '{}',
        }),
      )
      .catch(() => undefined);
  }
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

/** Iniciais do avatar (ex.: João Carlos → JC). */
export function iniciaisUsuario(usuario?: Pick<UsuarioSessao, 'avatar_inicial' | 'nome'> | null) {
  if (usuario?.avatar_inicial?.trim()) return usuario.avatar_inicial.trim().slice(0, 2).toUpperCase();
  const partes = usuario?.nome?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (partes.length >= 2) {
    return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
  }
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return '?';
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
  if (podeVerNcMobile(usuario)) return '/nc/mobile';
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

/** Região do técnico no mobile; exibe fallback quando não há região cadastrada. */
export function rotuloRegiaoMobile(usuario?: UsuarioSessao | null): string {
  return rotuloRegioesAtuacao(usuario) ?? 'Sem região';
}

/** Nome da loja selecionada no app mobile (gerente/coordenador). */
export function rotuloLojaMobile(usuario?: UsuarioSessao | null, idLoja?: number | null): string {
  const u = usuario ?? getUsuario();
  const lojas = u?.lojas ?? [];
  if (!lojas.length) return '—';
  const loja =
    idLoja != null ? lojas.find((l) => l.id_loja === idLoja) ?? lojas[0] : lojas[0];
  return loja?.nome ?? '—';
}

export function ehGestorLojaMobile(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  if (!u) return false;
  if (ehSupervisorRegiaoMobile(u)) return false;
  const cargosGestor = new Set(['gerente', 'coordenador']);
  const cargo = (u.cargo_aprovacao || '').toLowerCase();
  if (cargo && cargosGestor.has(cargo)) return true;
  return cargosGestor.has(u.perfil);
}

/** Supervisor regional — cabeçalho e lojas por região (como técnico). */
export function ehSupervisorRegiaoMobile(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  if (!u) return false;
  if (temPermissao('frota.regioes', u)) return true;
  const cargo = (u.cargo_aprovacao || u.perfil || '').toLowerCase();
  return cargo === 'supervisor_regional' || cargo === 'regional' || cargo === 'supervisor';
}

/** Técnico ou supervisor de campo — cabeçalho por região (não diretor nem gestor de loja). */
export function ehTecnicoCampoMobile(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  if (!u) return false;
  if (podeReceberPainelDiretorChamados(u) || temPermissao('lojas.todas', u)) return false;
  if (ehGestorLojaMobile(u)) return false;
  if (ehSupervisorRegiaoMobile(u)) return true;
  return temPermissao('chamados.assumir', u);
}

/** Cabeçalho de contexto no app mobile de chamados: região, loja ou oculto. */
export function modoCabecalhoContextoMobile(
  usuario?: UsuarioSessao | null,
): 'regiao' | 'loja' | null {
  const u = usuario ?? getUsuario();
  if (!u) return null;

  if (temPermissao('lojas.todas', u) || podeReceberPainelDiretorChamados(u)) {
    return null;
  }

  if (
    ehGestorLojaMobile(u) &&
    (temPermissao('chamados.ver', u) || temPermissao('chamados.abrir', u))
  ) {
    return 'loja';
  }

  if (ehTecnicoCampoMobile(u)) {
    return 'regiao';
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

/** Deve escolher a loja ao abrir chamado (sem pré-seleção). */
export function deveEscolherLojaNovoChamadoMobile(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  if (!u) return true;
  if (temPermissao('lojas.todas', u) || podeReceberPainelDiretorChamados(u)) return true;
  if (ehGestorLojaMobile(u)) return false;
  return ehTecnicoCampoMobile(u) || ehSupervisorRegiaoMobile(u);
}

/** Técnico/supervisor de campo sem região vinculada — sem escopo de gestão de chamados. */
export function tecnicoCampoSemRegiao(usuario?: UsuarioSessao | null): boolean {
  return (ehTecnicoCampoMobile(usuario) || ehSupervisorRegiaoMobile(usuario)) && !(usuario ?? getUsuario())?.regioes_atuacao?.length;
}

/**
 * Técnico, supervisor regional ou diretor — podem assumir/reassumir chamados no mobile.
 * Gestor de loja (sem perfil supervisor) não assume.
 */
export function perfilPodeAssumirChamadoMobile(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  if (!u || !temPermissao('chamados.assumir', u)) return false;
  if (ehGestorLojaMobile(u) && !ehSupervisorRegiaoMobile(u)) return false;

  if (podeReceberPainelDiretorChamados(u) || temPermissao('lojas.todas', u)) return true;
  if (ehSupervisorRegiaoMobile(u)) return true;
  if (ehTecnicoCampoMobile(u) || u.perfil === 'tecnico') return true;

  return temPermissao('chamados.assumir', u);
}

/** Exibe botão Assumir — inclusive se outro técnico já estiver no ticket (reassumir). */
export function chamadoPodeAssumirMobile(
  chamado: { status: string; id_tecnico?: number | null },
  usuario?: UsuarioSessao | null,
): boolean {
  const u = usuario ?? getUsuario();
  if (!u || !perfilPodeAssumirChamadoMobile(u)) return false;
  if (!['aberto', 'em_atendimento'].includes(chamado.status)) return false;

  const idTec = chamado.id_tecnico != null ? Number(chamado.id_tecnico) : null;
  if (idTec != null && !Number.isNaN(idTec) && idTec === Number(u.id_usuario)) return false;

  return true;
}

/** @deprecated Use perfilPodeAssumirChamadoMobile */
export function podeAssumirTicketListaMobile(usuario?: UsuarioSessao | null): boolean {
  return perfilPodeAssumirChamadoMobile(usuario);
}

/** @deprecated Use chamadoPodeAssumirMobile */
export function chamadoPodeAssumirNaListaMobile(
  chamado: { status: string; id_tecnico?: number | null },
  usuario?: UsuarioSessao | null,
): boolean {
  return chamadoPodeAssumirMobile(chamado, usuario);
}

export function podeUsarFrota(usuario?: UsuarioSessao | null): boolean {
  return (
    temPermissao('frota.usar', usuario) ||
    temPermissao('frota.gerenciar', usuario)
  );
}

/** Termo de ferramentas no app mobile — somente técnico de campo (não diretor nem supervisor). */
export function podeAssinarTermoFerramentasMobile(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  if (!u) return false;
  if (podeReceberPainelDiretorChamados(u) || temPermissao('lojas.todas', u)) return false;
  if (ehSupervisorRegiaoMobile(u)) return false;
  if (ehGestorLojaMobile(u)) return false;
  return temPermissao('chamados.assumir', u);
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

/** Diretor: painel completo de chamados (todas as lojas com lojas.todas). */
export function podeReceberPainelDiretorChamados(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  return u?.cargo_aprovacao === 'diretor' && temPermissao('chamados.aprovar', u);
}

/** Auditoria do sistema — somente permissão marcada em Usuários. */
export function podeVerAuditoria(usuario?: UsuarioSessao | null): boolean {
  return temPermissao('configuracoes.auditoria', usuario);
}

/** Configurações → aba Notificações (templates de alertas). */
export function podeGerirNotificacoes(usuario?: UsuarioSessao | null): boolean {
  return temPermissao('configuracoes.notificacoes', usuario);
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
  const u = usuario ?? getUsuario();
  if (!u || !temPermissao('chamados.assumir', u)) return false;
  if (u.gps_captura_habilitada === false) return false;
  return true;
}

/** Diretor, administrador ou CEO — vê e filtra todas as regiões no mapa mobile. */
export function podeFiltrarRegioesMapaMobile(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  if (!u) return false;
  return (
    temPermissao('lojas.todas', u) ||
    podeReceberPainelDiretorChamados(u) ||
    temPermissao('frota.gerenciar', u)
  );
}

/** Diretor, administrador ou supervisor — filtra trajeto do veículo por data no mapa mobile. */
export function podeFiltrarDataTrajetoMapaMobile(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  if (!u) return false;
  if (podeFiltrarRegioesMapaMobile(u)) return true;
  if (u.perfil === 'administrador') return true;
  return ehSupervisorRegiaoMobile(u);
}

/** Mapa de técnicos em tempo real no app (diretor/CEO = todos; regional = sua região). */
export function podeVerMapaTecnicosMobile(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  if (!u) return false;
  if (temPermissao('lojas.todas', u)) return true;
  if (
    temPermissao('frota.mapa.ver', u) ||
    temPermissao('frota.regioes', u) ||
    temPermissao('frota.gerenciar', u)
  ) {
    return (u.regioes_atuacao?.length ?? 0) > 0;
  }
  return false;
}

export function podeGerenciarEscalaVisitas(usuario?: UsuarioSessao | null): boolean {
  return temPermissao('escalas.visitas.gerenciar', usuario);
}

export function podeVerEscalaVisitas(usuario?: UsuarioSessao | null): boolean {
  return podeGerenciarEscalaVisitas(usuario) || temPermissao('escalas.visitas.ver', usuario);
}

export function podeGerenciarMetas(usuario?: UsuarioSessao | null): boolean {
  return temPermissao('metas.gerenciar', usuario);
}

export function podeVerMetas(usuario?: UsuarioSessao | null): boolean {
  return podeGerenciarMetas(usuario) || temPermissao('metas.ver', usuario);
}

export function podeVerNcMobile(usuario?: UsuarioSessao | null): boolean {
  return (
    temPermissao('ncs.ver', usuario) ||
    temPermissao('ncs.resolver', usuario) ||
    temPermissao('portal.dashboard.ver', usuario)
  );
}

export function podeResolverNc(usuario?: UsuarioSessao | null): boolean {
  return temPermissao('ncs.resolver', usuario) || temPermissao('portal.dashboard.ver', usuario);
}
