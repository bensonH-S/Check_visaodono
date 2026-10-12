import type { Despesa } from './api'

/** Tira [FREE]/FREE/TREIN do começo — o tipo já aparece no selo. */
export function limparPrefixoFreecontrol(texto: string) {
  return String(texto || '')
    .replace(/^\s*\[(?:FREE|TREIN|DESP|FREELANCE|TREINAMENTO|DESPESA)\]\s*/i, '')
    .replace(/^\s*(?:FREE|TREIN|DESP|FREELANCE|TREINAMENTO|DESPESA)\b[:\-\s]*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Nome que aparece na Agenda e no Inbox: fornecedor, descrição ou NF. */
export function rotuloDespesa(e: Pick<Despesa, 'fornecedor' | 'descricao' | 'numero_nf' | 'fonte'>) {
  const bruto = (e.fornecedor || e.descricao || '').trim()
  const nome = e.fonte === 'freecontrol' ? limparPrefixoFreecontrol(bruto) : bruto
  if (nome) return nome
  const nf = (e.numero_nf || '').trim()
  if (nf) return `NF ${nf}`
  return 'Boleto DDA'
}
