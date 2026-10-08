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

function ordemDe(empresa: Empresa) {
  const nomes = [empresa.apelido, empresa.razao_social].filter(Boolean).map((nome) => normalizar(String(nome)))
  for (const nome of nomes) {
    const achou = CHAVES.find((item) => nome === item.chave || nome.startsWith(`${item.chave} `))
    if (achou) return achou.ordem
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
