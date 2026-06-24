import { apiBasePath, appBasePath } from '../config/paths';
import { getToken } from '../lib/auth';
import type { UsuarioSessao } from '../lib/auth';
import { formatDataCampoData } from '../utils/dateBr';

const BASE = apiBasePath;

export type AppPublicConfig = {
  version: string;
  environment: string;
  support: {
    name: string;
    phone: string;
    email: string;
  };
  pushEnabled?: boolean;
  gpsTecnicosEnabled?: boolean;
  gpsTecnicosIntervalMs?: number;
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
  permissoesCatalogo: () => request<PermissaoCatalogo[]>('/usuarios/permissoes/catalogo'),
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

  auditoriaEventos: (params?: { limite?: number; offset?: number; modulo?: string }) => {
    const q = new URLSearchParams();
    if (params?.limite != null) q.set('limite', String(params.limite));
    if (params?.offset != null) q.set('offset', String(params.offset));
    if (params?.modulo) q.set('modulo', params.modulo);
    const s = q.toString();
    return request<AuditoriaEvento[]>(`/auditoria/eventos${s ? `?${s}` : ''}`);
  },

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
  visitas: (params?: { loja?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.loja) q.set('loja', String(params.loja));
    if (params?.status) q.set('status', params.status);
    const s = q.toString();
    return request<VisitaResumo[]>(`/visitas${s ? `?${s}` : ''}`);
  },
  visita: (id: number) => request<VisitaDetalhe>(`/visitas/${id}`),
  criarVisita: (body: {
    id_loja: number;
    id_usuario: number;
    data_visita?: string;
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
  naoConformidades: () => request<NcResponse>('/nao-conformidades'),

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
  manutEnviarFotos: async (idChamado: number, formData: FormData) => {
    const token = getToken();
    const res = await fetch(`${BASE}/manutencao/chamados/${idChamado}/fotos`, {
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
  frotaVeiculos: () => request<FrotaVeiculo[]>('/frota/veiculos'),
  frotaAssuncoes: () => request<FrotaAssuncao[]>('/frota/assuncoes'),
  frotaAbastecimentosPortal: () => request<FrotaAbastecimentoPortal[]>('/frota/abastecimentos'),
  frotaManutencoesPortal: () => request<FrotaManutencaoPortal[]>('/frota/manutencoes'),
  frotaTermosPortal: () => request<FrotaTermoPortalResumo[]>('/frota/termos'),
  frotaTermoPortal: (idTermo: number) => request<FrotaTermoPortalDetalhe>(`/frota/termos/${idTermo}`),
  frotaRegioes: () => request<FrotaRegiaoResumo[]>('/frota/regioes'),
  frotaRegiaoCatalogo: () => request<FrotaRegiaoCatalogo>('/frota/regioes/catalogo'),
  frotaRegiao: (idRegiao: number) => request<FrotaRegiaoDetalhe>(`/frota/regioes/${idRegiao}`),
  frotaRegiaoPosicoes: (idRegiao: number) =>
    request<FrotaTecnicoPosicao[]>(`/frota/regioes/${idRegiao}/posicoes`),
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
  frotaDesassumirVeiculo: () =>
    request<{ ok: boolean; veiculo: null }>('/frota/me/desassumir', { method: 'POST' }),
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
}

export interface CargoInput {
  nome: string;
  descricao?: string | null;
  aprovador?: boolean;
  ativo?: boolean;
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
}

export interface VisitaResumo {
  id_visita: number;
  id_loja: number;
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
  km_atual: number | null;
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

export interface FrotaAssuncao {
  id_assuncao: number;
  id_veiculo: number;
  id_usuario: number;
  placa: string;
  nome_usuario: string;
  km_inicio: number | null;
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
  km: number | null;
  valor: number | null;
  data_manutencao: string;
  proxima_manutencao: string | null;
  created_at: string;
}

export interface FrotaTermoPortalResumo {
  id_termo: number;
  id_usuario: number;
  nome_usuario: string;
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
  city: string;
  state: string;
}

export interface FrotaRegiaoResumo {
  id_regiao: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  id_regional?: number | null;
  nome_regional?: string | null;
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
  id_lojas?: number[];
  id_usuarios?: number[];
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
  acao: string;
  entidade: string | null;
  id_referencia: string | null;
  descricao: string;
  usuario_nome: string | null;
  id_usuario: number | null;
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

export interface NcResponse {
  items: Array<{
    id_nc: number;
    area: string;
    descricao: string;
    name: string;
    data_cadastro: string;
    gravidade: string;
    status: string;
  }>;
  stats: { total_aberto: string; criticas: string };
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
