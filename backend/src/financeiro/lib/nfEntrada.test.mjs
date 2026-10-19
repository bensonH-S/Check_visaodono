import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chaveNota, cruzarNotas } from './nfEntrada.mjs'

describe('nfEntrada', () => {
  it('chaveNota normaliza sufixo e zeros', () => {
    assert.equal(chaveNota('012596-02'), '12596')
    assert.equal(chaveNota('0007075'), '7075')
    assert.equal(chaveNota('12942'), '12942')
  })

  it('cruza por loja+numero mesmo com CNPJ emitente matriz/filial', () => {
    const notas = [
      {
        id: '10',
        numero: '12942',
        cnpj_loja: '55949831000104',
        emitente_cnpj: '02229804001830',
      },
    ]
    const despesas = [
      {
        id: 'd1',
        numero_nf: '012942-01',
        cnpj_empresa: '55949831000104',
        cnpj_fornecedor: '02229804001598',
      },
    ]
    const pares = cruzarNotas(despesas, notas)
    assert.equal(pares.length, 1)
    assert.equal(pares[0].despesa_id, 'd1')
    assert.equal(pares[0].nfe_id, '10')
  })

  it('cruza por raiz do emitente quando CNPJ empresa diverge', () => {
    const notas = [
      {
        id: '20',
        numero: '999',
        cnpj_loja: '55.555.555/0001-55',
        emitente_cnpj: '33.333.333/0001-33',
      },
    ]
    const despesas = [
      {
        id: 'd2',
        numero_nf: '999',
        cnpj_empresa: '99999999000199',
        cnpj_fornecedor: '33333333000199',
      },
    ]
    const pares = cruzarNotas(despesas, notas)
    assert.equal(pares.length, 1)
    assert.equal(pares[0].nfe_id, '20')
  })
})
