import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chaveNota, cruzarNotas, cruzarPorValor } from './nfEntrada.mjs'

describe('nfEntrada', () => {
  it('chaveNota normaliza sufixo e zeros', () => {
    assert.equal(chaveNota('012596-02'), '12596')
    assert.equal(chaveNota('0007075'), '7075')
    assert.equal(chaveNota('12942'), '12942')
    assert.equal(chaveNota('00168866 1'), '168866')
    assert.equal(chaveNota('014431-01'), '14431')
  })

  it('cruza boleto com parcela separada por espaço', () => {
    const pares = cruzarNotas(
      [{
        id: 'dda',
        numero_nf: '00168866 1',
        cnpj_empresa: '11111111000111',
        cnpj_fornecedor: '22222222000122',
      }],
      [{
        id: '3388',
        numero: '168866',
        cnpj_loja: '11111111000111',
        emitente_cnpj: '22222222000122',
        status_entrega: 'conferida',
      }],
    )
    assert.equal(pares.length, 1)
    assert.equal(pares[0].nfe_id, '3388')
    assert.equal(pares[0].ciclo, 'confirmada')
  })

  it('cruza por valor quando o boleto não traz o número da NF', () => {
    const pares = cruzarPorValor(
      [{
        id: 'dda',
        numero_nf: '00990613582026',
        cnpj_empresa: '11111111000111',
        cnpj_fornecedor: '33333333000133',
        valor: 362.6,
        vencimento: '2026-10-21',
      }],
      [{
        id: '3294',
        numero: '17931667',
        cnpj_loja: '11111111000111',
        emitente_cnpj: '33333333000133',
        valor_total: 362.6,
        data_vencimento: '2026-10-21',
        status_entrega: 'conferida',
      }],
    )
    assert.equal(pares.length, 1)
    assert.equal(pares[0].despesa_id, 'dda')
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
