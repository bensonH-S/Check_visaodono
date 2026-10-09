export type Empresa = { id: string; apelido: string; razao_social: string; tipo: 'loja' | 'holding'; cnpj?: string | null; bk_number?: string | null }
export type Conta = { id: string; empresa_id: string; nome: string; tipo: string; apelido: string }
export type Plano = { id: string; nome: string }
export type PlanoCompleto = {
  id: string
  nome: string
  tipo: 'a_pagar' | 'a_receber'
  natureza: 'fixa' | 'variavel' | null
  codigo_obrigacao: string | null
  codigo_provisao: string | null
  ativo: boolean
  despesas: number
  fornecedores: number
}
export type FornecedorCompleto = Fornecedor & {
  razao_social: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  ativo: boolean
  uso: number
}
export type PaginaFornecedores = { total: number; com_plano: number; linhas: FornecedorCompleto[] }
export type EmpresaCompleta = {
  id: string
  apelido: string | null
  razao_social: string
  cnpj: string | null
  bk_number: string | null
  inscricao_estadual: string | null
  endereco: string | null
  cidade: string | null
  cep: string | null
  tipo: 'loja' | 'holding'
  ativo: boolean
  uso: number
}
export type ContaCompleta = {
  id: string
  empresa_id: string
  apelido: string
  nome: string | null
  tipo: 'corrente' | 'dinheiro'
  banco: 'itau' | 'banco_do_brasil' | null
  agencia: string | null
  numero: string | null
  digito: string | null
  ativa: boolean
  uso: number
}
export type TipoCadastro = 'fornecedores' | 'empresas' | 'contas'
export type Situacao = 'ativos' | 'inativos' | 'todos'
export type Remocao = { id: string; inativado?: boolean; apagado?: boolean }
export type Fornecedor = { id: string; nome: string; cpf_cnpj?: string | null; plano_conta_id: string | null; plano: string | null }
export type Despesa = {
  id: string
  descricao: string
  valor: number
  vencimento: string | null
  competencia: string | null
  forma_pagamento: string | null
  status: string
  documento_ref: string | null
  numero_nf: string | null
  nfe_id: string | null
  nf_confirmada: boolean
  origem_id: string
  origem: string
  origem_razao: string
  fornecedor_id: string | null
  fornecedor: string | null
  plano_conta_id: string | null
  plano: string | null
  conta_saida_id: string | null
  conta_nome: string | null
  conta_empresa_id: string | null
  pagamento: string | null
  /** dda = veio do DDA; nfe = nota da Receita; manual = lançado na tela */
  fonte: 'dda' | 'nfe' | 'manual' | null
  /** NF-e da Receita já ligada a este boleto */
  nfe_recebida_id?: string | null
  tem_nfe_receita?: boolean
  nfe_chave?: string | null
  nfe_tem_xml?: boolean
}

import { apiBasePath } from '../config/paths'
import { getToken } from '../lib/auth'

/** API do financeiro no próprio portal (`/api/financeiro/*`), schema `finance`. */
const apiRoot = `${apiBasePath}/financeiro`

function authHeaders(extra?: HeadersInit): HeadersInit {
  const headers = new Headers(extra)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

async function financeFetch(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: authHeaders(init.headers) })
}

async function get<T>(url: string): Promise<T> {
  const res = await financeFetch(url)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || data.erro || data.detalhe || 'Falha ao carregar')
  }
  return res.json()
}

export type NotaReceita = {
  id: string
  chave: string
  numero: string | null
  serie: string | null
  emissao: string | null
  emitente_cnpj: string | null
  emitente_nome: string | null
  valor_total: number | null
  situacao: 'autorizada' | 'cancelada' | 'denegada'
  tem_xml: boolean
  cnpj_empresa: string
  origem: string | null
  despesa_id: string | null
  agenda_vencimento: string | null
  /** Boleto DDA já ligado a esta nota */
  tem_dda?: boolean
  despesa_fonte?: 'dda' | 'nfe' | 'manual' | null
}

export type ColetaReceita = { ok: boolean; mensagem: string; novas: number; em: string | null }

export type LinhaDda = {
  cedente: string
  cnpj_cedente: string
  sacado: string
  cnpj_sacado: string
  vencimento: string
  valor: number | null
  codigo: string
  situacao: string
  documento: string
  documento_ref: string
  competencia: string
  empresa_id: string | null
  empresa: string
  fornecedor_id: string | null
  fornecedor: string
  plano_conta_id: string | null
  plano: string
  pronto: boolean
  motivo: string
}

export type Sessao = { versao: string; usuario: { nome: string; papel: string } }

export type LojaVenda = {
  bk_number: string
  restaurante: string | null
  linhas: number
  quantidade: number
  venda_bruta: number
  venda_liquida: number
}

export type AcessoBb = {
  empresa_id: string
  empresa: string
  razao_social: string
  cnpj: string | null
  cadastrada: boolean
  ambiente: 'homologacao' | 'producao'
  client_id: string
  app_key: string
  segredo_definido: boolean
  certificado_definido: boolean
  certificado_pasta?: boolean
  chave_definida: boolean
  ativo: boolean
  pronta: boolean
  ultima_coleta: string | null
  ultimo_ok: boolean | null
  ultima_mensagem: string | null
}

export type AcessoItau = {
  host: string
  porta: number
  usuario: string
  senha_definida: boolean
  chave_definida: boolean
  frase_definida: boolean
  produto: string
  pasta: string
  ativo: boolean
  pronta: boolean
  servidor: boolean
  ultima_coleta: string | null
  ultimo_ok: boolean | null
  ultima_mensagem: string
}

export type LancamentoCaixa = {
  id?: string
  tipo: 'despesa' | 'deposito'
  valor: number
  plano_conta_id: string | null
  fornecedor_id: string | null
  numero: string
  descricao: string
  plano?: string
  fornecedor?: string
  comprovante_nome?: string
  tem_comprovante?: boolean
  comprovante?: { nome: string; mime: string; base64: string }
  remover_comprovante?: boolean
  valor_texto?: string
}

export type FechamentoDia = {
  id: string | null
  empresa_id: string
  empresa: string
  bk_number: string | null
  data: string
  dinheiro: number
  pix: number
  debito: number
  credito: number
  cart_digital: number
  ifood: number
  azul: number
  rappi: number
  food99: number
  despesas_caixa: number
  depositos_caixa: number
  bandeiras?: Array<{ bandeira: string; tipo: string; valor: number }>
  lancamentos: LancamentoCaixa[]
  observacao: string
  status: 'rascunho' | 'conferido' | 'fechado'
  atualizado_em: string | null
}

export type MesFechamento = {
  empresa: { id: string; apelido: string; bk_number: string | null }
  mes: string
  dias: FechamentoDia[]
  totais: Record<string, number>
  resumo: {
    dias_com_movimento: number
    conferidos: number
    fechados: number
    dinheiro_pix: number
  }
  pdv?: { ok: boolean; ultimo_ok: string | null; ultimo_dia: string | null; atraso_horas: number | null; mensagem: string }
}

export type ConfigBkoffice = {
  usuario: string
  api: string
  setor: string
  senha_definida: boolean
}

export type ResumoVendas = {
  dia: string
  lojas: LojaVenda[]
  venda_bruta: number
  ultimo_sync: { mensagem: string; criado_em: string; ok: boolean } | null
}

export type ResumoFinanceiro = {
  a_pagar: number
  pago: number
  para_autorizar: number
  vencida: number
  qtd_abertas: number
  qtd_autorizar: number
  qtd_vencidas: number
  banco?: string
  schema?: string
}

export const api = {
  sistema: () => get<Sessao>(`${apiRoot}/sistema`),
  resumo: () => get<ResumoFinanceiro>(`${apiRoot}/resumo`),
  empresas: () => get<Empresa[]>(`${apiRoot}/empresas`),
  contas: () => get<Conta[]>(`${apiRoot}/contas`),
  plano: () => get<Plano[]>(`${apiRoot}/plano`),
  despesas: (empresa?: string) => get<Despesa[]>(`${apiRoot}/despesas${empresa ? `?empresa=${empresa}` : ''}`),
  abrirNota: async (id: string) => {
    const res = await financeFetch(`${apiRoot}/despesas/${id}/nota`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.erro || 'Não abriu a nota')
    }
    const url = URL.createObjectURL(await res.blob())
    window.open(url, '_blank', 'noopener')
  },
  abrirBoleto: async (id: string) => {
    const res = await financeFetch(`${apiRoot}/despesas/${id}/boleto`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.erro || 'Não abriu o boleto')
    }
    const url = URL.createObjectURL(await res.blob())
    window.open(url, '_blank', 'noopener')
  },
  fornecedores: (q: string) => get<Fornecedor[]>(`${apiRoot}/fornecedores?q=${encodeURIComponent(q)}`),
  listaFornecedores: (q: string, pagina: number, por: number, situacao: Situacao = 'ativos') =>
    get<PaginaFornecedores>(`${apiRoot}/fornecedores/lista?q=${encodeURIComponent(q)}&pagina=${pagina}&por=${por}&situacao=${situacao}`),
  empresasTodas: () => get<EmpresaCompleta[]>(`${apiRoot}/cadastros/empresas`),
  contasTodas: () => get<ContaCompleta[]>(`${apiRoot}/cadastros/contas`),
  salvarCadastro: async (tipo: TipoCadastro, id: string | null, body: Record<string, unknown>) => {
    const res = await financeFetch(`${apiRoot}/cadastros/${tipo}${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não salvou')
    return data as { id: string }
  },
  removerCadastro: async (tipo: TipoCadastro, id: string) => {
    const res = await financeFetch(`${apiRoot}/cadastros/${tipo}/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não excluiu')
    return data as Remocao
  },
  planosTodos: () => get<PlanoCompleto[]>(`${apiRoot}/plano/todos`),
  salvarPlano: async (id: string | null, body: Record<string, unknown>) => {
    const res = await financeFetch(`${apiRoot}/plano${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não salvou')
    return data as { id: string }
  },
  apagarPlano: async (id: string) => {
    const res = await financeFetch(`${apiRoot}/plano/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não apagou')
    return data as { id: string; inativado?: boolean; apagado?: boolean }
  },
  criarDespesa: async (body: Record<string, unknown>) => {
    const res = await financeFetch(`${apiRoot}/despesas`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não salvou')
    return data as { id: string; status: string }
  },
  excluirDespesa: async (id: string) => {
    const res = await financeFetch(`${apiRoot}/despesas/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não excluiu')
    return data as { id: string }
  },
  sfgDda: () => get<{ ok: boolean; mensagem: string; criadas: number; em: string | null }>(`${apiRoot}/dda/sfg`),
  bbDda: () => get<{ ok: boolean; mensagem: string; criadas: number; em: string | null }>(`${apiRoot}/dda/bb`),
  notasReceita: (empresa?: string) => {
    const q = empresa ? `?empresa=${encodeURIComponent(empresa)}` : ''
    return get<{ notas: NotaReceita[]; coleta: ColetaReceita }>(`${apiRoot}/nfe/recebidas${q}`)
  },
  coletarNotasReceita: async () => {
    const res = await financeFetch(`${apiRoot}/nfe/coletar`, { method: 'POST' })
    if (!res.ok) throw new Error('Não iniciou a consulta na Receita')
  },
  abrirDanfeNota: async (id: string) => {
    const res = await financeFetch(`${apiRoot}/nfe/recebidas/${id}/danfe`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.erro || 'Não abriu o DANFE')
    }
    const url = URL.createObjectURL(await res.blob())
    window.open(url, '_blank', 'noopener')
  },
  lancarNotaAgenda: async (id: string) => {
    const res = await financeFetch(`${apiRoot}/nfe/recebidas/${id}/agenda`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não lançou na agenda')
    return data as { id: string; vencimento: string | null; quantidade: number; ja_existia: boolean; vinculou_dda?: boolean }
  },
  previaDda: async (arquivo: string) => {
    const res = await financeFetch(`${apiRoot}/dda/previa`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ arquivo }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não leu a planilha')
    return data as { linhas: LinhaDda[] }
  },
  vendas: (dia: string) => get<ResumoVendas>(`${apiRoot}/vendas?dia=${encodeURIComponent(dia)}`),
  caixaMes: (mes: string, empresaId: string) =>
    get<MesFechamento>(`${apiRoot}/caixa?mes=${encodeURIComponent(mes)}&empresa=${encodeURIComponent(empresaId)}`),
  salvarCaixa: async (body: Record<string, unknown>) => {
    const res = await financeFetch(`${apiRoot}/caixa`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não salvou')
    return data as FechamentoDia
  },
  abrirComprovanteCaixa: async (id: string) => {
    const res = await financeFetch(`${apiRoot}/caixa/lancamentos/${id}/comprovante`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.erro || 'Não abriu o comprovante')
    }
    const url = URL.createObjectURL(await res.blob())
    window.open(url, '_blank', 'noopener')
  },
  configBkoffice: () => get<ConfigBkoffice>(`${apiRoot}/config/bkoffice`),
  salvarBkoffice: async (body: { usuario: string; senha: string; api: string; setor: string }) => {
    const res = await financeFetch(`${apiRoot}/config/bkoffice`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não salvou')
    return data as ConfigBkoffice
  },
  acessoItau: () => get<AcessoItau>(`${apiRoot}/config/itau`),
  salvarItau: async (body: Record<string, unknown>) => {
    const res = await financeFetch(`${apiRoot}/config/itau`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não salvou')
    return data as AcessoItau
  },
  coletarItau: async () => {
    const res = await financeFetch(`${apiRoot}/config/itau/coletar`, { method: 'POST' })
    if (!res.ok) throw new Error('Não iniciou a coleta')
  },
  acessosBb: () => get<AcessoBb[]>(`${apiRoot}/config/bb`),
  salvarAcessoBb: async (empresaId: string, body: Record<string, unknown>) => {
    const res = await financeFetch(`${apiRoot}/config/bb/${empresaId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não salvou')
    return data as AcessoBb
  },
  removerAcessoBb: async (empresaId: string) => {
    const res = await financeFetch(`${apiRoot}/config/bb/${empresaId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Não removeu')
  },
  coletarBb: async () => {
    const res = await financeFetch(`${apiRoot}/config/bb/coletar`, { method: 'POST' })
    if (!res.ok) throw new Error('Não iniciou a coleta')
  },
  importarDda: async (linhas: LinhaDda[]) => {
    const res = await financeFetch(`${apiRoot}/dda/importar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ linhas }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não importou')
    return data as { criadas: number; ignoradas: number }
  },
  atualizarDespesa: async (id: string, body: Record<string, unknown>) => {
    const res = await financeFetch(`${apiRoot}/despesas/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não salvou')
    return data as { id: string; status: string }
  },
  /** Manda os títulos marcados para a Agenda banco (status pronta). */
  entrarNaAgenda: async (ids: string[]) => {
    const res = await financeFetch(`${apiRoot}/despesas/agenda`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não enviou para a agenda')
    return data as {
      enviados: Array<{ id: string; status: string }>
      bloqueados: Array<{ id: string; motivo: string }>
    }
  },
}

export const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ehLabor(nome: string) {
  const n = nome.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase()
  return n.includes('TREINAMENTO') || n.includes('TEMPORARIA') || n.includes('FREE')
}
