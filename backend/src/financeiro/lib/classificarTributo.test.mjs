import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classificarTributo, rotuloTributo } from './classificarTributo.mjs'

describe('classificarTributo', () => {
  it('reconhece IPTU, PIS, COFINS e ICMS DIFAL', () => {
    assert.equal(classificarTributo({ descricao: 'IPTU' }), 'iptu')
    assert.equal(classificarTributo({ descricao: 'PIS mensal' }), 'pis')
    assert.equal(classificarTributo({ plano: 'COFINS' }), 'cofins')
    assert.equal(classificarTributo({ descricao: 'ICMS DIFAL SP' }), 'icms_difal')
    assert.equal(classificarTributo({ documento_ref: 'DARF|123' }), 'darf')
    assert.equal(rotuloTributo('pis'), 'PIS')
  })

  it('não classifica Free Control', () => {
    assert.equal(classificarTributo({ fonte: 'freecontrol', descricao: 'PIS' }), null)
  })
})
