export type Empresa = { id: string; apelido: string; razao_social: string; tipo: 'loja' | 'holding'; cnpj?: string | null; bk_number?: string | null }
export type Conta = { id: string; empresa_id: string; nome: string; tipo: string; apelido: string }
export type ConciliacaoDiaResumo = {
  data: string
  total_extrato: number
  pendente_extrato: number
  qtd_extrato: number
  total_sistema: number
  pendente_sistema: number
  qtd_sistema: number
  ok: boolean
}
export type ContaExtrato = { id: string; rotulo: string; apelido: string }
export class ContaNaoIdentificada extends Error {
  contas: ContaExtrato[]
  constructor(mensagem: string, contas: ContaExtrato[]) {
    super(mensagem || 'Não identifiquei a conta do extrato.')
    this.contas = contas
  }
}
export type ConciliacaoSemana = {
  de: string
  ate: string
  contas: ContaExtrato[]
  dias: ConciliacaoDiaResumo[]
}
export type ConciliacaoLancamento = {
  id: string
  empresa_id: string
  loja: string
  conta_nome: string | null
  banco: string | null
  operacao: string
  estorno?: boolean
  valor: number
  data_contabil: string
  historico: string | null
  documento_ref: string | null
  status: string
  despesa_id: string | null
  sugerido_despesa_id: string | null
  despesa_descricao?: string | null
}
export type ConciliacaoContaPeriodo = {
  id: string
  empresa_id: string
  apelido: string
  nome: string | null
  banco: string | null
  agencia: string | null
  numero: string | null
  digito: string | null
}
export type ConciliacaoResumo = {
  entradas: number
  saidas: number
  liquido: number
  qtd: number
  conciliados: number
  em_aberto: number
  valor_aberto: number
  sem_extrato: number
  valor_sem_extrato: number
}
export type ConciliacaoResumoLoja = {
  tem_extrato: boolean
  debitos: number
  conciliados: number
  abertos_banco: number
  abertos_sistema: number
  valor_banco: number
  valor_sistema: number
  bate: boolean
}
export type ConciliacaoLoja = {
  empresa_id: string
  apelido: string
  resumo: ConciliacaoResumoLoja
  extrato: ConciliacaoLancamento[]
  sistema: ConciliacaoDespesa[]
}
export type ConciliacaoPainel = {
  de: string
  ate: string
  lojas: ConciliacaoLoja[]
}
export type ConciliacaoPeriodo = {
  conta_id: string | null
  de: string
  ate: string
  contas: ConciliacaoContaPeriodo[]
  resumo: ConciliacaoResumo
  extrato: ConciliacaoLancamento[]
  sistema: ConciliacaoDespesa[]
}
export type ConciliacaoDespesa = {
  id: string
  descricao: string
  valor: number
  vencimento: string | null
  status: string
  documento_ref: string | null
  numero_nf: string | null
  forma_pagamento: string | null
  loja: string
}
export type ConciliacaoDia = {
  data: string
  extrato: ConciliacaoLancamento[]
  sistema: ConciliacaoDespesa[]
  sugestoes: Array<{ lancamento_id: string; despesa_id: string }>
}
export type ConciliacaoListaItem = {
  tipo: 'conciliado' | 'sem_par' | 'banco' | 'agenda'
  id: string
  data: string
  valor: number
  banco: string | null
  agenda: string | null
  status: string
  loja?: string | null
}
export type ConciliacaoLista = {
  de: string
  ate: string
  empresa_id: string | null
  resumo: {
    conciliados: number
    sem_par: number
    abertos_banco: number
    abertos_agenda: number
  }
  conciliados: ConciliacaoListaItem[]
  abertos: ConciliacaoListaItem[]
}
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
  valor_face?: number | null
  multa?: number
  juros?: number
  outras_taxas?: number
  desconto?: number
  modo_acrescimo?: 'total' | 'taxas' | null
  vencimento: string | null
  vencimento_original?: string | null
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
  fonte: 'dda' | 'nfe' | 'manual' | 'freecontrol' | null
  freecontrol_tipo?: 'freelance' | 'treinamento' | 'despesa' | null
  /** NF-e da Receita já ligada a este boleto */
  nfe_recebida_id?: string | null
  tem_nfe_receita?: boolean
  nfe_chave?: string | null
  nfe_tem_xml?: boolean
  /** true = criada na tela e ainda não confirmada no Inbox */
  pendente_inbox?: boolean
}

const STATUS_INBOX = new Set(['rascunho', 'classificada', 'bloqueada_duplicata'])

/** Título que ainda espera confirmação no Inbox (DDA ou despesa manual nova). */
export function estaNoInbox(e: Pick<Despesa, 'fonte' | 'status' | 'pendente_inbox'>) {
  /** Paga/conciliada nunca voltam ao Inbox — só em Conciliadas. */
  if (e.status === 'paga' || e.status === 'conciliada' || e.status === 'cancelada') return false
  if (!STATUS_INBOX.has(e.status)) return false
  if (e.fonte === 'dda') return true
  if (e.fonte === 'manual') return e.pendente_inbox === true
  return false
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

const memoria = new Map<string, unknown>()
const emVoo = new Map<string, Promise<unknown>>()

/** Última leitura bem-sucedida, para a aba abrir já com dados enquanto atualiza. */
export function emCache<T>(url: string): T | undefined {
  return memoria.has(url) ? (memoria.get(url) as T) : undefined
}

export function leituraPedida(url: string) {
  return memoria.has(url) || emVoo.has(url)
}

export function urlEmpresas() {
  return `${apiRoot}/empresas`
}

export function urlDespesas(empresa?: string) {
  return `${apiRoot}/despesas${empresa ? `?empresa=${empresa}` : ''}`
}

export function urlNotas(empresa?: string) {
  const q = empresa ? `?empresa=${encodeURIComponent(empresa)}` : ''
  return `${apiRoot}/nfe/recebidas${q}`
}

export function urlCaixa(mes: string, empresaId: string) {
  return `${apiRoot}/caixa?mes=${encodeURIComponent(mes)}&empresa=${encodeURIComponent(empresaId)}`
}

const CAIXA_LOJA = 'mf-caixa-loja'

export function lojaCaixaSalva() {
  try {
    return localStorage.getItem(CAIXA_LOJA) || ''
  } catch {
    return ''
  }
}

export function salvarLojaCaixa(id: string) {
  try {
    if (id) localStorage.setItem(CAIXA_LOJA, id)
  } catch {
    /* storage bloqueado */
  }
}

export function mesCaixaAtual() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date()).slice(0, 7)
}

async function get<T>(url: string): Promise<T> {
  const voo = emVoo.get(url)
  if (voo) return voo as Promise<T>
  const promessa = (async () => {
    const res = await financeFetch(url)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || data.erro || data.detalhe || 'Falha ao carregar')
    }
    const data = await res.json() as T
    memoria.set(url, data)
    return data
  })()
  emVoo.set(url, promessa)
  promessa.finally(() => {
    if (emVoo.get(url) === promessa) emVoo.delete(url)
  })
  return promessa
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

export type CredencialExtratoItau = {
  id: string
  nome: string
  empresa_id: string | null
  empresa: string | null
  cnpj: string | null
  ambiente: 'homologacao' | 'producao'
  client_id: string
  segredo_definido: boolean
  certificado_definido: boolean
  chave_definida: boolean
  ativo: boolean
  pronta: boolean
  ultima_coleta: string | null
  ultimo_ok: boolean | null
  ultima_mensagem: string | null
}

export type LancamentoExtratoItau = {
  id: string
  statement_id: string
  operacao: string | null
  estorno: boolean
  data_contabil: string | null
  literal: string | null
  valor: number
  contraparte_nome: string | null
  origem_tipo: string | null
  despesa_id: string | null
  despesa: string | null
  agencia: string
  numero: string
  digito: string | null
  empresa: string
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
  empresas: () => get<Empresa[]>(urlEmpresas()),
  contas: () => get<Conta[]>(`${apiRoot}/contas`),
  plano: () => get<Plano[]>(`${apiRoot}/plano`),
  conciliacaoPainel: (de: string, ate: string) =>
    get<ConciliacaoPainel>(`${apiRoot}/conciliacao/painel?${new URLSearchParams({ de, ate })}`),
  conciliacaoPeriodo: (conta: string, de: string, ate: string) =>
    get<ConciliacaoPeriodo>(`${apiRoot}/conciliacao/periodo?${new URLSearchParams({ conta, de, ate })}`),
  conciliacaoSemana: (empresa: string, de: string, ate: string) =>
    get<ConciliacaoSemana>(`${apiRoot}/conciliacao/semana?${new URLSearchParams({ empresa, de, ate })}`),
  conciliacaoDia: (empresa: string, data: string) =>
    get<ConciliacaoDia>(`${apiRoot}/conciliacao/dia?${new URLSearchParams({ empresa, data })}`),
  conciliacaoLista: (empresa: string, de: string, ate: string) =>
    get<ConciliacaoLista>(`${apiRoot}/conciliacao/lista?${new URLSearchParams({ empresa, de, ate })}`),
  uploadExtrato: async (nome: string, base64: string, contaId?: string, empresaId?: string) => {
    const res = await financeFetch(`${apiRoot}/conciliacao/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conta_id: contaId || null,
        empresa_id: empresaId || null,
        nome,
        base64,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const falha = data as { erro?: string; codigo?: string; contas?: ContaExtrato[] }
      if (falha.codigo === 'conta_nao_identificada') throw new ContaNaoIdentificada(falha.erro || '', falha.contas || [])
      throw new Error(falha.erro || 'Não importou o extrato')
    }
    return data as {
      arquivo_id: string
      criadas: number
      repetidas: number
      de: string
      ate: string
      ja_importado?: boolean
      conta: string
      conta_id?: string
      empresa_id: string
      conciliadas?: number
    }
  },
  confirmarConciliacao: async (lancamentoId: string, despesaId: string) => {
    const res = await financeFetch(`${apiRoot}/conciliacao/confirmar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lancamento_id: lancamentoId, despesa_id: despesaId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { erro?: string }).erro || 'Não conciliou')
    return data
  },
  desfazerConciliacao: async (lancamentoId: string) => {
    const res = await financeFetch(`${apiRoot}/conciliacao/desfazer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lancamento_id: lancamentoId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { erro?: string }).erro || 'Não desfez')
    return data
  },
  marcarSemPar: async (lancamentoId: string) => {
    const res = await financeFetch(`${apiRoot}/conciliacao/sem-par`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lancamento_id: lancamentoId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { erro?: string }).erro || 'Não marcou')
    return data
  },
  despesas: (empresa?: string) => get<Despesa[]>(urlDespesas(empresa)),
  baixarPlanilhaBanco: async (de: string, ate: string, empresa?: string) => {
    const q = new URLSearchParams({ de, ate })
    if (empresa) q.set('empresa', empresa)
    const res = await financeFetch(`${apiRoot}/despesas/planilha-banco?${q}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { erro?: string }).erro || 'Não gerou a planilha')
    }
    const disposto = res.headers.get('content-disposition') || ''
    const nome = /filename="([^"]+)"/.exec(disposto)?.[1] || `BANCO ${de} A ${ate}.xlsx`
    const url = URL.createObjectURL(await res.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = nome
    link.click()
    URL.revokeObjectURL(url)
  },
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
  sfgDda: () =>
    get<{
      ok: boolean
      mensagem: string
      criadas: number
      em: string | null
      codigo?: string
      arquivos?: number
    }>(`${apiRoot}/dda/sfg`),
  bbDda: () =>
    get<{
      ok: boolean
      mensagem: string
      criadas: number
      em: string | null
      codigo?: string
      empresas?: number
      falhas?: number
    }>(`${apiRoot}/dda/bb`),
  notasReceita: (empresa?: string) =>
    get<{ notas: NotaReceita[]; coleta: ColetaReceita }>(urlNotas(empresa)),
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
  /** Canais do caixa no período (Pix, débito, crédito, iFood, 99…). */
  caixaCanais: (de: string, ate: string, empresa?: string) => {
    const q = new URLSearchParams({ de, ate })
    if (empresa) q.set('empresa', empresa)
    return get<{
      de: string
      ate: string
      total: number
      canais: Array<{ id: string; rotulo: string; valor: number }>
      serie?: Array<{ dia: string; cartoes: number; digitais: number; dinheiro: number; ifood: number; food99: number }>
    }>(`${apiRoot}/caixa/canais?${q}`)
  },
  caixaMes: (mes: string, empresaId: string) =>
    get<MesFechamento>(urlCaixa(mes, empresaId)),
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
  credenciaisExtratoItau: () => get<CredencialExtratoItau[]>(`${apiRoot}/config/itau-extrato`),
  salvarCredencialExtratoItau: async (body: Record<string, unknown>) => {
    const id = typeof body.id === 'string' ? body.id : ''
    const res = await financeFetch(id ? `${apiRoot}/config/itau-extrato/${id}` : `${apiRoot}/config/itau-extrato`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não salvou')
    return data as CredencialExtratoItau
  },
  removerCredencialExtratoItau: async (id: string) => {
    const res = await financeFetch(`${apiRoot}/config/itau-extrato/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Não removeu')
  },
  lancamentosExtratoItau: () => get<{ lancamentos: LancamentoExtratoItau[]; coleta: { mensagem?: string; ok?: boolean } }>(`${apiRoot}/itau/extrato`),
  coletarExtratoItau: async () => {
    const res = await financeFetch(`${apiRoot}/itau/extrato/coletar`, { method: 'POST' })
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
  importarDda: async (linhas: LinhaDda[], opts?: { paraAgenda?: boolean }) => {
    const res = await financeFetch(`${apiRoot}/dda/importar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ linhas, para_agenda: opts?.paraAgenda === true }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Não importou')
    return data as { criadas: number; ignoradas: number; ids?: string[] }
  },
  /** Prévia: lê PDF/DDA/XML sem gravar. */
  previaImportarArquivos: async (arquivos: Array<{ nome: string; base64: string }>) => {
    const res = await financeFetch(`${apiRoot}/despesas/importar-arquivos/previa`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ arquivos }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || data.error || 'Não leu os arquivos')
    return data as {
      resultados: Array<{
        nome: string
        ok: boolean
        tipo?: string
        descricao?: string | null
        valor?: number | null
        vencimento?: string | null
        empresa?: string | null
        forma_pagamento?: string | null
        cnpj?: string | null
        erro?: string | null
        ja_existia?: boolean
        prontas?: number
        linhas?: number
      }>
    }
  },
  /** PDF (GFD/DARF/TRCT/férias), DDA e XML de NF-e → cria despesas na Agenda banco. */
  importarArquivosAgenda: async (arquivos: Array<{ nome: string; base64: string }>) => {
    const res = await financeFetch(`${apiRoot}/despesas/importar-arquivos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ arquivos, para_agenda: true }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || data.error || 'Não importou os arquivos')
    return data as {
      criadas: number
      resultados: Array<{
        nome: string
        ok: boolean
        tipo?: string
        criadas?: number
        ignoradas?: number
        erro?: string
        ja_existia?: boolean
        descricao?: string
        empresa?: string
      }>
    }
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

/** Face diferente do total: a despesa foi lançada com juros ou taxas. */
export function linhaAcrescimo(e: Pick<Despesa, 'valor' | 'valor_face' | 'juros'>) {
  const face = Number(e.valor_face)
  const total = Number(e.valor)
  if (!Number.isFinite(face) || Math.abs(face - total) < 0.009) return ''
  const juros = Number(e.juros) || 0
  if (juros > 0) return `de ${brl(face)} · juros ${brl(juros)}`
  return `de ${brl(face)}`
}

export function ehLabor(nome: string) {
  const n = nome.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase()
  return n.includes('TREINAMENTO') || n.includes('TEMPORARIA') || n.includes('FREE')
}
