import { apiBasePath, appBasePath } from '../config/paths';
import { getToken } from '../lib/auth';
import type { UsuarioSessao, TipoChecklistResumo } from '../lib/auth';
import { formatDataCampoData } from '../utils/dateBr';

const BASE = apiBasePath;

export type AppPublicConfig = {
  version: string;
  buildId?: string;
  environment: string;
  support: {
    name: string;
    phone: string;
    email: string;
  };
  pushEnabled?: boolean;
  gpsTecnicosEnabled?: boolean;
  gpsTecnicosIntervalMs?: number;
  hasIntegrations?: boolean;
  integrations?: Array<{ id: string; name: string }>;
};

export type IntegrationStatusItem = {
  id: string;
  name: string;
  online: boolean;
  detail: string;
  /** false = não configurada no .env (mostra N/A) */
  configured?: boolean;
};

export type IntegrationStatusGroup = {
  id: string;
  name: string;
  apis: IntegrationStatusItem[];
};

function authHeaders(extra?: HeadersInit, omitAuth = false): HeadersInit {
  const token = omitAuth ? null : getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request<T>(
  path: string,
  options?: RequestInit & { skipSessionRedirect?: boolean; omitAuth?: boolean },
  tentativa = 0,
): Promise<T> {
  const { skipSessionRedirect, omitAuth, ...fetchOptions } = options ?? {};
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...fetchOptions,
      headers: authHeaders(fetchOptions.headers, omitAuth),
    });
    if (res.status === 204) {
      return undefined as T;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const msg = err.error || 'Erro na requisição';
      const isLogin = path === '/auth/login';
      const isPublic = path.startsWith('/public/');
      if (
        res.status === 401 &&
        typeof window !== 'undefined' &&
        !skipSessionRedirect &&
        !isLogin &&
        !isPublic
      ) {
        const { logout } = await import('../lib/auth');
        logout();
        const base = appBasePath.endsWith('/') ? appBasePath : `${appBasePath}/`;
        window.location.href = `${base}login`;
        throw new Error('Sessão expirada');
      }
      if (res.status >= 500 && tentativa < 2) {
        await new Promise((r) => setTimeout(r, 600));
        return request<T>(path, options, tentativa + 1);
      }
      throw new Error(msg);
    }
    return res.json();
  } catch (e) {
    if (tentativa < 2 && e instanceof TypeError) {
      await new Promise((r) => setTimeout(r, 600));
      return request<T>(path, options, tentativa + 1);
    }
    throw e instanceof Error
      ? e
      : new Error('Servidor indisponível. Aguarde a API reiniciar e tente de novo.');
  }
}

export const api = {
  publicConfig: () => request<AppPublicConfig>('/public/config'),
  integrationsStatus: (params?: { contexto?: string }) => {
    const q = new URLSearchParams();
    if (params?.contexto) q.set('contexto', params.contexto);
    const suffix = q.toString() ? `?${q}` : '';
    return request<{
      success?: boolean;
      checked_at?: string;
      items: IntegrationStatusItem[];
      groups: IntegrationStatusGroup[];
      hasIntegrations: boolean;
      contexto: string | null;
    }>(`/integrations/status${suffix}`);
  },
  login: (email: string, senha: string) =>
    request<{ accessToken: string; usuario: UsuarioSessao }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
      skipSessionRedirect: true,
      omitAuth: true,
    }),
  me: (opts?: { skipSessionRedirect?: boolean }) =>
    request<UsuarioSessao>('/auth/me', opts),

  dashboard: () => request<DashboardData>('/dashboard'),
  ranking: () => request<RankingLoja[]>('/dashboard/ranking'),
  dashboardSaudeLojas: () => request<DashboardSaudeLojasData>('/dashboard/saude-lojas'),
  lojas: (params?: { ativas?: boolean; operacionais?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.ativas) q.set('ativas', '1');
    if (params?.operacionais) q.set('operacionais', '1');
    const s = q.toString();
    return request<Loja[]>(`/lojas${s ? `?${s}` : ''}`);
  },
  lojaAtualizar: (id: number, body: LojaAtualizarInput) =>
    request<Loja>(`/lojas/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  usuarios: () => request<Usuario[]>('/usuarios'),
  auditoresChecklist: () => request<Usuario[]>('/usuarios/auditores-checklist'),
  permissoesCatalogo: () =>
    request<PermissaoCatalogo[]>('/usuarios/permissoes/catalogo', { cache: 'no-store' }),
  usuariosGestao: () => request<UsuarioGestao[]>('/usuarios/gestao'),
  usuarioGestaoCriar: (body: UsuarioGestaoInput) =>
    request<UsuarioGestao>('/usuarios/gestao', { method: 'POST', body: JSON.stringify(body) }),
  usuarioGestaoAtualizar: (id: number, body: Partial<UsuarioGestaoInput>) =>
    request<UsuarioGestao>(`/usuarios/gestao/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  usuarioGestaoExcluir: (id: number) =>
    request<void>(`/usuarios/gestao/${id}`, { method: 'DELETE' }),

  wppStatus: () => request<WppStatus>('/wpp/status'),
  wppQrcode: () => request<WppQrResponse>('/wpp/qrcode'),
  wppConectar: (reiniciar = false) =>
    request<WppConectarResponse>('/wpp/conectar', {
      method: 'POST',
      body: JSON.stringify({ reiniciar }),
    }),
  wppTeste: (body: { telefone: string; mensagem?: string }) =>
    request<{ ok: boolean; telefone: string }>('/wpp/teste', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  auditoriaEventos: (params?: {
    limite?: number;
    offset?: number;
    modulo?: string;
    id_usuario?: number;
    q?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.limite != null) q.set('limite', String(params.limite));
    if (params?.offset != null) q.set('offset', String(params.offset));
    if (params?.modulo) q.set('modulo', params.modulo);
    if (params?.id_usuario != null) q.set('id_usuario', String(params.id_usuario));
    if (params?.q?.trim()) q.set('q', params.q.trim());
    const s = q.toString();
    return request<AuditoriaEvento[]>(`/auditoria/eventos${s ? `?${s}` : ''}`);
  },
  auditoriaUsuariosFiltro: () =>
    request<AuditoriaUsuarioFiltro[]>('/auditoria/usuarios-filtro'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST', body: '{}' }),

  cargos: (params?: { aprovador?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.aprovador) q.set('aprovador', '1');
    const s = q.toString();
    return request<Cargo[]>(`/cargos${s ? `?${s}` : ''}`);
  },
  cargosGestao: () => request<Cargo[]>('/cargos/gestao'),
  cargoGestaoCriar: (body: CargoInput) =>
    request<Cargo>('/cargos/gestao', { method: 'POST', body: JSON.stringify(body) }),
  cargoGestaoAtualizar: (id: number, body: Partial<CargoInput>) =>
    request<Cargo>(`/cargos/gestao/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  cargoGestaoExcluir: (id: number) =>
    request<void>(`/cargos/gestao/${id}`, { method: 'DELETE' }),
  checklistTipos: () => request<TipoChecklist[]>('/checklist/tipos'),
  checklistTiposCatalogo: () => request<TipoChecklist[]>('/checklist/tipos/catalogo'),
  checklist: (tipo?: string) => {
    const q = tipo ? `?tipo=${encodeURIComponent(tipo)}` : '';
    return request<CategoriaChecklist[]>(`/checklist${q}`);
  },
  checklistGestao: (tipo?: string) => {
    const q = tipo ? `?tipo=${encodeURIComponent(tipo)}` : '';
    return request<CategoriaChecklist[]>(`/checklist/gestao${q}`);
  },
  checklistCategoriaCriar: (body: {
    nome: string;
    icone?: string;
    ordem?: number;
    codigo_tipo_checklist?: string;
    id_tipo_checklist?: number;
  }) =>
    request<CategoriaChecklistResumo>('/checklist/categorias', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  checklistCategoriaAtualizar: (
    id: number,
    body: Partial<{ nome: string; icone: string; ordem: number }>,
  ) =>
    request<CategoriaChecklistResumo>(`/checklist/categorias/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  checklistPerguntaCriar: (body: PerguntaInput) =>
    request<Pergunta>('/checklist/perguntas', { method: 'POST', body: JSON.stringify(body) }),
  checklistPerguntaAtualizar: (id: number, body: Partial<PerguntaInput>) =>
    request<Pergunta>(`/checklist/perguntas/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  checklistPerguntaExcluir: (id: number) =>
    request<void>(`/checklist/perguntas/${id}`, { method: 'DELETE' }),
  visitas: (params?: {
    loja?: number;
    status?: string;
    usuario?: number;
    tipo?: string;
    order?: 'data_desc' | 'nota_desc';
  }) => {
    const q = new URLSearchParams();
    if (params?.loja) q.set('loja', String(params.loja));
    if (params?.status) q.set('status', params.status);
    if (params?.usuario) q.set('usuario', String(params.usuario));
    if (params?.tipo) q.set('tipo', params.tipo);
    if (params?.order && params.order !== 'data_desc') q.set('order', params.order);
    const s = q.toString();
    return request<VisitaResumo[]>(`/visitas${s ? `?${s}` : ''}`);
  },
  visita: (id: number) => request<VisitaDetalhe>(`/visitas/${id}`),
  apagarVisita: (id: number) =>
    request<{ ok: boolean; id_visita: number }>(`/visitas/${id}`, { method: 'DELETE' }),
  criarVisita: (body: {
    id_loja: number;
    id_usuario: number;
    data_visita?: string;
    hora_inicio?: string;
    codigo_tipo_checklist?: string;
    id_tipo_checklist?: number;
    meta_visita?: MetaVisitaTimeCampo;
  }) =>
    request<VisitaResumo>('/visitas', { method: 'POST', body: JSON.stringify(body) }),
  salvarRespostas: (id: number, respostas: RespostaInput[]) =>
    request<VisitaResumo>(`/visitas/${id}/respostas`, {
      method: 'POST',
      body: JSON.stringify({ respostas }),
    }),
  finalizarVisita: (id: number, body?: Record<string, unknown>) =>
    request<VisitaResumo>(`/visitas/${id}/finalizar`, {
      method: 'PATCH',
      body: JSON.stringify(body || {}),
    }),
  reabrirVisita: (id: number) =>
    request<VisitaResumo>(`/visitas/${id}/reabrir`, { method: 'PATCH' }),
  enviarRelatorioVisitaEmail: (id: number) =>
    request<{
      ok: boolean;
      subject?: string;
      destinatarios?: unknown;
      cc?: unknown;
      error?: string;
    }>(`/visitas/${id}/enviar-relatorio-email`, { method: 'POST' }),
  naoConformidades: (params?: { status?: string; loja?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.loja != null) q.set('loja', String(params.loja));
    const suffix = q.toString() ? `?${q}` : '';
    return request<NcResponse>(`/nao-conformidades${suffix}`);
  },
  freelancersAprovacao: (params?: {
    date_from?: string;
    date_to?: string;
    status?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.date_from) q.set('date_from', params.date_from);
    if (params?.date_to) q.set('date_to', params.date_to);
    if (params?.status) q.set('status', params.status);
    const suffix = q.toString() ? `?${q}` : '';
    return request<FreelancersAprovacaoResponse>(`/freelancers-aprovacao${suffix}`);
  },
  freelancersAprovar: (checkinId: number, body?: { note?: string }) =>
    request<{ success?: boolean; item?: FreelancerTurnoAprovacao }>(
      `/freelancers-aprovacao/${checkinId}/approve`,
      { method: 'POST', body: JSON.stringify(body || {}) },
    ),
  freelancersRecusar: (checkinId: number, body?: { note?: string }) =>
    request<{ success?: boolean; item?: FreelancerTurnoAprovacao }>(
      `/freelancers-aprovacao/${checkinId}/reject`,
      { method: 'POST', body: JSON.stringify(body || {}) },
    ),
  freelancersLancarSaida: (checkinId: number, body: { checkout_time: string; note?: string }) =>
    request<{ success?: boolean; message?: string; item?: FreelancerTurnoAprovacao }>(
      `/freelancers-aprovacao/${checkinId}/checkout`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  freelancersAjustarHorario: (
    checkinId: number,
    body: { checkin_time?: string; checkout_time?: string },
  ) =>
    request<{ success?: boolean; message?: string; item?: FreelancerTurnoAprovacao }>(
      `/freelancers-aprovacao/${checkinId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  freelancersListarColaboradores: (params?: { q?: string }) => {
    const q = new URLSearchParams();
    if (params?.q) q.set('q', params.q);
    const suffix = q.toString() ? `?${q}` : '';
    return request<FreelancersColaboradoresResponse>(`/freelancers-aprovacao/employees${suffix}`);
  },
  freelancersRegistrarTurno: (body: {
    employee_id: number;
    bk_number: string;
    checkin_time: string;
    checkout_time?: string;
    note?: string;
  }) =>
    request<{ success?: boolean; message?: string; item?: FreelancerTurnoAprovacao }>(
      '/freelancers-aprovacao',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  freelancersExcluir: (checkinId: number) =>
    request<{ success?: boolean; message?: string }>(`/freelancers-aprovacao/${checkinId}`, {
      method: 'DELETE',
      body: JSON.stringify({}),
    }),
  ncDetalhe: (id: number) => request<NcDetalhe>(`/nao-conformidades/${id}`),
  ncResolver: async (id: number, form: FormData) => {
    const token = getToken();
    const res = await fetch(`${BASE}/nao-conformidades/${id}/resolver`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erro ao resolver NC');
    }
    return res.json() as Promise<NcDetalhe>;
  },

  manutCategorias: () => request<ManutCategoria[]>('/manutencao/categorias'),
  manutCategoriaCriar: (body: ManutCategoriaInput) =>
    request<ManutCategoria>('/manutencao/categorias', { method: 'POST', body: JSON.stringify(body) }),
  manutCategoriaAtualizar: (id: number, body: Partial<ManutCategoriaInput>) =>
    request<ManutCategoria>(`/manutencao/categorias/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  manutCategoriaExcluir: (id: number) =>
    request<{ inativada?: boolean } | void>(`/manutencao/categorias/${id}`, { method: 'DELETE' }),
  manutSlas: () => request<ManutSla[]>('/manutencao/sla'),
  manutSlaCriar: (body: ManutSlaInput) =>
    request<ManutSla>('/manutencao/sla', { method: 'POST', body: JSON.stringify(body) }),
  manutSlaAtualizar: (id: number, body: Partial<ManutSlaInput>) =>
    request<ManutSla>(`/manutencao/sla/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  manutSlaExcluir: (id: number) =>
    request<void>(`/manutencao/sla/${id}`, { method: 'DELETE' }),
  manutNotificacaoEventos: () =>
    request<ManutNotificacaoEventosResponse>('/manutencao/notificacao-eventos'),
  manutNotificacaoEventoCriar: (body: ManutNotificacaoEventoInput) =>
    request<ManutNotificacaoEvento>('/manutencao/notificacao-eventos', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  manutNotificacaoEventoAtualizar: (codigo: string, body: Partial<ManutNotificacaoEventoInput>) =>
    request<ManutNotificacaoEvento>(`/manutencao/notificacao-eventos/${encodeURIComponent(codigo)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  manutNotificacaoEventoExcluir: (codigo: string) =>
    request<void>(`/manutencao/notificacao-eventos/${encodeURIComponent(codigo)}`, { method: 'DELETE' }),
  manutNotificacaoEventoPreview: (body: ManutNotificacaoPreviewInput) =>
    request<{ preview: string }>('/manutencao/notificacao-eventos/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  manutFormulario: () => request<ManutFormulario>('/manutencao/formulario'),
  manutChamados: (opts?: { mobile?: boolean }) => {
    const qs = opts?.mobile ? '?mobile=1' : '';
    return request<ManutChamado[]>(`/manutencao/chamados${qs}`);
  },
  manutChamadosAprovacoes: () =>
    request<{ pendentes: ManutChamado[]; aprovados: ManutChamado[] }>('/manutencao/chamados/aprovacoes'),
  manutChamadoDetalhe: (idChamado: number) =>
    request<ManutChamadoDetalhe>(`/manutencao/chamados/${idChamado}`),
  manutAdicionarAtualizacao: (idChamado: number, texto: string) =>
    request<ManutAtualizacao>(`/manutencao/chamados/${idChamado}/atualizacoes`, {
      method: 'POST',
      body: JSON.stringify({ texto }),
    }),
  manutCriarChamado: (body: ManutCriarBody) =>
    request<{ id_chamado: number; numero: number }>('/manutencao/chamados', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  manutAssumirChamado: (idChamado: number) =>
    request<{ id_chamado: number; status: string }>(`/manutencao/chamados/${idChamado}/assumir`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    }),
  manutFinalizarChamado: (
    idChamado: number,
    status: 'concluido' | 'cancelado',
    observacao?: string,
  ) =>
    request<{ id_chamado: number; status: string; fechado_em: string }>(
      `/manutencao/chamados/${idChamado}/finalizar`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, observacao: observacao?.trim() || undefined }),
      },
    ),
  manutReabrirChamado: (idChamado: number, observacao?: string) =>
    request<{ id_chamado: number; status: string; fechado_em: string | null }>(
      `/manutencao/chamados/${idChamado}/reabrir`,
      {
        method: 'PATCH',
        body: JSON.stringify({ observacao: observacao?.trim() || undefined }),
      },
    ),
  manutEnviarAprovacao: (
    idChamado: number,
    observacao?: string,
    destino?: string,
  ) =>
    request<{ id_chamado: number; status: string; aprovacao_destino?: string; aviso?: string | null }>(
      `/manutencao/chamados/${idChamado}/enviar-aprovacao`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          observacao: observacao?.trim() || undefined,
          destino,
        }),
      },
    ),
  manutAprovarChamado: (
    idChamado: number,
    observacao?: string,
    modo: 'definitivo' | 'devolver_financeiro' = 'definitivo',
  ) =>
    request<{ id_chamado: number; status: string; aprovacao_destino?: string; aprovacao_diretor_ok?: boolean }>(
      `/manutencao/chamados/${idChamado}/aprovar`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          observacao: observacao?.trim() || undefined,
          modo,
        }),
      },
    ),
  manutEncaminharDiretor: (idChamado: number, observacao?: string) =>
    request<{ id_chamado: number; status: string; aprovacao_destino?: string }>(
      `/manutencao/chamados/${idChamado}/encaminhar-diretor`,
      {
        method: 'PATCH',
        body: JSON.stringify({ observacao: observacao?.trim() || undefined }),
      },
    ),
  manutRecusarOrcamento: (idChamado: number, observacao?: string) =>
    request<{ id_chamado: number; status: string }>(
      `/manutencao/chamados/${idChamado}/recusar-orcamento`,
      {
        method: 'PATCH',
        body: JSON.stringify({ observacao: observacao?.trim() || undefined }),
      },
    ),
  manutNotificacoes: (contexto?: ContextoNotificacoesManut) => {
    const qs = contexto ? `?contexto=${contexto}` : '';
    return request<ManutNotificacao[]>(`/manutencao/notificacoes${qs}`);
  },
  manutNotificacoesNaoLidas: (opts?: { idLoja?: number | null; contexto?: ContextoNotificacoesManut }) => {
    const params = new URLSearchParams();
    if (opts?.idLoja != null) params.set('id_loja', String(opts.idLoja));
    if (opts?.contexto) params.set('contexto', opts.contexto);
    const qs = params.toString() ? `?${params}` : '';
    return request<{ total: number }>(`/manutencao/notificacoes/nao-lidas${qs}`);
  },
  manutNotificacaoMarcarLida: (id: number) =>
    request<{ ok: boolean }>(`/manutencao/notificacoes/${id}/lida`, { method: 'PATCH' }),
  manutNotificacoesMarcarTodasLidas: (opts?: { idLoja?: number | null; contexto?: ContextoNotificacoesManut }) => {
    const params = new URLSearchParams();
    if (opts?.idLoja != null) params.set('id_loja', String(opts.idLoja));
    if (opts?.contexto) params.set('contexto', opts.contexto);
    const qs = params.toString() ? `?${params}` : '';
    return request<{ ok: boolean }>(`/manutencao/notificacoes/lidas${qs}`, { method: 'PATCH' });
  },
  manutNotificacoesMarcarChamadoLidas: (idChamado: number) =>
    request<{ ok: boolean }>(`/manutencao/notificacoes/chamado/${idChamado}/lidas`, {
      method: 'PATCH',
    }),
  pushSubscribe: (subscription: PushSubscriptionJSON) =>
    request<{ ok: boolean }>('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    }),
  pushStatus: () =>
    request<{ registered: boolean; subscriptionCount: number; pushEnabled: boolean }>('/push/status'),
  pushReset: () =>
    request<{ ok: boolean; removidas: number }>('/push/reset', { method: 'POST' }),
  pushDiagnostico: (mensagem: string, meta?: Record<string, unknown>) =>
    request<{ ok: boolean }>('/push/diagnostico', {
      method: 'POST',
      body: JSON.stringify({ mensagem, meta }),
    }),
  pushUnsubscribe: (endpoint: string) =>
    request<{ ok: boolean }>('/push/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    }),
  manutEnviarFotos: async (idChamado: number, formData: FormData, opts?: { notificar?: boolean }) => {
    const token = getToken();
    const notificar = opts?.notificar !== false;
    const qs = notificar ? '' : '?notificar=0';
    const res = await fetch(`${BASE}/manutencao/chamados/${idChamado}/fotos${qs}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erro ao enviar fotos');
    }
    return res.json();
  },
  frotaResumo: () => request<FrotaResumoMobile>('/frota/mobile/resumo'),
  frotaAbastecimentosMobile: () =>
    request<FrotaAbastecimentoMobile[]>('/frota/mobile/abastecimentos'),
  frotaManutencoesMobile: () =>
    request<FrotaManutencaoMobile[]>('/frota/mobile/manutencoes'),
  frotaVeiculos: () => request<FrotaVeiculo[]>('/frota/veiculos'),
  frotaAssuncoes: (idVeiculo?: number) => {
    const q = idVeiculo != null ? `?id_veiculo=${idVeiculo}` : '';
    return request<FrotaAssuncao[]>(`/frota/assuncoes${q}`);
  },
  frotaAbastecimentosPortal: () => request<FrotaAbastecimentoPortal[]>('/frota/abastecimentos'),
  frotaManutencoesPortal: () => request<FrotaManutencaoPortal[]>('/frota/manutencoes'),
  frotaMultasPortal: () => request<FrotaMultaPortal[]>('/frota/multas'),
  frotaMultasDetran: (idVeiculo?: number) => {
    const q = idVeiculo != null ? `?id_veiculo=${idVeiculo}` : '';
    return request<FrotaMultasDetranResposta>(`/frota/multas/detran${q}`);
  },
  frotaAtualizarStatusMultaDetran: (idMulta: number, status: 'Em Aberto' | 'Paga' | 'Vencida') => {
    return request<{ ok: boolean }>(`/frota/multas/detran/${idMulta}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  },
  frotaAtualizarStatusDebitoDetran: (idDebito: number, status: 'Em Aberto' | 'Paga' | 'Vencida') => {
    return request<{ ok: boolean }>(`/frota/debitos/detran/${idDebito}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  },
  frotaRemoverDebitoDetran: (idDebito: number) => {
    return request<{ ok: boolean }>(`/frota/debitos/detran/${idDebito}`, {
      method: 'DELETE',
    });
  },
  frotaDebitoBoletoUrl: (idDebito: number) => `${BASE}/frota/debitos/detran/${idDebito}/boleto`,
  frotaMultasDetranSync: (forcar?: boolean, veiculoIds?: number[] | null) => {
    return request<{
      ok?: boolean;
      status?: string;
      motivo?: string;
      error?: string;
      total?: number;
      qtd_multas?: number;
      qtd_debitos?: number;
      qtd_veiculos?: number;
      avisos?: string[];
      erros?: string[];
      fonte?: string;
      id_sync?: number | null;
      cache: FrotaMultasDetranResposta;
      debitos?: FrotaDebitosDetranResposta;
    }>('/frota/multas/detran/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forcar, veiculoIds }),
    });
  },
  frotaDebitosDetranSync: (
    forcar?: boolean,
    veiculoIds?: number[] | null,
    tipos?: Array<'IPVA' | 'Licenciamento'>,
    anosIpva?: number[],
  ) => {
    return request<{
      ok?: boolean;
      status?: string;
      motivo?: string;
      error?: string;
      qtd_debitos?: number;
      qtd_ipva?: number;
      qtd_licenciamento?: number;
      qtd_veiculos?: number;
      avisos?: string[];
      erros?: string[];
      fonte?: string;
      debitos: FrotaDebitosDetranResposta;
    }>('/frota/debitos/detran/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forcar, veiculoIds, tipos, anosIpva }),
    });
  },
  frotaDebitosDetran: (idVeiculo?: number) => {
    const q = idVeiculo != null ? `?id_veiculo=${idVeiculo}` : '';
    return request<FrotaDebitosDetranResposta>(`/frota/debitos/detran${q}`);
  },
  frotaTermosPortal: () => request<FrotaTermoPortalResumo[]>('/frota/termos'),
  frotaTermoPortal: (idTermo: number) => request<FrotaTermoPortalDetalhe>(`/frota/termos/${idTermo}`),
  frotaRegioes: () => request<FrotaRegiaoResumo[]>('/frota/regioes'),
  frotaRegiaoCatalogo: () => request<FrotaRegiaoCatalogo>('/frota/regioes/catalogo'),
  frotaRegiao: (idRegiao: number) => request<FrotaRegiaoDetalhe>(`/frota/regioes/${idRegiao}`),
  frotaRegiaoPosicoes: (idRegiao: number) =>
    request<FrotaRegiaoPosicoesMapa>(`/frota/regioes/${idRegiao}/posicoes`),
  frotaMapaPosicoes: () => request<FrotaMapaPosicoes>('/frota/mapa/posicoes'),
  frotaVeiculoHistoricoRastreamento: (idVeiculo: number, opts?: { inicio?: number; fim?: number }) => {
    const qs = new URLSearchParams();
    if (opts?.inicio != null) qs.set('inicio', String(opts.inicio));
    if (opts?.fim != null) qs.set('fim', String(opts.fim));
    const query = qs.toString();
    return request<FrotaVeiculoHistoricoRastreamento>(
      `/frota/rastreamento/veiculos/${idVeiculo}/historico${query ? `?${query}` : ''}`,
    );
  },
  frotaRastreamentoTelemetria: () =>
    request<FrotaRastreamentoTelemetria>('/frota/rastreamento/telemetria'),
  frotaVeiculoRotaDia: (idVeiculo: number, dataInicio: string, dataFim?: string) => {
    const qs = new URLSearchParams({
      data_inicio: dataInicio,
      data_fim: dataFim || dataInicio,
    });
    return request<FrotaVeiculoRotaDiaRelatorio>(
      `/frota/rastreamento/veiculos/${idVeiculo}/rota-dia?${qs.toString()}`,
      { cache: 'no-store' },
    );
  },
  frotaVeiculoVelocidade: (idVeiculo: number, dataInicio: string, dataFim: string) => {
    const qs = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim });
    return request<FrotaVeiculoVelocidadeRelatorio>(
      `/frota/rastreamento/veiculos/${idVeiculo}/velocidade?${qs.toString()}`,
      { cache: 'no-store' },
    );
  },
  frotaAjustarRotaMapa: (coords: [number, number][]) =>
    request<{ coords: [number, number][] }>('/frota/rastreamento/ajustar-rota', {
      method: 'POST',
      body: JSON.stringify({ coords }),
    }),
  frotaKmConfronto: (dataInicio: string, dataFim: string) => {
    const qs = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim });
    return request<FrotaKmConfrontoRelatorio>(`/frota/rastreamento/relatorio-km-confronto?${qs.toString()}`);
  },
  frotaCriarRegiao: (body: Pick<FrotaRegiaoBody, 'nome' | 'descricao'>) =>
    request<FrotaRegiaoCriada>('/frota/regioes', { method: 'POST', body: JSON.stringify(body) }),
  frotaAtualizarRegiao: (idRegiao: number, body: Partial<FrotaRegiaoBody>) =>
    request<FrotaRegiaoResumo>(`/frota/regioes/${idRegiao}`, { method: 'PATCH', body: JSON.stringify(body) }),
  frotaVeiculo: (idVeiculo: number) => request<FrotaVeiculo>(`/frota/veiculos/${idVeiculo}`),
  frotaCriarVeiculo: (body: FrotaVeiculoBody) =>
    request<FrotaVeiculo>('/frota/veiculos', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  frotaAtualizarVeiculo: (idVeiculo: number, body: Partial<FrotaVeiculoBody>) =>
    request<FrotaVeiculo>(`/frota/veiculos/${idVeiculo}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  frotaExcluirVeiculo: (idVeiculo: number) =>
    request<{ ok: boolean }>(`/frota/veiculos/${idVeiculo}`, { method: 'DELETE' }),
  frotaAtribuirVeiculo: (idVeiculo: number, body: { id_usuario: number; km_atual?: number }) =>
    request<FrotaVeiculo>(`/frota/veiculos/${idVeiculo}/atribuir`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  frotaAtualizarKmAtribuicao: (
    idVeiculo: number,
    body: { km_atribuicao: number; km_atual?: number },
  ) =>
    request<FrotaVeiculo>(`/frota/veiculos/${idVeiculo}/km-atribuicao`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  frotaAtualizarProximaManutencao: (idVeiculo: number, body: { proxima_manutencao_km: number }) =>
    request<FrotaVeiculo>(`/frota/veiculos/${idVeiculo}/proxima-manutencao`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  frotaDevolverVeiculoPortal: (idVeiculo: number, body?: { km_atual?: number }) =>
    request<FrotaVeiculo>(`/frota/veiculos/${idVeiculo}/devolver`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  frotaAssumirVeiculo: async (formData: FormData) => {
    const token = getToken();
    const res = await fetch(`${BASE}/frota/me/assumir`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erro ao assumir veículo');
    }
    return res.json() as Promise<{ ok: boolean; veiculo: FrotaVeiculo | null }>;
  },
  frotaDesassumirVeiculo: (kmAtual: number) =>
    request<{ ok: boolean; veiculo: null }>('/frota/me/desassumir', {
      method: 'POST',
      body: JSON.stringify({ km_atual: kmAtual }),
    }),
  frotaTermo: () => request<FrotaTermoInfo>('/frota/termo'),
  frotaEnviarAbastecimento: async (formData: FormData) => {
    const token = getToken();
    const res = await fetch(`${BASE}/frota/abastecimentos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erro ao registrar abastecimento');
    }
    return res.json();
  },
  frotaEnviarTermo: async (formData: FormData) => {
    const token = getToken();
    const res = await fetch(`${BASE}/frota/termo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erro ao registrar termo');
    }
    return res.json();
  },
  frotaDocumentos: (idVeiculo: number) => request<FrotaDocumento[]>(`/frota/veiculos/${idVeiculo}/documentos`),
  frotaEnviarDocumento: async (idVeiculo: number, formData: FormData) => {
    const token = getToken();
    const res = await fetch(`${BASE}/frota/veiculos/${idVeiculo}/documentos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erro ao enviar documento');
    }
    return res.json();
  },
  frotaExcluirDocumento: (idVeiculo: number, idDocumento: number) =>
    request<{ ok: boolean }>(`/frota/veiculos/${idVeiculo}/documentos/${idDocumento}`, {
      method: 'DELETE',
    }),
  frotaEnviarManutencaoVeiculo: async (idVeiculo: number, formData: FormData) => {
    const token = getToken();
    const res = await fetch(`${BASE}/frota/veiculos/${idVeiculo}/manutencoes`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erro ao registrar manutenção');
    }
    return res.json();
  },
  frotaAtualizarPosicao: (body: { latitude: number; longitude: number; precisao_metros?: number }) =>
    request<{ ok: boolean }>('/frota/posicao', { method: 'POST', body: JSON.stringify(body) }),

  escalaVisitasSemana: (query: string) =>
    request<EscalaVisitasGrade>(`/escalas/visitas/semana?${query}`),
  escalaVisitasSalvar: (body: EscalaVisitasSalvarBody) =>
    request<EscalaVisitasGrade>('/escalas/visitas/semana', { method: 'PUT', body: JSON.stringify(body) }),
  escalaVisitasCopiar: (body: { de: string; para: string }) =>
    request<EscalaVisitasGrade>('/escalas/visitas/semana/copiar', { method: 'POST', body: JSON.stringify(body) }),
  escalaVisitasSubmeter: (body: { semana_inicio: string; id_regiao?: number | null }) =>
    request<EscalaVisitasGrade>('/escalas/visitas/semana/submeter', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  escalaVisitasAprovar: (body: { semana_inicio: string; id_regiao: number; comentario?: string | null }) =>
    request<EscalaVisitasGrade>('/escalas/visitas/semana/aprovar', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  escalaVisitasDevolver: (body: { semana_inicio: string; id_regiao: number; comentario?: string | null }) =>
    request<EscalaVisitasGrade>('/escalas/visitas/semana/devolver', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  escalaVisitasDeliverySubmeter: (body: { semana_inicio: string }) =>
    request<EscalaVisitasGrade>('/escalas/visitas/semana/delivery/submeter', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  escalaVisitasDeliveryAprovar: (body: { semana_inicio: string; comentario?: string | null }) =>
    request<EscalaVisitasGrade>('/escalas/visitas/semana/delivery/aprovar', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  escalaVisitasDeliveryDevolver: (body: { semana_inicio: string; comentario?: string | null }) =>
    request<EscalaVisitasGrade>('/escalas/visitas/semana/delivery/devolver', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  escalaVisitasLimpar: (body: { semana_inicio: string; id_regiao: number }) =>
    request<EscalaVisitasGrade>('/escalas/visitas/semana/limpar', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  escalaVisitasDeliveryLimpar: (body: { semana_inicio: string }) =>
    request<EscalaVisitasGrade>('/escalas/visitas/semana/delivery/limpar', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  escalaVisitasNotificacoes: (naoLidas = false) =>
    request<EscalaVisitasNotificacao[]>(
      `/escalas/visitas/notificacoes${naoLidas ? '?nao_lidas=1' : ''}`,
    ),
  escalaVisitasNotificacoesLidas: (body?: { id_notificacao?: number | null }) =>
    request<{ ok: boolean }>('/escalas/visitas/notificacoes/lidas', {
      method: 'PATCH',
      body: JSON.stringify(body || {}),
    }),

  metasPeriodos: () => request<MetasPeriodoResumo[]>('/metas/periodos'),
  metasPeriodo: (id: number) => request<MetasPeriodoDetalhe>(`/metas/periodos/${id}`),
  metasCriarPeriodo: (body: {
    ano: number;
    mes: number;
    titulo?: string | null;
    id_periodo_base?: number | null;
  }) =>
    request<MetasPeriodoResumo>('/metas/periodos', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  metasSalvarRealizado: (body: {
    id_painel: number;
    id_indicador: number;
    id_loja: number;
    valor_texto?: string | null;
    valor_numero?: number | null;
    atingiu?: boolean | null;
  }) => request('/metas/realizados', { method: 'PUT', body: JSON.stringify(body) }),
  metasSalvarRanking: (body: {
    id_ranking: number;
    valor_numero?: number | null;
    valor_texto?: string | null;
    pontos?: number | null;
    classe?: string | null;
    destaque?: string | null;
    critico?: number | null;
  }) => request('/metas/rankings', { method: 'PUT', body: JSON.stringify(body) }),
  metasSalvarPremio: (body: {
    id_premio: number;
    premio_saude?: number | null;
    premio_rev?: number | null;
  }) => request<MetasPremio>('/metas/premios', { method: 'PUT', body: JSON.stringify(body) }),

  estoqueResumo: (idLoja: number) =>
    request<EstoqueResumo>(`/estoque/resumo?id_loja=${idLoja}`),
  estoqueProdutos: (params: { id_loja: number; q?: string; ativos?: boolean }) => {
    const q = new URLSearchParams();
    q.set('id_loja', String(params.id_loja));
    if (params.q) q.set('q', params.q);
    if (params.ativos === true) q.set('ativos', '1');
    if (params.ativos === false) q.set('ativos', '0');
    return request<ProdutoEstoque[]>(`/estoque/insumos?${q}`);
  },
  /** Igual a `estoqueProdutos`, mas paginado (offset): use para listas grandes. */
  estoqueProdutosPaginado: (params: {
    id_loja: number;
    q?: string;
    ativos?: boolean;
    page?: number;
    pageSize?: number;
  }) => {
    const q = new URLSearchParams();
    q.set('id_loja', String(params.id_loja));
    if (params.q) q.set('q', params.q);
    if (params.ativos === true) q.set('ativos', '1');
    if (params.ativos === false) q.set('ativos', '0');
    q.set('paginate', '1');
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    return request<PaginaOffset<ProdutoEstoque>>(`/estoque/insumos?${q}`);
  },
  estoqueCriarProduto: (body: ProdutoEstoqueInput) =>
    request<ProdutoEstoque>('/estoque/insumos', { method: 'POST', body: JSON.stringify(body) }),
  estoqueAtualizarProduto: (id: number, body: Partial<ProdutoEstoqueInput> & { ativo?: boolean }) =>
    request<ProdutoEstoque>(`/estoque/insumos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  estoqueContagens: (idLoja: number) =>
    request<EstoqueContagemResumo[]>(`/estoque/contagens?id_loja=${idLoja}`),
  /** Igual a `estoqueContagens`, mas paginado (offset). */
  estoqueContagensPaginado: (idLoja: number, opts?: { page?: number; pageSize?: number }) => {
    const q = new URLSearchParams({ id_loja: String(idLoja), paginate: '1' });
    if (opts?.page) q.set('page', String(opts.page));
    if (opts?.pageSize) q.set('pageSize', String(opts.pageSize));
    return request<PaginaOffset<EstoqueContagemResumo>>(`/estoque/contagens?${q}`);
  },
  estoqueContagemAtual: (idLoja: number) =>
    request<EstoqueContagemDetalhe>(`/estoque/contagens/atual?id_loja=${idLoja}`),
  estoqueIniciarSabado: (body: { id_loja: number; tipo?: 'completa' | 'critica_semanal' }) =>
    request<EstoqueContagemDetalhe>('/estoque/contagens/iniciar-sabado', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  estoqueContagem: (id: number) => request<EstoqueContagemDetalhe>(`/estoque/contagens/${id}`),
  estoqueCriarContagem: (body: {
    id_loja: number;
    data_contagem?: string;
    titulo?: string;
    observacao?: string;
    usar_ultimo_estoque?: boolean;
    tipo?: 'completa' | 'critica_semanal';
    reutilizar_aberta?: boolean;
  }) =>
    request<EstoqueContagemDetalhe>('/estoque/contagens', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  estoqueSalvarItens: (
    id: number,
    itens: Array<{
      id_item: number;
      contagem_caixa?: number | null;
      contagem_pc_fd?: number | null;
      contagem_kg_und?: number | null;
      estoque_contado?: number | null;
      estoque_sistema?: number;
    }>,
  ) =>
    request<EstoqueContagemDetalhe>(`/estoque/contagens/${id}/itens`, {
      method: 'PUT',
      body: JSON.stringify({ itens }),
    }),
  estoqueFinalizarContagem: (id: number) =>
    request<EstoqueContagemDetalhe>(`/estoque/contagens/${id}/finalizar`, { method: 'POST' }),
  estoqueReabrirContagem: (id: number) =>
    request<EstoqueContagemDetalhe>(`/estoque/contagens/${id}/reabrir`, { method: 'PATCH' }),
  estoqueExcluirContagem: (id: number) =>
    request<void>(`/estoque/contagens/${id}`, { method: 'DELETE' }),

  estoqueSaldos: (idLoja: number, q?: string) => {
    const params = new URLSearchParams({ id_loja: String(idLoja) });
    if (q) params.set('q', q);
    return request<EstoqueSaldoItem[]>(`/estoque/saldos?${params}`);
  },
  estoqueMovimentos: (
    idLoja: number,
    opts?: { tipo?: string; limit?: number; de?: string; ate?: string; id_insumo?: number },
  ) => {
    const params = new URLSearchParams({ id_loja: String(idLoja) });
    if (opts?.tipo) params.set('tipo', opts.tipo);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.de) params.set('de', opts.de);
    if (opts?.ate) params.set('ate', opts.ate);
    if (opts?.id_insumo) params.set('id_insumo', String(opts.id_insumo));
    return request<EstoqueMovimento[]>(`/estoque/movimentos?${params}`);
  },
  /** Igual a `estoqueMovimentos`, mas paginado (offset: page/pageSize). */
  estoqueMovimentosPaginado: (
    idLoja: number,
    opts?: { tipo?: string; page?: number; pageSize?: number },
  ) => {
    const params = new URLSearchParams({ id_loja: String(idLoja), paginate: '1' });
    if (opts?.tipo) params.set('tipo', opts.tipo);
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.pageSize) params.set('pageSize', String(opts.pageSize));
    return request<PaginaOffset<EstoqueMovimento>>(`/estoque/movimentos?${params}`);
  },
  estoqueProdutosVenda: (opts?: { id_loja: number; q?: string; sem_ficha?: boolean }) => {
    const params = new URLSearchParams();
    params.set('id_loja', String(opts!.id_loja));
    if (opts?.q) params.set('q', opts.q);
    if (opts?.sem_ficha) params.set('sem_ficha', '1');
    return request<ProdutoVendaEstoque[]>(`/estoque/produtos-venda?${params.toString()}`);
  },
  estoqueFichas: (idLoja: number) =>
    request<FichaTecnicaResumo[]>(`/estoque/fichas?id_loja=${idLoja}`),
  estoqueFicha: (id: number) => request<FichaTecnicaDetalhe>(`/estoque/fichas/${id}`),
  estoqueSalvarFicha: (body: {
    id_loja: number;
    codigo: string;
    descricao?: string;
    ativo?: boolean;
    /** false = produto unitário (Coca, brinquedo…) — não exige composição */
    requer_ficha?: boolean;
    observacao?: string;
    itens: Array<{
      codigo_insumo: string;
      quantidade: number;
      unidade_receita?: string;
      observacao?: string;
    }>;
  }) =>
    request<FichaTecnicaDetalhe>('/estoque/fichas', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  estoqueDesativarFicha: (id: number) =>
    request<void>(`/estoque/fichas/${id}`, { method: 'DELETE' }),
  estoqueExcluirProdutoVenda: (id: number) =>
    request<void>(`/estoque/produtos-venda/${id}`, { method: 'DELETE' }),
  estoqueVendas: (idLoja: number) =>
    request<EstoqueVendaResumo[]>(`/estoque/vendas?id_loja=${idLoja}`),
  /** Igual a `estoqueVendas`, mas paginado (offset). */
  estoqueVendasPaginado: (idLoja: number, opts?: { page?: number; pageSize?: number }) => {
    const q = new URLSearchParams({ id_loja: String(idLoja), paginate: '1' });
    if (opts?.page) q.set('page', String(opts.page));
    if (opts?.pageSize) q.set('pageSize', String(opts.pageSize));
    return request<PaginaOffset<EstoqueVendaResumo>>(`/estoque/vendas?${q}`);
  },
  estoqueVenda: (id: number) => request<EstoqueVendaDetalhe>(`/estoque/vendas/${id}`),
  estoqueVendasSemFicha: (idLoja?: number) => {
    const qs = idLoja ? `?id_loja=${idLoja}` : '';
    return request<EstoqueVendaSemFicha[]>(`/estoque/vendas/sem-ficha${qs}`);
  },
  estoqueProcessarVenda: (id: number) =>
    request<{ id_venda: number; status: string; processados: number; sem_ficha: number }>(
      `/estoque/vendas/${id}/processar`,
      { method: 'POST' },
    ),
  estoqueImportarVendasExcel: async (formData: FormData) => {
    const token = getToken();
    const res = await fetch(`${BASE}/estoque/vendas/import`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erro ao importar Excel');
    }
    return res.json() as Promise<{ linhas: number; dias: number; resultados: unknown[] }>;
  },
  estoqueSyncStatus: () => request<EstoqueSyncStatus>('/estoque/sync/status'),
  estoqueSyncVendas: (body: {
    id_loja: number;
    data_inicio: string;
    data_fim: string;
    termo_loja?: string;
    processar?: boolean;
  }) =>
    request<EstoqueSyncResult>('/estoque/sync/vendas', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  estoqueBreaks: (idLoja: number) =>
    request<EstoqueBreakResumo[]>(`/estoque/break?id_loja=${idLoja}`),
  estoqueBreakColaboradores: (idLoja: number) =>
    request<Array<{ id_usuario: number; nome: string }>>(
      `/estoque/break/colaboradores?id_loja=${idLoja}`,
    ),
  estoqueLancarBreak: (body: {
    id_loja: number;
    data_break?: string;
    tipo?: string;
    motivo?: string;
    id_colaborador?: number;
    colaborador_nome?: string;
    itens: Array<{
      id_produto?: number;
      codigo_insumo?: string;
      codigo_venda?: string;
      quantidade: number;
      descricao?: string;
    }>;
  }) =>
    request<{ break: EstoqueBreakResumo; baixas: unknown[]; erros: string[] }>('/estoque/break', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  estoqueEntradas: (body: {
    id_loja: number;
    observacao?: string;
    data_entrega?: string;
    id_nfe?: number;
    itens: Array<{ id_insumo?: number; codigo?: string; quantidade: number; observacao?: string }>;
  }) =>
    request<{ ok: boolean; entradas: unknown[]; erros: string[]; data_entrega?: string }>(
      '/estoque/entradas',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),
  estoqueCmvTeorico: (idLoja: number, opts?: { de?: string; ate?: string; meta?: number }) => {
    const params = new URLSearchParams({ id_loja: String(idLoja) });
    if (opts?.de) params.set('de', opts.de);
    if (opts?.ate) params.set('ate', opts.ate);
    if (opts?.meta != null) params.set('meta', String(opts.meta));
    return request<EstoqueCmvTeorico>(`/estoque/cmv/teorico?${params}`);
  },
  estoqueCmvReal: (
    idLoja: number,
    opts?: {
      de?: string;
      ate?: string;
      meta?: number;
      id_contagem_ei?: number;
      id_contagem_ef?: number;
    },
  ) => {
    const params = new URLSearchParams({ id_loja: String(idLoja) });
    if (opts?.de) params.set('de', opts.de);
    if (opts?.ate) params.set('ate', opts.ate);
    if (opts?.meta != null) params.set('meta', String(opts.meta));
    if (opts?.id_contagem_ei) params.set('id_contagem_ei', String(opts.id_contagem_ei));
    if (opts?.id_contagem_ef) params.set('id_contagem_ef', String(opts.id_contagem_ef));
    return request<EstoqueCmvReal>(`/estoque/cmv/real?${params}`);
  },
  estoqueCmvVariancia: (
    idLoja: number,
    opts?: {
      de?: string;
      ate?: string;
      id_contagem_ei?: number;
      id_contagem_ef?: number;
      limit?: number;
    },
  ) => {
    const params = new URLSearchParams({ id_loja: String(idLoja) });
    if (opts?.de) params.set('de', opts.de);
    if (opts?.ate) params.set('ate', opts.ate);
    if (opts?.id_contagem_ei) params.set('id_contagem_ei', String(opts.id_contagem_ei));
    if (opts?.id_contagem_ef) params.set('id_contagem_ef', String(opts.id_contagem_ef));
    if (opts?.limit) params.set('limit', String(opts.limit));
    return request<EstoqueCmvVariancia>(`/estoque/cmv/variancia?${params}`);
  },
  estoqueNfes: (idLoja: number, opts?: { pendentes?: boolean; conferir?: boolean; limit?: number }) => {
    const params = new URLSearchParams({ id_loja: String(idLoja) });
    if (opts?.pendentes) params.set('pendentes', '1');
    if (opts?.conferir) params.set('conferir', '1');
    if (opts?.limit) params.set('limit', String(opts.limit));
    return request<EstoqueNfeResumo[]>(`/estoque/nfes?${params}`);
  },
  estoqueNfeDetalhe: (idNfe: number) => request<EstoqueNfeDetalhe>(`/estoque/nfes/${idNfe}`),
  estoqueNfeConferir: (
    idNfe: number,
    body: {
      confirmar_todos?: boolean;
      itens?: Array<{
        id_item: number;
        qtd_conferida?: number;
        conferido?: boolean;
        divergencia_obs?: string;
      }>;
    },
  ) =>
    request<{
      ok: boolean;
      id_nfe: number;
      data_entrega: string;
      data_saida?: string | null;
      emissao: string | null;
      status_entrega: string;
      divergente?: boolean;
      entradas: unknown[];
      erros: string[];
    }>(`/estoque/nfes/${idNfe}/conferir`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  estoqueNfeEntrar: (idNfe: number, body: { data_entrega?: string; forcar?: boolean }) =>
    request<{
      ok: boolean;
      id_nfe: number;
      data_entrega: string;
      emissao: string | null;
      entradas: unknown[];
      erros: string[];
    }>(`/estoque/nfes/${idNfe}/entrar`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  estoqueDisciplina: (idLoja: number) =>
    request<EstoqueDisciplina>(`/estoque/disciplina?id_loja=${idLoja}`),
  estoqueFecharMes: (body: {
    id_loja: number;
    ano_mes: string;
    observacao?: string;
    forcar?: boolean;
  }) =>
    request<EstoqueFechamento>('/estoque/fechamento', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  estoqueReabrirMes: (body: { id_loja: number; ano_mes: string }) =>
    request<EstoqueFechamento>('/estoque/fechamento/reabrir', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  estoquePedidoSugerido: (
    idLoja: number,
    opts?: { crescimento?: number; dias?: number; estoque_seguranca_dias?: number },
  ) => {
    const params = new URLSearchParams({ id_loja: String(idLoja) });
    if (opts?.crescimento != null) params.set('crescimento', String(opts.crescimento));
    if (opts?.dias != null) params.set('dias', String(opts.dias));
    if (opts?.estoque_seguranca_dias != null) {
      params.set('estoque_seguranca_dias', String(opts.estoque_seguranca_dias));
    }
    return request<EstoquePedidoSugerido>(`/estoque/pedido-sugerido?${params}`);
  },
  estoqueAtualizarCustoInsumo: (body: {
    id_loja: number;
    id_insumo?: number;
    codigo?: string;
    preco_caixa: number;
    und_convertida?: number;
    fonte?: 'nf' | 'manual' | 'catalogo';
  }) =>
    request<ProdutoEstoque>('/estoque/insumos/custo', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Marca preços da planilha (já no cadastro) como manual — CMV passa a aceitar, sem custo extra. */
  estoquePromoverPlanilha: (body: { id_loja: number }) =>
    request<{
      id_loja: number;
      promovidos: number;
      itens: ProdutoEstoque[];
      ainda_sem_preco: Array<{ id_insumo: number; codigo: string; descricao: string }>;
    }>('/estoque/insumos/promover-planilha', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  estoqueSyncFornecedorListar: () =>
    request<{ itens: EstoqueSyncFornecedor[]; agora_sp: string }>('/estoque/sync-fornecedor'),
  estoqueSyncFornecedorSalvar: (body: {
    fornecedor: 'platlog' | 'coca';
    id_loja: number;
    ativo: boolean;
    horario: string;
    limite: number;
  }) =>
    request<EstoqueSyncFornecedor>('/estoque/sync-fornecedor', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  estoqueSyncFornecedorRodar: (id: number, body?: { forcar?: boolean }) =>
    request<{ ok: boolean; message: string; id_sync: number }>(
      `/estoque/sync-fornecedor/${id}/rodar`,
      { method: 'POST', body: JSON.stringify(body || {}) },
    ),
};

export interface Loja {
  id_loja: number;
  name: string;
  address: string;
  zip_code: string;
  city: string;
  state: string;
  neighborhood: string;
  bk_number: string | null;
  cnpj: string;
  corporate_name: string;
  is_active: boolean;
  nota_atual: string | number;
  ultima_visita: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export type LojaAtualizarInput = {
  name?: string;
  address?: string | null;
  zip_code?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  bk_number?: string | null;
  cnpj?: string | null;
  corporate_name?: string | null;
  is_active?: boolean;
  latitude?: number | null;
  longitude?: number | null;
};

export interface Usuario {
  id_usuario: number;
  nome: string;
  cargo: string;
  avatar_inicial: string;
  perfil?: string;
}

export interface LojaResumo {
  id_loja: number;
  nome: string;
  codigo_bkn?: string | null;
}

export interface Cargo {
  id_cargo: number;
  nome: string;
  codigo: string;
  descricao?: string | null;
  aprovador: boolean;
  ativo: boolean;
  created_at?: string;
  tipos_checklist?: TipoChecklistResumo[];
}

export interface CargoInput {
  nome: string;
  descricao?: string | null;
  aprovador?: boolean;
  ativo?: boolean;
  tipos_checklist?: string[];
}

export interface PermissaoCatalogo {
  codigo: string;
  nome: string;
  grupo: string;
  ordem: number;
}

export interface UsuarioGestao {
  id_usuario: number;
  nome: string;
  email: string;
  cargo?: string;
  cargo_aprovacao?: string | null;
  cargo_nome?: string | null;
  avatar_inicial?: string;
  perfil: string;
  lojas: LojaResumo[];
  lojas_ids: number[];
  permissoes: string[];
  ativo: boolean;
  acesso_todas_lojas?: boolean;
  telefone_whatsapp?: string | null;
  notifica_whatsapp?: boolean;
}

export interface UsuarioGestaoInput {
  nome: string;
  email: string;
  senha?: string;
  perfil?: string;
  cargo_aprovacao?: string | null;
  lojas_ids?: number[];
  permissoes?: string[];
  ativo?: boolean;
  telefone_whatsapp?: string | null;
  notifica_whatsapp?: boolean;
}

export interface WppStatus {
  enabled: boolean;
  conectado: boolean;
  servicoIndisponivel?: boolean;
  session?: string;
  message?: string;
  publicUrl?: string | null;
  sessionConfig?: string;
}

export interface WppQrResponse {
  conectado: boolean;
  qrcode?: string | null;
}

export interface WppConectarResponse {
  conectado: boolean;
  qrcode?: string | null;
  message?: string;
}

export interface TipoChecklist {
  id_tipo_checklist: number;
  codigo: string;
  nome: string;
  descricao?: string | null;
  ordem?: number;
  ativo?: boolean;
}

export interface MetaVisitaTimeCampo {
  gerente?: string;
  coordenador_1_dia?: string;
  coordenador_2_dia?: string;
  coordenador_madrugada_1?: string;
  coordenador_madrugada_2?: string;
  time_total?: string | number;
  territorio?: string;
  agendada_mapa?: boolean;
  agendada_por?: string;
  observacao_mapa?: string;
}

export interface CategoriaChecklistResumo {
  id_categoria: number;
  nome: string;
  icone: string;
  ordem: number;
}

export interface CategoriaChecklist {
  id_categoria: number;
  nome: string;
  icone: string;
  ordem: number;
  perguntas: Pergunta[];
}

export type TipoResposta = 'estrelas' | 'sim_nao' | 'estrelas_foto' | 'sim_nao_foto';

export interface Pergunta {
  id_pergunta: number;
  id_categoria: number;
  codigo: string;
  texto: string;
  tipo_resposta: TipoResposta;
  obrigatoria: boolean;
  peso: string;
  requer_foto: boolean;
  requer_obs_em_nao: boolean;
  critica: boolean;
  /** Quando true, "Sim" indica problema (Não pontua 100). */
  sim_indica_problema?: boolean;
  ordem: number;
}

export interface PerguntaInput {
  id_categoria: number;
  codigo?: string;
  texto: string;
  tipo_resposta: TipoResposta;
  obrigatoria?: boolean;
  peso?: number;
  ordem?: number;
  requer_foto?: boolean;
  requer_obs_em_nao?: boolean;
  critica?: boolean;
  sim_indica_problema?: boolean;
}

export interface VisitaResumo {
  id_visita: number;
  id_loja: number;
  id_usuario?: number;
  name: string;
  bk_number: string | null;
  nome_usuario: string;
  data_visita: string;
  hora_inicio?: string | null;
  duracao_minutos: number | null;
  nota_final: string | number | null;
  status: string;
  nc_abertas?: number;
  tipo_checklist_codigo?: string;
  tipo_checklist_nome?: string;
  meta_visita?: MetaVisitaTimeCampo;
}

export interface RespostaInput {
  id_pergunta: number;
  resposta?: 'Sim' | 'Não' | 'N/A' | null;
  nota_estrelas?: number | null;
  observacao?: string;
  foto_url?: string | null;
}

export interface VisitaDetalhe {
  visita: VisitaResumo & { city: string; state: string; neighborhood: string };
  respostas: Array<{
    id_pergunta: number;
    codigo?: string;
    resposta: string | null;
    nota_estrelas?: number | null;
    observacao?: string | null;
    midia_urls?: string[];
    texto: string;
    sim_indica_problema?: boolean;
    categoria: string;
  }>;
  desempenho_categorias: Array<{ categoria: string; percentual: string }>;
  nao_conformidades: Array<{ descricao: string; gravidade: string; area: string }>;
  historico_notas: Array<{ nota: string; data_registro: string }>;
}

export interface DashboardData {
  metricas: {
    media_geral: number;
    visitas_mes: number;
    total_ncs_abertas: number;
    ncs_criticas: number;
    lojas_abaixo_75: number;
    lojas_ativas: number;
  };
  ranking: RankingLoja[];
  ncs_recentes: Array<{
    descricao: string;
    name: string;
    data_cadastro: string;
    gravidade: string;
  }>;
  ncs_por_gravidade?: Array<{
    gravidade: string;
    total: number;
  }>;
}

export type SaudeLojaNivel = 'critica' | 'atencao' | 'ok';

export interface SaudeLojaMetas {
  ok: number;
  falhou: number;
  pendentes: number;
  indicadores: number;
  meta_peso: number;
  realizado_peso: number;
  pct_atingido: number | null;
  tem_dados: boolean;
}

export interface SaudeLoja {
  id_loja: number;
  name: string;
  bk_number: string | null;
  city: string | null;
  neighborhood: string | null;
  regiao: string | null;
  nota_atual: number | null;
  ultima_visita: string | null;
  dias_sem_visita: number | null;
  visitas_mes: number;
  ncs_abertas: number;
  ncs_criticas: number;
  chamados_abertos: number;
  chamados_urgentes: number;
  chamados_sla_estourado: number;
  cmv_teorico_pct: number | null;
  cmv_meta_pct: number;
  cmv_confiavel: boolean;
  cmv_cobertura_pct: number | null;
  metas: SaudeLojaMetas | null;
  nivel: SaudeLojaNivel;
  score: number;
  motivos: string[];
}

export interface DashboardSaudeLojasData {
  periodo: { de: string; ate: string };
  metas_periodo: {
    id_periodo: number;
    ano: number;
    mes: number;
    titulo: string | null;
  } | null;
  resumo: {
    total: number;
    criticas: number;
    atencao: number;
    ok: number;
    com_nc: number;
    com_chamado: number;
    cmv_alto: number;
    metas_atrasadas: number;
  };
  lojas: SaudeLoja[];
}

export interface RankingLoja {
  id_loja: number;
  name: string;
  city: string;
  state: string;
  neighborhood: string;
  bk_number: string | null;
  nota_atual: string | number;
  ultima_visita: string | null;
  posicao_ranking: number;
  nota_anterior?: string | number | null;
}

export interface ManutSla {
  id_sla: number;
  nome: string;
  horas: number;
  urgencia_padrao: string;
  ativo?: boolean;
}

export interface ManutSlaInput {
  nome: string;
  horas: number;
  urgencia_padrao: string;
  ativo?: boolean;
}

export interface ManutNotificacaoPlaceholder {
  chave: string;
  descricao: string;
}

export interface ManutNotificacaoEvento {
  codigo: string;
  descricao: string;
  notifica_abrir: boolean;
  notifica_ver: boolean;
  notifica_diretor: boolean;
  notifica_tecnico: boolean;
  notifica_supervisor: boolean;
  notifica_coordenador: boolean;
  notifica_gerente: boolean;
  ativo: boolean;
  sistema: boolean;
  template_mensagem: string;
  template_destinatario: string;
  envia_push: boolean;
}

export interface ManutNotificacaoEventosResponse {
  eventos: ManutNotificacaoEvento[];
  placeholders: ManutNotificacaoPlaceholder[];
}

export interface ManutNotificacaoEventoInput {
  codigo?: string;
  descricao: string;
  template_mensagem: string;
  template_destinatario?: string | null;
  notifica_abrir?: boolean;
  notifica_ver?: boolean;
  notifica_diretor?: boolean;
  notifica_tecnico?: boolean;
  notifica_supervisor?: boolean;
  notifica_coordenador?: boolean;
  notifica_gerente?: boolean;
  ativo?: boolean;
}

export interface ManutNotificacaoPreviewInput {
  codigo: string;
  template_mensagem?: string;
  template_destinatario?: string | null;
  destinatario?: boolean;
  vars?: Record<string, string | number>;
}

export interface ManutCategoria {
  id_categoria: number;
  nome: string;
  sla_horas: number;
  id_sla?: number;
  sla_nome?: string;
  urgencia_padrao: string;
  ativo?: boolean;
}

export interface ManutCategoriaInput {
  nome: string;
  id_sla: number;
  ativo?: boolean;
}

export interface ManutLoja {
  id_loja: number;
  nome: string;
  codigo_bkn: string | null;
}

export interface ManutFormulario {
  categorias: ManutCategoria[];
  lojas: ManutLoja[];
}

export interface FrotaVeiculo {
  id_veiculo: number;
  placa: string;
  renavam?: string | null;
  chassi?: string | null;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  cor: string | null;
  combustivel?: string | null;
  km_inicial?: number | null;
  km_atual: number | null;
  /** KM informado na atribuição/assunção atual (se em uso) */
  km_assuncao?: number | null;
  /** KM em que deve ocorrer a próxima manutenção */
  proxima_manutencao_km?: number | null;
  km_rodados?: number | null;
  /** Veículo encontrado no rastreador (Fulltrack) */
  gps_instalado?: boolean;
  id_rastreamento?: number | string | null;
  rastreamento_disponivel?: boolean;
  odometro_gps?: number | null;
  observacoes?: string | null;
  assuncao_em: string | null;
  nome_responsavel?: string | null;
  id_usuario_responsavel?: number | null;
  id_regiao?: number | null;
  nome_regiao?: string | null;
}

export type FrotaVeiculoBody = {
  placa: string;
  renavam?: string;
  chassi?: string;
  marca?: string;
  modelo?: string;
  ano?: number | null;
  cor?: string;
  combustivel?: string;
  km_inicial?: number | null;
  km_atual?: number | null;
  observacoes?: string;
  id_regiao?: number | null;
};

export interface FrotaAbastecimentoResumo {
  id_abastecimento: number;
  km_atual: number;
  valor_abastecido: number;
  data_abastecimento: string;
  comprovante_url: string | null;
}

export interface FrotaAbastecimentoMobile extends FrotaAbastecimentoResumo {
  id_veiculo: number;
  placa: string;
}

export interface FrotaManutencaoMobile {
  id_manutencao: number;
  id_veiculo: number;
  placa: string;
  descricao: string;
  km: number | null;
  valor: number | null;
  data_manutencao: string;
  proxima_manutencao_km: number | null;
  comprovante_url: string | null;
}

export interface FrotaMultaPortal {
  id_multa: number;
  id_veiculo: number;
  id_usuario: number;
  placa: string;
  nome_usuario: string;
  descricao: string | null;
  valor: number | null;
  data_multa: string;
  local_infracao: string | null;
  foto_url: string | null;
  created_at: string;
}

/** Multa retornada pela consulta DETRAN-DF (APIBrasil /multas/br). */
export interface FrotaMultaDetran {
  id_multa_detran: number;
  id_veiculo: number;
  placa: string;
  modelo?: string | null;
  auto: string | null;
  descricao: string | null;
  local_infracao: string | null;
  valor: number | null;
  valor_desconto?: number | null;
  data_multa: string | null;
  hora_multa?: string | null;
  data_vencimento?: string | null;
  orgao?: string | null;
  pontos?: number | null;
  natureza?: string | null;
  velocidade_aferida?: number | null;
  velocidade_permitida?: number | null;
  responsavel_infracao?: string | null;
  data_notificacao_autuacao?: string | null;
  fonte?: string;
  status: 'Em Aberto' | 'Paga' | 'Vencida';
}

export interface FrotaMultasDetranResposta {
  fonte: string;
  consultado_em: string | null;
  data_ref?: string | null;
  status_sync?: string | null;
  proxima_consulta?: string;
  horario_sync?: string;
  qtd_veiculos?: number;
  veiculos?: Array<{
    id_veiculo: number;
    placa: string;
    renavam?: string;
    modelo?: string | null;
    ok: boolean;
    qtd_multas?: number;
    erro?: string;
  }>;
  multas: FrotaMultaDetran[];
  avisos: string[];
}

/** Débito IPVA / Licenciamento (Infosimples detran/df/debitos). */
export interface FrotaDebitoDetran {
  id_debito_detran: number;
  id_veiculo: number;
  placa: string;
  modelo?: string | null;
  tipo: 'IPVA' | 'Licenciamento';
  ano_referencia: string | null;
  data_validade: string | null;
  data_vencimento: string | null;
  valor_total: number | null;
  valor_original: number | null;
  valor_pago: number | null;
  valor_multa: number | null;
  valor_mora: number | null;
  valor_outros: number | null;
  valor_diferenca: number | null;
  boleto: string | null;
  status: string;
  cota?: string | null;
  razao_social?: string | null;
  fonte?: string;
}

export interface FrotaDebitosDetranResposta {
  fonte: string;
  consultado_em: string | null;
  data_ref?: string | null;
  status_sync?: string | null;
  avisos: string[];
  debitos: FrotaDebitoDetran[];
}

export interface FrotaAssuncao {
  id_assuncao: number;
  id_veiculo: number;
  id_usuario: number;
  placa: string;
  nome_usuario: string;
  km_inicio: number | null;
  km_fim: number | null;
  data_inicio: string;
  data_fim: string | null;
}

export interface FrotaAbastecimentoPortal extends FrotaAbastecimentoResumo {
  id_veiculo: number;
  id_usuario: number;
  placa: string;
  nome_usuario: string;
}

export interface FrotaManutencaoPortal {
  id_manutencao: number;
  id_veiculo: number;
  id_usuario: number;
  placa: string;
  nome_usuario: string;
  descricao: string;
  /** KM do odômetro na data da manutenção */
  km: number | null;
  /** KM atual do veículo (cadastro / sync GPS) */
  km_atual_veiculo?: number | null;
  valor: number | null;
  data_manutencao: string;
  proxima_manutencao: string | null;
  /** KM em que deve ocorrer a próxima manutenção (informado pelo técnico) */
  proxima_manutencao_km?: number | null;
  created_at: string;
}

export interface FrotaTermoPortalResumo {
  id_termo: number;
  id_usuario: number;
  nome_usuario: string;
  nome_regiao?: string | null;
  termo_versao: string;
  assinado_em: string;
  assinatura_url: string;
}

export interface FrotaTermoPortalDetalhe extends FrotaTermoPortalResumo {
  texto: string;
  empresa: typeof import('../config/empresa').EMPRESA_TERMO;
  fotos: { id_anexo: number; url: string }[];
}

export interface FrotaRegiaoLoja {
  id_loja: number;
  name: string;
  bk_number: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  id_regiao?: number | null;
  nome_regiao?: string | null;
}

export interface FrotaRegiaoResumo {
  id_regiao: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  id_regional?: number | null;
  nome_regional?: string | null;
  email_regional?: string | null;
  regionais?: FrotaRegiaoUsuario[];
  qtd_lojas: number;
  qtd_tecnicos: number;
  qtd_veiculos: number;
  created_at: string;
  updated_at: string;
}

export interface FrotaRegiaoUsuario {
  id_usuario: number;
  nome: string;
  email: string | null;
  cargo?: string | null;
  gps_habilitado?: boolean;
}

export type FrotaRegiaoTecnico = FrotaRegiaoUsuario;

export interface FrotaTecnicoPosicao {
  id_usuario: number;
  nome: string;
  email: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  precisao_metros?: number | string | null;
  atualizado_em?: string | null;
  id_regiao?: number | null;
  nome_regiao?: string | null;
  gps_habilitado?: boolean;
}

export interface FrotaVeiculoPosicao {
  id_veiculo: number;
  placa: string;
  marca?: string | null;
  modelo?: string | null;
  id_regiao?: number | null;
  nome_regiao?: string | null;
  id_rastreamento?: number | null;
  latitude: number | null;
  longitude: number | null;
  velocidade?: number | null;
  ignicao?: boolean | null;
  direcao?: string | null;
  atualizado_em?: string | null;
  motorista?: string | null;
  odometro_km?: number | null;
  combustivel_litros?: number | null;
  rastreamento_disponivel?: boolean;
}

export interface FrotaVeiculoHistoricoPonto {
  id: number;
  latitude: number;
  longitude: number;
  velocidade?: number;
  ignicao?: boolean;
  atualizado_em?: string | null;
  odometro_km?: number | null;
  combustivel_litros?: number | null;
}

export interface FrotaVeiculoHistoricoRastreamento {
  pontos: FrotaVeiculoHistoricoPonto[];
  rastreamento_ativo?: boolean;
}

export interface FrotaTelemetriaVeiculo {
  id_veiculo: number;
  placa: string;
  marca?: string | null;
  modelo?: string | null;
  odometro_km?: number | null;
  combustivel_litros?: number | null;
  rastreamento_disponivel?: boolean;
  atualizado_em?: string | null;
}

export interface FrotaRastreamentoTelemetria {
  veiculos: FrotaTelemetriaVeiculo[];
  rastreamento_ativo?: boolean;
}

export interface FrotaRotaDiaSegmento {
  id: number;
  pontos: FrotaVeiculoHistoricoPonto[];
  coords_rua?: [number, number][];
  km: number;
  inicio?: string | null;
  fim?: string | null;
  qtd_excessos?: number;
  id_usuario_tecnico?: number | null;
  nome_tecnico?: string | null;
}

export interface FrotaExcessoMapaItem {
  inicio: [number, number];
  fim: [number, number];
  coords_linha: [number, number][];
  v_max: number;
  inicio_em?: string | null;
  fim_em?: string | null;
  vel_inicio: number;
  vel_fim: number;
  mesmo_ponto?: boolean;
}

export interface FrotaVeiculoRotaDiaRelatorio {
  veiculo: { id_veiculo: number; placa: string; marca?: string | null; modelo?: string | null };
  data_inicio: string;
  data_fim: string;
  limite_kmh?: number;
  qtd_excessos?: number;
  qtd_paradas?: number;
  tempo_parado_ms?: number;
  tempo_ligado_ms?: number;
  tempo_desligado_ms?: number;
  velocidade_media?: number;
  pontos: FrotaVeiculoHistoricoPonto[];
  rotas: FrotaRotaDiaSegmento[];
  excessos_mapa?: FrotaExcessoMapaItem[];
  km_gps: number;
  km_odometro?: number | null;
  combustivel_litros?: number | null;
  total_pontos: number;
  rastreamento_ativo?: boolean;
}

export interface FrotaRegistroVelocidade {
  velocidade: number;
  limite: number;
  latitude: number;
  longitude: number;
  atualizado_em?: string | null;
  status: 'normal' | 'excesso' | 'parado';
  id_usuario_tecnico?: number | null;
  nome_tecnico?: string | null;
}

export interface FrotaExcessoVelocidade {
  velocidade: number;
  limite: number;
  latitude: number;
  longitude: number;
  atualizado_em?: string | null;
  id_usuario_tecnico?: number | null;
  nome_tecnico?: string | null;
}

export interface FrotaVeiculoVelocidadeRelatorio {
  veiculo: { id_veiculo: number; placa: string; marca?: string | null; modelo?: string | null };
  data_inicio: string;
  data_fim: string;
  limite_kmh: number;
  velocidade_media: number;
  velocidade_maxima: number;
  total_pontos: number;
  qtd_excessos: number;
  qtd_normais?: number;
  qtd_parados?: number;
  tempo_parado_ms?: number;
  tempo_ligado_ms?: number;
  tempo_desligado_ms?: number;
  excessos: FrotaExcessoVelocidade[];
  registros: FrotaRegistroVelocidade[];
  km_gps: number;
  rastreamento_ativo?: boolean;
}

export interface FrotaKmConfrontoItem {
  id_veiculo: number;
  placa: string;
  veiculo: string;
  km_manual: number | null;
  km_rastreador: number | null;
  diferenca: number | null;
}

export interface FrotaKmConfrontoRelatorio {
  data_inicio: string;
  data_fim: string;
  manual: { id_veiculo: number; placa: string; km_percorrido: number; registros: number }[];
  rastreador: { id_veiculo: number; placa: string; km_gps: number | null; km_odometro: number | null }[];
  confronto: FrotaKmConfrontoItem[];
  rastreamento_ativo?: boolean;
}

export interface FrotaRegiaoPosicoesMapa {
  tecnicos: FrotaTecnicoPosicao[];
  veiculos: FrotaVeiculoPosicao[];
  rastreamento_ativo?: boolean;
}

export interface FrotaMapaPosicoes {
  tecnicos: FrotaTecnicoPosicao[];
  lojas: FrotaRegiaoLoja[];
  regioes: { id_regiao: number; nome: string }[];
  veiculos: FrotaVeiculoPosicao[];
  rastreamento_ativo?: boolean;
}

export interface EscalaVisitasRegional {
  id_usuario: number;
  nome: string;
  avatar_inicial?: string | null;
  cor: string;
  grupo_nome?: string | null;
}

export interface EscalaVisitasAtribuicao {
  id_celula?: number;
  id_regional?: number | null;
  nome_regional?: string | null;
  cor?: string | null;
  id_loja_destino?: number | null;
  nome_loja_destino?: string | null;
  bk_loja_destino?: string | null;
  observacao?: string | null;
}

export interface EscalaVisitasDia {
  dia: number;
  atribuicoes: EscalaVisitasAtribuicao[];
  /** Primeira atribuição — compatibilidade */
  id_regional?: number | null;
  nome_regional?: string | null;
  cor?: string | null;
  id_loja_destino?: number | null;
  nome_loja_destino?: string | null;
  bk_loja_destino?: string | null;
  observacao?: string | null;
}

export interface EscalaVisitasLinha {
  id_loja: number;
  nome: string;
  bk_number?: string | null;
  id_regiao?: number | null;
  nome_regiao?: string | null;
  tipo?: 'loja' | 'delivery';
  total_visitas: number;
  dias: EscalaVisitasDia[];
}

export interface EscalaVisitasLojaDestino {
  id_loja: number;
  nome: string;
  bk_number?: string | null;
}

export type EscalaVisitasRegiaoStatusCodigo = 'rascunho' | 'pendente_aprovacao' | 'aprovado';

export type EscalaVisitasNotificacaoTipo = 'pendente_aprovacao' | 'aprovado' | 'recusado';

export interface EscalaVisitasNotificacao {
  id_notificacao: number;
  tipo: EscalaVisitasNotificacaoTipo;
  mensagem: string;
  id_semana?: number | null;
  id_regiao?: number | null;
  nome_regiao?: string | null;
  semana_inicio?: string | null;
  lida: boolean;
  created_at: string;
}

export interface EscalaVisitasRegiaoStatus {
  id_regiao: number;
  nome_regiao: string;
  status: EscalaVisitasRegiaoStatusCodigo;
  submetido_por?: number | null;
  submetido_em?: string | null;
  revisado_por?: number | null;
  revisado_em?: string | null;
  comentario?: string | null;
  nome_submetido_por?: string | null;
  nome_revisado_por?: string | null;
}

export interface EscalaVisitasDeliveryStatus {
  status: EscalaVisitasRegiaoStatusCodigo;
  submetido_por?: number | null;
  submetido_em?: string | null;
  revisado_por?: number | null;
  revisado_em?: string | null;
  comentario?: string | null;
  nome_submetido_por?: string | null;
  nome_revisado_por?: string | null;
}

export interface EscalaVisitasGrade {
  id_semana: number;
  semana_inicio: string;
  semana_fim: string;
  semana_label: string;
  pode_editar: boolean;
  pode_editar_regiao?: boolean;
  pode_editar_delivery?: boolean;
  pode_submeter?: boolean;
  pode_submeter_delivery?: boolean;
  pode_aprovar?: boolean;
  pode_devolver?: boolean;
  pode_excluir?: boolean;
  status_regiao?: EscalaVisitasRegiaoStatusCodigo | null;
  status_por_regiao?: EscalaVisitasRegiaoStatus[];
  status_delivery?: EscalaVisitasDeliveryStatus | null;
  id_regiao_filtro: number | null;
  regionais: EscalaVisitasRegional[];
  regioes: Array<{ id_regiao: number; nome: string }>;
  /** Técnicos da região que visitam juntos (par). */
  equipes_por_regiao?: Array<{
    id_regiao: number;
    ids_usuario: number[];
    nomes: string[];
  }>;
  lojas_destino?: EscalaVisitasLojaDestino[];
  linhas: EscalaVisitasLinha[];
}

export interface EscalaVisitasSalvarBody {
  semana_inicio: string;
  id_regiao?: number | null;
  celulas: Array<{
    id_loja: number;
    dia: number;
    id_regionais?: number[];
    id_regional?: number | null;
    id_lojas_destino?: number[];
    id_loja_destino?: number | null;
    observacao?: string | null;
  }>;
}

export interface MetasPeriodoResumo {
  id_periodo: number;
  ano: number;
  mes: number;
  titulo: string | null;
  observacao: string | null;
  criado_em: string;
}

export interface MetasCelulaRealizado {
  id_loja: number;
  rotulo_curto: string | null;
  nome_loja: string;
  bk_number: string | null;
  valor_texto: string | null;
  valor_numero: number | null;
  atingiu: boolean | null;
  pontos_obtidos: number | null;
}

export interface MetasPainelIndicador {
  id_indicador: number;
  codigo: string;
  nome: string;
  peso: number;
  tipo_valor: string;
  celulas: MetasCelulaRealizado[];
}

export interface MetasPainel {
  id_painel: number;
  codigo: string;
  titulo: string;
  tipo: string;
  ordem: number;
  subtotal_peso: number;
  lojas: Array<{ id_loja: number; rotulo_curto: string | null; ordem: number; nome_loja: string; bk_number: string | null }>;
  indicadores: MetasPainelIndicador[];
}

export interface MetasRankingLinha {
  id_ranking: number;
  posicao: number | null;
  id_loja: number | null;
  nome_loja: string | null;
  bk_number: string | null;
  valor_numero: number | null;
  valor_texto: string | null;
  pontos: number | null;
  classe: string | null;
  destaque: string | null;
  critico: number | null;
  nome_gestor: string | null;
}

export interface MetasRankingGrupo {
  id_indicador: number;
  codigo: string;
  nome: string;
  meta_minima: number | null;
  linhas: MetasRankingLinha[];
}

export interface MetasPremio {
  id_premio: number;
  id_usuario: number | null;
  nome: string;
  premio_saude: number | null;
  premio_rev: number | null;
  valor_unitario: number | null;
  subtotal: number | null;
  total: number | null;
  observacao: string | null;
}

export interface MetasPeriodoDetalhe {
  periodo: MetasPeriodoResumo;
  pode_editar: boolean;
  paineis: MetasPainel[];
  rankings: MetasRankingGrupo[];
  premios: MetasPremio[];
}

/** Envelope de paginação por offset (page/pageSize). Só é retornado quando `paginate=1` é enviado. */
export interface PaginaOffset<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ProdutoEstoque {
  /** PK na tabela insumos (preferir este campo). */
  id_insumo?: number;
  /** Alias de transição (= id_insumo). */
  id_produto: number;
  id_loja: number | null;
  codigo: string;
  descricao: string;
  unidade_contagem: string;
  preco_caixa: number;
  und_convertida: number;
  /** Fator PC/FD na fórmula QTD (padrão 1). */
  und_parcial?: number;
  valor_unidade: number;
  /** nf | catalogo | manual — fontes aceitas no CMV. Null/planilha = sem custo automático. */
  custo_fonte?: string | null;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export type ProdutoEstoqueInput = {
  id_loja: number;
  codigo: string;
  descricao: string;
  unidade_contagem?: string;
  preco_caixa?: number;
  und_convertida?: number;
  und_parcial?: number;
};

export interface EstoqueContagemResumo {
  id_contagem: number;
  id_loja: number | null;
  loja_nome?: string | null;
  loja_codigo?: string | null;
  data_contagem: string;
  titulo: string | null;
  tipo?: 'completa' | 'critica_semanal' | string;
  status: 'aberta' | 'finalizada' | string;
  observacao?: string | null;
  total_valor: number | null;
  /** Valor monetário desta contagem (itens já preenchidos). */
  valor_atual?: number | null;
  /** Valor da 1ª contagem completa finalizada do mês (início do estoque). */
  valor_inicial_mes?: number | null;
  data_inicial_mes?: string | null;
  itens_total?: number;
  pendentes?: number;
  divergencias?: number;
  criado_por?: number | null;
  criado_por_nome?: string | null;
  criado_em?: string;
  finalizado_em?: string | null;
}

export interface EstoqueItem {
  id_item: number;
  id_produto: number;
  codigo: string;
  descricao: string;
  unidade_contagem: string;
  preco_caixa: number;
  und_convertida: number;
  und_parcial?: number;
  valor_unidade: number;
  /** Célula preta na planilha = false (campo bloqueado). */
  permite_contagem_caixa?: boolean;
  permite_contagem_pc_fd?: boolean;
  permite_contagem_kg_und?: boolean;
  /** Itens da faixa I7:I231 — entram no TOTAL CMV. */
  entra_cmv?: boolean;
  /** Seção da planilha (CONGELADOS, BRINDES, …). */
  secao_contagem?: string | null;
  ordem_contagem?: number | null;
  estoque_sistema: number;
  /** Entradas da planilha Terraço */
  contagem_caixa?: number | null;
  contagem_pc_fd?: number | null;
  contagem_kg_und?: number | null;
  /** QTD = CAIXA*und_convertida + PC*und_parcial + KG/UND */
  estoque_contado: number | null;
  diferenca: number | null;
  valor_estoque: number | null;
}

export interface EstoqueContagemDetalhe extends EstoqueContagemResumo {
  total_diferenca?: number;
  itens: EstoqueItem[];
  meta?: {
    sabado?: string;
    hoje?: string;
    eh_sabado?: boolean;
    iniciada_agora?: boolean;
    aguardando_sabado?: boolean;
  };
}

export interface EstoqueResumo {
  produtos: { total: number; ativos: number };
  contagens: { total: number; abertas: number; finalizadas: number };
}

export interface EstoqueSaldoItem {
  id_produto: number;
  id_insumo?: number;
  codigo: string;
  descricao: string;
  unidade_contagem: string;
  valor_unidade: number;
  quantidade: number;
  valor_total: number;
  atualizado_em?: string | null;
}

export interface EstoqueCmvTeorico {
  id_loja: number;
  de: string | null;
  ate: string | null;
  /** Persistido historicamente; após sync BK Office passa a ser venda bruta. */
  venda_liquida: number;
  /** Alias explícito da venda usada no CMV (= bruta do BK Office). */
  venda_bruta?: number;
  custo_teorico: number;
  cmv_teorico_pct: number | null;
  /** Consumo break (galera) no período — baixa real de estoque. */
  custo_break?: number;
  qtd_breaks?: number;
  break_pct_venda?: number | null;
  /** Teórico + break. */
  custo_total?: number;
  cmv_com_break_pct?: number | null;
  meta_pct: number;
  gap_pp: number | null;
  gap_reais: number | null;
  itens: number;
  itens_sem_ficha: number;
  itens_com_ficha?: number;
  itens_com_custo_completo?: number;
  cobertura_custo_pct?: number;
  cmv_confiavel?: boolean;
  /** true quando CMV% > 70 — quase sempre und_convertida/preço unitário errado */
  custo_suspeito?: boolean;
  dias_venda: number;
  aviso?: string | null;
}

export interface EstoqueCmvReal {
  id_loja: number;
  de: string | null;
  ate: string | null;
  regra_compras: 'data_entrega';
  estoque_inicial: number | null;
  compras: number;
  estoque_final: number | null;
  consumo_real: number | null;
  venda: number;
  cmv_real_pct: number | null;
  cmv_teorico_pct: number | null;
  cmv_com_break_pct?: number | null;
  custo_teorico?: number;
  custo_break?: number;
  meta_pct: number;
  gap_vs_meta_pp: number | null;
  gap_vs_teorico_pp: number | null;
  gap_vs_teorico_reais: number | null;
  contagem_ei?: { id_contagem: number; data_contagem: string; total_valor: number | null; titulo?: string } | null;
  contagem_ef?: { id_contagem: number; data_contagem: string; total_valor: number | null; titulo?: string } | null;
  compras_detalhe?: {
    nfs_pendentes_loja?: number;
    movimentos?: number;
  };
  cobertura_custo_pct?: number;
  cmv_confiavel?: boolean;
  avisos?: string[];
  aviso?: string | null;
}

export interface EstoqueCmvVarianciaItem {
  id_insumo: number;
  codigo: string;
  descricao: string;
  unidade_contagem?: string;
  qtd_ei: number;
  qtd_compras: number;
  qtd_ef: number;
  qtd_real: number;
  qtd_teorico: number;
  gap_qtd: number;
  gap_reais: number;
  gap_pct_teorico: number | null;
}

export interface EstoqueCmvVariancia {
  id_loja: number;
  de?: string | null;
  ate?: string | null;
  itens: EstoqueCmvVarianciaItem[];
  gap_total_reais?: number;
  aviso?: string | null;
}

export interface EstoqueNfeResumo {
  id_nfe: number;
  id_loja: number;
  fornecedor: string;
  numero?: string | null;
  chave?: string | null;
  emissao?: string | null;
  data_saida?: string | null;
  data_entrega?: string | null;
  status_portal?: string | null;
  status_entrega?: string | null;
  emitente_nome?: string | null;
  valor_total?: number | null;
  entrada_registrada: boolean;
  itens?: number;
  itens_casados?: number;
}

export interface EstoqueNfeItem {
  id_item: number;
  n_item?: number | null;
  codigo_nf?: string | null;
  descricao?: string | null;
  codigo_insumo?: string | null;
  descricao_insumo?: string | null;
  q_com?: number | null;
  qtd_estoque?: number | null;
  qtd_conferida?: number | null;
  conferido?: boolean;
  id_insumo?: number | null;
  unidade_contagem?: string | null;
}

export interface EstoqueNfeDetalhe extends Omit<EstoqueNfeResumo, 'itens'> {
  itens: EstoqueNfeItem[];
}

export interface EstoqueDisciplinaAlerta {
  tipo: string;
  severidade: 'alta' | 'media' | 'baixa' | string;
  mensagem: string;
}

export interface EstoqueDisciplina {
  id_loja: number;
  hoje: string;
  ultima_completa?: { id_contagem: number; data_contagem: string; titulo?: string } | null;
  ultima_critica?: { id_contagem: number; data_contagem: string; titulo?: string } | null;
  dias_desde_completa?: number | null;
  dias_desde_critica?: number | null;
  contagens_abertas: number;
  nfs_pendentes_entrada: number;
  cmv_mes?: {
    cmv_teorico_pct: number | null;
    cobertura_custo_pct?: number;
    meta_pct: number;
  } | null;
  fechamento_mes: { ano_mes: string; status: string; cmv_real_pct?: number | null; fechado_em?: string | null };
  alertas: EstoqueDisciplinaAlerta[];
}

export interface EstoqueFechamento {
  id_fechamento: number;
  id_loja: number;
  ano_mes: string;
  status: string;
  cmv_real_pct?: number | null;
  cmv_teorico_pct?: number | null;
  fechado_em?: string | null;
}

export interface EstoquePedidoItem {
  codigo: string;
  descricao: string;
  consumo_projetado: number;
  estoque_seguranca: number;
  saldo_atual: number;
  pedido_sugerido: number;
  pedido_ajustado: number;
}

export interface EstoquePedidoSugerido {
  id_loja: number;
  periodo_dias: number;
  crescimento_pct: number;
  estoque_seguranca_dias: number;
  produtos_base: number;
  itens: EstoquePedidoItem[];
}

export interface EstoqueSyncFornecedor {
  id_sync: number;
  fornecedor: 'platlog' | 'coca' | string;
  id_loja: number;
  loja_nome?: string;
  loja_codigo?: string | null;
  ativo: boolean;
  horario: string;
  limite: number;
  ultimo_inicio?: string | null;
  ultimo_fim?: string | null;
  ultimo_status?: 'ok' | 'erro' | 'rodando' | 'parcial' | null;
  ultimo_resumo?: {
    baixadas?: number;
    aplicadas?: number;
    erros?: number;
    processadas?: unknown[];
  } | null;
  ultimo_erro?: string | null;
  ultima_execucao_dia?: string | null;
  atualizado_em?: string;
  credenciais_ok?: boolean;
}

export interface EstoqueMovimento {
  id_movimento: number;
  id_loja: number;
  id_produto: number;
  id_insumo?: number;
  codigo: string;
  descricao: string;
  tipo: string;
  quantidade: number;
  saldo_apos: number | null;
  referencia_tipo?: string | null;
  referencia_id?: number | null;
  observacao?: string | null;
  criado_por_nome?: string | null;
  criado_em: string;
  data_movimento?: string | null;
}

export interface ProdutoVendaEstoque {
  /** PK na tabela produtos (venda / BK). */
  id_produto?: number;
  /** Alias de transição (= id_produto). */
  id_produto_venda: number;
  id_loja?: number;
  codigo: string;
  descricao: string;
  ativo: boolean;
  /** false = unitário (não precisa de ficha técnica). */
  requer_ficha?: boolean;
  id_ficha?: number | null;
  ficha_ativa?: boolean | null;
  itens_ficha?: number;
  /** Preço unitário da última venda importada (venda_liquida / qtde). */
  valor_venda?: number | null;
  /** Soma quantidade × valor_unidade de cada insumo da ficha. */
  valor_insumos?: number | null;
  insumos_ficha?: Array<{
    codigo_insumo: string;
    quantidade: number | string;
    unidade_receita?: string;
    qtde_estoque?: number | string;
    valor_unidade?: number | string;
    custo_linha?: number | string;
  }>;
}

export interface FichaTecnicaResumo {
  id_ficha: number;
  id_produto?: number;
  id_produto_venda: number;
  codigo: string;
  descricao: string;
  ativo: boolean;
  observacao?: string | null;
  itens: number;
}

export interface FichaTecnicaDetalhe {
  id_ficha: number;
  id_produto?: number;
  id_produto_venda: number;
  codigo: string;
  descricao: string;
  observacao?: string | null;
  itens: Array<{
    id_item?: number;
    codigo_insumo: string;
    quantidade: number;
    unidade_receita?: string;
    qtde_estoque?: number;
    observacao?: string | null;
  }>;
}

export interface EstoqueVendaResumo {
  id_venda: number;
  id_loja: number;
  data_venda: string;
  origem: string;
  status: string;
  itens?: number;
  processados?: number;
  sem_ficha?: number;
  arquivo_nome?: string | null;
  criado_em?: string;
  processado_em?: string | null;
}

export interface EstoqueVendaDetalhe extends Omit<EstoqueVendaResumo, 'itens'> {
  itens: Array<{
    id_item: number;
    codigo: string;
    descricao: string;
    qtde: number;
    venda_liquida: number | null;
    processado: boolean;
    sem_ficha: boolean;
    erro?: string | null;
  }>;
}

export interface EstoqueVendaSemFicha {
  codigo: string;
  descricao: string;
  id_produto_venda?: number | null;
  ocorrencias?: number;
}

export interface EstoqueSyncStatus {
  configurado: boolean;
  job_rodando: boolean;
  ultimo: { id_job: number; status: string; mensagem: string; em: string } | null;
  server_sync?: boolean;
  /** servidor | manual_servidor | pc_gerencia */
  modo?: string;
  scheduler?: {
    ativo: boolean;
    intervalo_ms: number;
    id_loja: number | null;
    iniciado_em: string | null;
  };
  jobs: Array<{
    id_job: number;
    id_loja: number | null;
    data_inicio: string | null;
    data_fim: string | null;
    status: string;
    mensagem?: string | null;
    criado_em: string;
  }>;
}

export interface EstoqueSyncResult {
  id_job: number;
  arquivo: string;
  linhas: number;
  importResult: { dias: number; resultados: unknown[] };
}

export interface EstoqueBreakResumo {
  id_break: number;
  id_loja: number;
  data_break: string;
  tipo: string;
  motivo?: string | null;
  status: string;
  itens?: number;
  id_colaborador?: number | null;
  colaborador_nome?: string | null;
  criado_por_nome?: string | null;
  criado_em?: string;
}

export interface FrotaRegiaoVeiculo {
  id_veiculo: number;
  placa: string;
  marca: string | null;
  modelo: string | null;
  ano?: number | null;
  cor?: string | null;
  combustivel?: string | null;
  id_regiao?: number | null;
  nome_regiao?: string | null;
  nome_responsavel?: string | null;
  odometro_km?: number | null;
  combustivel_litros?: number | null;
  rastreamento_disponivel?: boolean;
  telemetria_atualizada_em?: string | null;
}

export interface FrotaRegiaoCatalogo {
  lojas: FrotaRegiaoLoja[];
  tecnicos: FrotaRegiaoUsuario[];
  regionais: FrotaRegiaoUsuario[];
  veiculos: FrotaRegiaoVeiculo[];
}

export interface FrotaRegiaoDetalhe {
  id_regiao: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  id_regional: number | null;
  nome_regional: string | null;
  email_regional?: string | null;
  cargo_regional?: string | null;
  regionais: FrotaRegiaoUsuario[];
  created_at: string;
  updated_at: string;
  lojas: FrotaRegiaoLoja[];
  tecnicos: FrotaRegiaoTecnico[];
  veiculos: FrotaRegiaoVeiculo[];
}

export type FrotaRegiaoBody = {
  nome?: string;
  descricao?: string;
  id_regional?: number | null;
  id_regionais?: number[];
  id_lojas?: number[];
  id_usuarios?: number[];
  tecnicos?: { id_usuario: number; gps_habilitado?: boolean }[];
  id_veiculos?: number[];
};

export type FrotaRegiaoCriada = {
  id_regiao: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  id_regional?: number | null;
  nome_regional?: string | null;
  created_at?: string;
  updated_at?: string;
};

export interface FrotaResumoMobile {
  veiculo: FrotaVeiculo | null;
  termo: { versao: string; assinado: boolean; assinado_em: string | null };
  abastecimentos: FrotaAbastecimentoResumo[];
}

export interface FrotaTermoInfo {
  versao: string;
  empresa: typeof import('../config/empresa').EMPRESA_TERMO;
  texto: string;
  assinado: boolean;
  assinado_em: string | null;
}

export interface AuditoriaEvento {
  created_at: string;
  modulo: string;
  modulo_label?: string;
  acao: string;
  acao_label?: string;
  tipo_acao?: 'acesso' | 'criacao' | 'alteracao' | 'exclusao' | 'upload' | 'operacao' | 'outro';
  entidade: string | null;
  id_referencia: string | null;
  descricao: string;
  usuario_nome: string | null;
  id_usuario: number | null;
  detalhes?: Record<string, unknown> | null;
}

export interface AuditoriaUsuarioFiltro {
  id_usuario: number;
  nome: string;
  email: string;
  ativo: boolean;
}

export interface FrotaDocumento {
  id_documento: number;
  id_veiculo: number;
  tipo: string;
  titulo: string;
  data_vencimento: string | null;
  valor: number | null;
  observacao: string | null;
  media_url: string | null;
  tipo_mime?: string | null;
  nome_arquivo?: string | null;
  created_at: string;
}

export interface HistoricoAprovacaoItem {
  tipo: string;
  texto?: string | null;
  autor?: string | null;
  quando: string;
}

export interface ManutChamado {
  id_chamado: number;
  numero: number;
  titulo: string;
  status: string;
  tipo_chamado?: 'normal' | 'orcamento';
  aprovacao_destino?: string | null;
  aprovacao_diretor_ok?: boolean;
  historico_aprovacao?: HistoricoAprovacaoItem[];
  urgencia: string;
  prazo_sla: string;
  aberto_em?: string;
  fechado_em?: string | null;
  id_loja: number;
  categoria: string;
  loja: string;
  id_tecnico?: number | null;
  tecnico?: string | null;
  total_fotos: number;
  notificacoes_nao_lidas?: number;
}

export interface ManutAnexo {
  id_anexo: number;
  tipo_mime: string;
  nome_arquivo: string;
  created_at: string;
  media_url: string;
}

export interface ManutAtualizacao {
  id_atualizacao: number;
  texto: string;
  created_at: string;
  autor?: string;
  notificacoes_enviadas?: number;
}

export interface ManutChamadoEvento {
  id_evento: number;
  tipo: 'fechamento' | 'reabertura' | string;
  status_ref?: string | null;
  texto?: string | null;
  created_at: string;
  autor?: string | null;
}

export interface ManutChamadoDetalhe extends ManutChamado {
  descricao: string;
  local_detalhe?: string | null;
  solicitante: string;
  tecnico?: string | null;
  id_solicitante?: number;
  id_tecnico?: number | null;
  assumido_em?: string | null;
  fechado_em?: string | null;
  anexos: ManutAnexo[];
  atualizacoes: ManutAtualizacao[];
  eventos?: ManutChamadoEvento[];
}

export type ContextoNotificacoesManut = 'chamados' | 'chamados-mobile' | 'aprovacoes';

export interface ManutNotificacao {
  id_notificacao: number;
  id_chamado: number;
  id_loja: number;
  numero: number;
  tipo: string;
  mensagem: string;
  loja?: string;
  lida: boolean;
  created_at: string;
}

export async function fetchMediaAutenticada(mediaPath: string): Promise<string> {
  const token = getToken();
  const res = await fetch(mediaPath, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Erro ao carregar mídia');
  return URL.createObjectURL(await res.blob());
}

export interface ManutCriarBody {
  titulo: string;
  descricao: string;
  id_categoria: number;
  id_loja: number;
  id_solicitante: number;
  local_detalhe?: string;
  urgencia?: string;
  tipo_chamado?: 'normal' | 'orcamento';
}

export interface NcItem {
  id_nc: number;
  id_visita: number | null;
  id_loja?: number;
  area: string;
  descricao: string;
  name: string;
  data_cadastro: string;
  data_visita?: string | null;
  nota_final?: string | number | null;
  gravidade: string;
  status: string;
  observacao_resolucao?: string | null;
  data_resolucao?: string | null;
  nome_resolvido_por?: string | null;
}

export interface NcAnexo {
  id_anexo: number;
  tipo_mime: string;
  media_url: string;
  created_at?: string;
}

export interface NcDetalhe extends NcItem {
  nome_loja?: string;
  anexos: NcAnexo[];
}

export interface NcResponse {
  items: NcItem[];
  stats: {
    total_aberto: string;
    criticas: string;
    visitas_pendentes?: string;
  };
}

export interface FreelancerTurnoAprovacao {
  checkin_id: number;
  employee_id: number;
  full_name: string;
  store_id: string | number;
  store_name: string;
  bk_number: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  hours?: number | null;
  session_type?: string | null;
  regional_approval_status: string;
  regional_approval_label?: string;
  regional_approved_by_name?: string | null;
  regional_approval_note?: string | null;
  selfie_photo?: string | null;
  checkout_pending?: boolean;
}

export interface FreelancersAprovacaoResponse {
  items: FreelancerTurnoAprovacao[];
  count: number;
  lojas: Array<{ id_loja: number; nome: string; bk_number: string }>;
  date_from?: string;
  date_to?: string;
  status?: string;
  aviso?: string;
}

export interface FreelancerColaborador {
  employee_id: number;
  full_name: string;
  store_id: string | number | null;
  store_name: string | null;
  bk_number: string | null;
  contract_type?: string | null;
  role_name?: string | null;
}

export interface FreelancersColaboradoresResponse {
  items: FreelancerColaborador[];
  count: number;
  lojas?: Array<{ id_loja: number; nome: string; bk_number: string }>;
}

export function fmtNota(n: string | number | null | undefined) {
  if (n == null) return '—';
  return `${Number(n).toFixed(0)}%`;
}

export function fmtData(d: string | null) {
  return formatDataCampoData(d);
}

export function scoreColor(n: number) {
  if (n >= 85) return '#3B6D11';
  if (n >= 75) return '#854F0B';
  return '#A32D2D';
}

/** Chip de nota com fundo sólido e alto contraste (tabelas e listas). */
export function notaChipSx(n: number) {
  const base = {
    fontWeight: 800,
    fontSize: '0.75rem',
    height: 26,
    minWidth: 54,
    color: '#FFFFFF',
    border: 'none',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.18)',
    '& .MuiChip-label': { px: 1.15, letterSpacing: 0.2 },
  };
  if (n >= 85) return { ...base, bgcolor: '#16A34A' };
  if (n >= 75) return { ...base, bgcolor: '#EAB308', color: '#422006', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.14)' };
  return { ...base, bgcolor: '#DC2626' };
}
