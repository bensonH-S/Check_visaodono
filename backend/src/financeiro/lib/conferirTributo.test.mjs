import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  conferirDespesaTributo,
  decodificarArrecadacao,
  extrairCodigoTributo,
  linhaParaBarras,
} from './conferirTributo.mjs'

describe('conferirTributo', () => {
  const linhaIptu = '856700000073 200900091915 026000052428 496006612527'

  it('valida DV e extrai valor 720,09 do IPTU LORD', () => {
    const cod = extrairCodigoTributo(linhaIptu)
    assert.equal(cod?.length, 48)
    const barras = linhaParaBarras(cod)
    assert.equal(barras?.length, 44)
    const dec = decodificarArrecadacao(cod)
    assert.equal(dec.ok, true)
    assert.equal(dec.valor, 720.09)
  })

  it('confirma quando valor e vencimento batem', () => {
    const r = conferirDespesaTributo({
      descricao: 'IPTU',
      tributo_tipo: 'iptu',
      dados_pagamento: linhaIptu,
      valor: 720.09,
      vencimento: '2026-10-19',
    })
    assert.equal(r.status, 'conferido')
  })

  it('fica pendente se valor diverge', () => {
    const r = conferirDespesaTributo({
      descricao: 'IPTU',
      tributo_tipo: 'iptu',
      dados_pagamento: linhaIptu,
      valor: 999.99,
      vencimento: '2026-10-19',
    })
    assert.equal(r.status, 'pendente')
  })

  it('confirma PIS/COFINS com linha mód.11 (id 8)', () => {
    const linha = '85890000104 9 35300385262 8 96071626288 7 86988453100 5'
    const dec = decodificarArrecadacao(extrairCodigoTributo(linha))
    assert.equal(dec.ok, true)
    assert.equal(dec.valor, 10435.3)
    const r = conferirDespesaTributo({
      descricao: 'PIS COFINS',
      tributo_tipo: 'pis',
      dados_pagamento: linha,
      valor: 10435.3,
    })
    assert.equal(r.status, 'conferido')
  })

  it('confirma FGTS via PIX Caixa + GFD', () => {
    const pix = '00020101021226900014br.gov.bcb.pix2568pix-qrcode.caixa.gov.br/api/v2/cobv/82381e23c15549609b551fea8a4fe4f25204000053039865802BR5923CAIXA'
    const r = conferirDespesaTributo({
      descricao: 'GFD FGTS',
      tributo_tipo: 'fgts',
      documento_ref: 'GFD|0126101567368477-7',
      dados_pagamento: pix,
      valor: 163.05,
    })
    assert.equal(r.status, 'conferido')
  })
})
