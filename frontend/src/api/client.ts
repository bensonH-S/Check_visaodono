import { apiBasePath, appBasePath } from '../config/paths';
import { getToken } from '../lib/auth';
import type { UsuarioSessao } from '../lib/auth';

const BASE = apiBasePath;

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request<T>(path: string, options?: RequestInit, tentativa = 0): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: authHeaders(options?.headers),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const msg = err.error || 'Erro na requisição';
      if (res.status === 401 && typeof window !== 'undefined') {
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
  login: (email: string, senha: string) =>
    request<{ accessToken: string; usuario: UsuarioSessao }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    }),
  me: () => request<UsuarioSessao>('/auth/me'),

  dashboard: () => request<DashboardData>('/dashboard'),
  ranking: () => request<RankingLoja[]>('/dashboard/ranking'),
  lojas: (params?: { ativas?: boolean; operacionais?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.ativas) q.set('ativas', '1');
    if (params?.operacionais) q.set('operacionais', '1');
    const s = q.toString();
    return request<Loja[]>(`/lojas${s ? `?${s}` : ''}`);
  },
  usuarios: () => request<Usuario[]>('/usuarios'),
  permissoesCatalogo: () => request<PermissaoCatalogo[]>('/usuarios/permissoes/catalogo'),
  usuariosGestao: () => request<UsuarioGestao[]>('/usuarios/gestao'),
  usuarioGestaoCriar: (body: UsuarioGestaoInput) =>
    request<UsuarioGestao>('/usuarios/gestao', { method: 'POST', body: JSON.stringify(body) }),
  usuarioGestaoAtualizar: (id: number, body: Partial<UsuarioGestaoInput>) =>
    request<UsuarioGestao>(`/usuarios/gestao/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  checklist: () => request<CategoriaChecklist[]>('/checklist'),
  visitas: (params?: { loja?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.loja) q.set('loja', String(params.loja));
    if (params?.status) q.set('status', params.status);
    const s = q.toString();
    return request<VisitaResumo[]>(`/visitas${s ? `?${s}` : ''}`);
  },
  visita: (id: number) => request<VisitaDetalhe>(`/visitas/${id}`),
  criarVisita: (body: { id_loja: number; id_usuario: number }) =>
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

  manutFormulario: () => request<ManutFormulario>('/manutencao/formulario'),
  manutChamados: () => request<ManutChamado[]>('/manutencao/chamados'),
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
}

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
  avatar_inicial?: string;
  perfil: string;
  lojas: LojaResumo[];
  lojas_ids: number[];
  permissoes: string[];
  ativo: boolean;
  acesso_todas_lojas?: boolean;
}

export interface UsuarioGestaoInput {
  nome: string;
  email: string;
  senha?: string;
  perfil: string;
  lojas_ids?: number[];
  permissoes?: string[];
  ativo?: boolean;
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

export interface VisitaResumo {
  id_visita: number;
  id_loja: number;
  name: string;
  bk_number: string | null;
  nome_usuario: string;
  data_visita: string;
  duracao_minutos: number | null;
  nota_final: string | number | null;
  status: string;
  nc_abertas?: number;
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
    resposta: string;
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

export interface ManutCategoria {
  id_categoria: number;
  nome: string;
  sla_horas: number;
  urgencia_padrao: string;
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

export interface ManutChamado {
  id_chamado: number;
  numero: number;
  titulo: string;
  status: string;
  urgencia: string;
  prazo_sla: string;
  categoria: string;
  loja: string;
  total_fotos: number;
}

export interface ManutCriarBody {
  titulo: string;
  descricao: string;
  id_categoria: number;
  id_loja: number;
  id_solicitante: number;
  local_detalhe?: string;
  urgencia?: string;
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
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

export function scoreColor(n: number) {
  if (n >= 85) return '#3B6D11';
  if (n >= 75) return '#854F0B';
  return '#A32D2D';
}
