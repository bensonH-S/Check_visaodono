import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classificarPdfDespesa } from './importarPdfDespesa.mjs'

describe('parcelamento simplificado', () => {
  it('lê valor, vencimento e número quando o rótulo vem antes', () => {
    const parsed = classificarPdfDespesa(`
      PARCELAMENTO SIMPLIFICADO
      Número do Parcelamento
      0211.00012.0112395491.25-35
      Razão Social
      POP VAL ALIMENTOS LTDA
      CNPJ
      52.193.038/0001-10
      Data de Vencimento
      30/10/2026
      Valor Total
      1.234,56
    `, 'PARCELAMENTO SIMPLIFICADO Nº 0211.00012.0112395491.25-35 - POP VAL.pdf')
    assert.equal(parsed.tipo, 'parcelamento')
    assert.equal(parsed.valor, 1234.56)
    assert.equal(parsed.vencimento, '2026-10-30')
    assert.equal(parsed.cnpj, '52193038000110')
    assert.match(parsed.documento_ref, /^PARC\|0211\.00012\.0112395491\.25-35\|2026-10-30$/)
    assert.match(parsed.descricao, /0211\.00012\.0112395491\.25-35/)
  })

  it('lê valor colado antes do rótulo e a loja no nome do arquivo', () => {
    const parsed = classificarPdfDespesa(`
      PROCURADORIA-GERAL DA FAZENDA NACIONAL
      PARCELAMENTO SIMPLIFICADO
      30/10/2026
      Data de Vencimento
      890,40
      Valor da Parcela
    `, 'PARCELAMENTO SIMPLIFICADO Nº 0211.00012.0104654466.24-73 - BARAO ALVIM.pdf')
    assert.equal(parsed.tipo, 'parcelamento')
    assert.equal(parsed.valor, 890.4)
    assert.equal(parsed.vencimento, '2026-10-30')
    assert.equal(parsed.razao_social, 'BARAO ALVIM')
    assert.match(parsed.documento_ref, /0104654466\.24-73/)
  })

  it('não confunde um GFD com parcelamento', () => {
    const parsed = classificarPdfDespesa(`
      GFD - Guia do FGTS Digital
      Valor a recolher 100,00
      Pagar este documento até 20/10/2026
      Identificador 123
      Nome/Razão Social do Empregador
      REGENTE ALVIM
      CPF/CNPJ do Empregador
      35.238.002/0001-06
    `)
    assert.equal(parsed.tipo, 'gfd')
  })
})
