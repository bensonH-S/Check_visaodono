import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { receberLoteFreecontrol } from './importFreecontrol.mjs'

function memPool({ empresas, despesas = [] }) {
  return {
    despesas,
    async query(sql, params = []) {
      const q = String(sql).replace(/\s+/g, ' ').toLowerCase()
      if (q.includes('alter table')) return { rows: [] }
      if (q.includes('from empresas')) return { rows: empresas }
      if (q.includes('insert into despesas')) {
        const id = `id-${despesas.length + 1}`
        despesas.push({
          id,
          descricao: params[0],
          empresa_origem_id: params[1],
          empresa_registro_id: params[2],
          documento_ref: params[3],
          numero_nf: params[4],
          competencia: params[5],
          vencimento: params[6],
          valor: params[7],
          forma_pagamento: params[8],
          dados_pagamento: params[9],
          status: 'pronta',
          fonte: 'freecontrol',
          freecontrol_tipo: params[10],
        })
        return { rows: [{ id }] }
      }
      if (q.includes("set status = 'cancelada'")) {
        const refs = params[2] || []
        for (const d of despesas) {
          if (
            d.fonte === 'freecontrol'
            && d.status === 'pronta'
            && String(d.documento_ref || '').startsWith('FC|')
            && !refs.includes(d.documento_ref)
          ) {
            d.status = 'cancelada'
          }
        }
        return { rows: [] }
      }
      if (q.includes('set vencimento =')) {
        const venc = params[0]
        for (const d of despesas) {
          if (d.fonte === 'freecontrol' && d.status === 'pronta') d.vencimento = venc
        }
        return { rows: [] }
      }
      if (q.includes('update despesas set')) {
        const row = despesas.find((d) => d.id === params[0])
        if (!row || row.status === 'paga' || row.status === 'conciliada') return { rows: [] }
        row.descricao = params[1]
        row.documento_ref = params[2]
        row.numero_nf = params[3]
        row.competencia = params[4]
        row.vencimento = params[5]
        row.valor = params[6]
        row.forma_pagamento = params[7]
        row.dados_pagamento = params[8]
        row.freecontrol_tipo = params[9]
        return { rows: [{ id: row.id }] }
      }
      if (q.includes('from despesas')) {
        const empresaId = params[0]
        const stable = params[1]
        const legado = params[2]
        const desc = String(params[4] || '').trim().toUpperCase()
        const forma = params[5]
        const hit = despesas.find((d) => {
          if (d.empresa_origem_id !== empresaId || d.status === 'cancelada') return false
          if (d.documento_ref === stable || d.documento_ref === legado) return true
          return String(d.descricao || '').trim().toUpperCase() === desc && d.forma_pagamento === forma
        })
        return { rows: hit ? [{ id: hit.id, documento_ref: hit.documento_ref, status: hit.status, valor: hit.valor }] : [] }
      }
      return { rows: [] }
    },
  }
}

const EMPRESAS = [{ id: 'emp-1', apelido: 'REI', razao_social: 'REI ALVIM', bk_number: '408', tipo: 'loja' }]

function reqLote(lancamentos, extra = {}) {
  return {
    headers: { authorization: 'Bearer tok-1234567890ab' },
    body: {
      period_from: '2026-10-19',
      period_to: '2026-10-25',
      period_key: '2026-10-19_2026-10-25',
      vencimento: '2026-10-26',
      lancamentos,
      ...extra,
    },
  }
}

const env = { FREECONTROL_MERIDIAN_TOKEN: 'tok-1234567890ab' }

describe('receberLoteFreecontrol', () => {
  it('cria o freelancer com a data do BANCO e atualiza o valor no ajuste', async () => {
    const pool = memPool({ empresas: EMPRESAS })
    const linha = {
      secao: 'REI',
      loja: 'BURGER KING - 408 Sul',
      descricao: 'FREE Caike Batista',
      tipo: 'freelance',
      valor: 70,
      pagamento: 'FOLHA',
      codigo_ref: 'EMP-9',
    }
    const a = await receberLoteFreecontrol(pool, reqLote([linha]), env)
    assert.equal(a.criadas, 1)
    assert.equal(a.atualizadas, 0)
    assert.equal(a.vencimento, '2026-10-26')
    assert.equal(pool.despesas[0].vencimento, '2026-10-26')
    assert.equal(pool.despesas[0].valor, 70)

    const b = await receberLoteFreecontrol(pool, reqLote([{ ...linha, valor: 95 }]), env)
    assert.equal(b.criadas, 0)
    assert.equal(b.atualizadas, 1)
    assert.equal(pool.despesas.length, 1)
    assert.equal(pool.despesas[0].valor, 95)
    assert.equal(pool.despesas[0].vencimento, '2026-10-26')
  })

  it('cancela no financeiro quem foi retirado do lote da semana', async () => {
    const pool = memPool({ empresas: EMPRESAS })
    const caike = {
      secao: 'REI',
      loja: 'BURGER KING - 408 Sul',
      descricao: 'FREE Caike Batista',
      tipo: 'freelance',
      valor: 70,
      pagamento: 'FOLHA',
      codigo_ref: 'EMP-9',
    }
    const barbara = {
      secao: 'REI',
      loja: 'BURGER KING - 408 Sul',
      descricao: 'FREE Barbara',
      tipo: 'freelance',
      valor: 40,
      pagamento: 'FOLHA',
      codigo_ref: 'EMP-10',
    }
    await receberLoteFreecontrol(pool, reqLote([caike, barbara]), env)
    assert.equal(pool.despesas.filter((d) => d.status === 'pronta').length, 2)

    await receberLoteFreecontrol(pool, reqLote([caike]), env)
    const vivas = pool.despesas.filter((d) => d.status === 'pronta')
    const canceladas = pool.despesas.filter((d) => d.status === 'cancelada')
    assert.equal(vivas.length, 1)
    assert.equal(vivas[0].descricao, 'Caike Batista')
    assert.equal(canceladas.length, 1)
    assert.equal(canceladas[0].descricao, 'Barbara')
  })
})
