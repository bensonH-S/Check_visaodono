import type { Despesa } from './api'

/** Nome que aparece na Agenda e no Inbox: fornecedor, descrição ou NF. */
export function rotuloDespesa(e: Pick<Despesa, 'fornecedor' | 'descricao' | 'numero_nf'>) {
  const nome = (e.fornecedor || e.descricao || '').trim()
  if (nome) return nome
  const nf = (e.numero_nf || '').trim()
  if (nf) return `NF ${nf}`
  return 'Boleto DDA'
}
