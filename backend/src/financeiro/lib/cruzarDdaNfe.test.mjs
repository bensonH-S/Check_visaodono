import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cruzarDdaComNotas, escolherDdaParaNota, pontuarDdaComNota } from './cruzarDdaNfe.mjs'

describe('cruzar DDA com NF-e', () => {
  const nota = {
    id: 'n1',
    empresa_id: 'e1',
    cnpj_empresa: '26075154000136',
    numero: '17938561',
    emitente_cnpj: '01701201000189',
    emissao: '2026-10-09',
    valor_total: 1296.5,
  }

  it('casa quando CNPJ, número da NF, valor e vencimento batem', () => {
    const dda = {
      id: 'd1',
      empresa_origem_id: 'e1',
      cnpj_empresa: '26075154000136',
      cnpj_cedente: '01701201000189',
      numero_nf: '17938561',
      valor: 1296.5,
      vencimento: '2026-10-12',
    }
    assert.ok(pontuarDdaComNota(nota, dda) >= 80)
    assert.equal(escolherDdaParaNota(nota, [dda])?.id, 'd1')
  })

  it('casa por valor e vencimento perto sem número no boleto', () => {
    const dda = {
      id: 'd2',
      empresa_origem_id: 'e1',
      cnpj_empresa: '26075154000136',
      cnpj_cedente: '01701201000189',
      numero_nf: null,
      valor: 1296.5,
      vencimento: '2026-10-10',
    }
    assert.ok(pontuarDdaComNota(nota, dda) >= 80)
  })

  it('não casa fornecedor diferente', () => {
    const dda = {
      id: 'd3',
      empresa_origem_id: 'e1',
      cnpj_empresa: '26075154000136',
      cnpj_cedente: '11222333000144',
      numero_nf: '17938561',
      valor: 1296.5,
      vencimento: '2026-10-12',
    }
    assert.equal(pontuarDdaComNota(nota, dda), 0)
  })

  it('não une quando dois DDAs empatam', () => {
    const a = {
      id: 'a',
      empresa_origem_id: 'e1',
      cnpj_empresa: '26075154000136',
      cnpj_cedente: '01701201000189',
      numero_nf: null,
      valor: 1296.5,
      vencimento: '2026-10-10',
    }
    const b = { ...a, id: 'b' }
    assert.equal(escolherDdaParaNota(nota, [a, b]), null)
  })

  it('cruza listas sem reusar o mesmo boleto', () => {
    const pares = cruzarDdaComNotas(
      [{
        id: 'd1',
        empresa_origem_id: 'e1',
        cnpj_empresa: '26075154000136',
        cnpj_cedente: '01701201000189',
        numero_nf: '17938561',
        valor: 1296.5,
        vencimento: '2026-10-12',
      }],
      [nota, { ...nota, id: 'n2', numero: '999' }],
    )
    assert.equal(pares.length, 1)
    assert.equal(pares[0].nfe_recebida_id, 'n1')
  })
})
