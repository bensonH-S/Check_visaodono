import type { Empresa } from './api'

/** Ordem do seletor de loja na Agenda banco e no Inbox DDA. */
const ORDEM: string[][] = [
  ['REI'],
  ['LORD'],
  ['IMPERADOR'],
  ['PRINCIPE'],
  ['GLADIADOR'],
  ['DUQUE'],
  ['FELICA'],
  ['ARQUIDUQUE'],
  ['ESCUDEIRO'],
  ['CAVALEIRO'],
  ['VISCONDE'],
  ['SENHOR'],
  ['REGENTE'],
  ['BARAO'],
  ['ARQUEIRO'],
  ['CAPITAO'],
  ['IMPERATRIZ'],
  ['RAINHA'],
  ['CONDESSA'],
  ['POPVAL', 'POP VAL', 'POPOYES', 'POPEYES', 'POPOYES VAL'],
  ['DONZELA'],
  ['DAMA'],
  ['KING ASSESSORIA', 'KING'],
  ['SUPER KING'],
  ['ALVIM GESTAO'],
  ['ALVIM PARTICIPACOES'],
]

function normalizar(nome: string) {
  return nome.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

const CHAVES = ORDEM.flatMap((chaves, ordem) => chaves.map((chave) => ({ chave: normalizar(chave), ordem })))
  .sort((a, b) => b.chave.length - a.chave.length)

export function ordemNomeEmpresa(nome: string) {
  const n = normalizar(nome)
  if (!n) return ORDEM.length
  const achou = CHAVES.find((item) => n === item.chave || n.startsWith(`${item.chave} `))
  return achou ? achou.ordem : ORDEM.length
}

function ordemDe(empresa: Empresa) {
  const nomes = [empresa.apelido, empresa.razao_social].filter(Boolean).map((nome) => normalizar(String(nome)))
  for (const nome of nomes) {
    const ordem = ordemNomeEmpresa(nome)
    if (ordem < ORDEM.length) return ordem
  }
  return ORDEM.length
}

export function ordenarEmpresas(lista: Empresa[]) {
  return [...lista].sort((a, b) => {
    const diff = ordemDe(a) - ordemDe(b)
    if (diff) return diff
    return normalizar(a.apelido || a.razao_social || '').localeCompare(normalizar(b.apelido || b.razao_social || ''), 'pt-BR')
  })
}

type LancamentoEmpresa = {
  origem_id?: string | null
  origem?: string | null
  vencimento?: string | null
  descricao?: string | null
}

/** Agenda/Inbox: mesma ordem do filtro de loja; no mesmo estabelecimento, por vencimento. */
export function ordenarLancamentosPorEmpresa<T extends LancamentoEmpresa>(lista: T[], empresas: Empresa[]) {
  const ordenadas = ordenarEmpresas(empresas)
  const posicao = new Map(ordenadas.map((e, i) => [e.id, i]))
  const depois = ordenadas.length
  return [...lista].sort((a, b) => {
    const ia = a.origem_id && posicao.has(a.origem_id)
      ? posicao.get(a.origem_id)!
      : depois + ordemNomeEmpresa(a.origem || '')
    const ib = b.origem_id && posicao.has(b.origem_id)
      ? posicao.get(b.origem_id)!
      : depois + ordemNomeEmpresa(b.origem || '')
    if (ia !== ib) return ia - ib
    const va = (a.vencimento || '').slice(0, 10)
    const vb = (b.vencimento || '').slice(0, 10)
    if (va !== vb) return va.localeCompare(vb)
    return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR')
  })
}
