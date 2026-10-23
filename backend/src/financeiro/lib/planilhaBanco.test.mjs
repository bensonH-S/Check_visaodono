import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import XLSX from 'xlsx'
import { montarPlanilhaBanco, nomeArquivoPlanilha, rotuloEmpresa } from './planilhaBanco.mjs'

describe('planilha do banco', () => {
  it('monta o arquivo no padrão da agenda, por empresa', async () => {
    const buf = await montarPlanilhaBanco({
      de: '2026-10-10',
      ate: '2026-10-17',
      empresas: [
        { id: '2', apelido: 'LORD', razao_social: 'LORD ALVIM' },
        { id: '1', apelido: 'REI', razao_social: 'REI ALVIM' },
        { id: '3', apelido: 'KING', razao_social: 'KING ASSESSORIA' },
      ],
      linhas: [
        {
          origem_id: '1',
          apelido: 'REI',
          descricao: 'PLATLOG IMP LOG E DISTRIBUICAO LTDA',
          valor: 100.5,
          vencimento: '2026-10-12',
          numero_nf: '011279-01',
          forma_pagamento: 'boleto',
          pagamento: '23793390019000001833497000163101415930002014465',
          nf_confirmada: true,
          nf_divergente: false,
        },
        {
          origem_id: '1',
          apelido: 'REI',
          descricao: 'GIMBA',
          valor: 40,
          vencimento: '2026-10-16',
          numero_nf: '1',
          forma_pagamento: 'boleto',
          pagamento: '',
          nf_confirmada: false,
          nf_divergente: false,
        },
        {
          origem_id: '1',
          apelido: 'REI',
          descricao: '',
          fornecedor: 'PLATLOG IMP LOG E DISTRIBUICAO LTDA',
          valor: 50,
          vencimento: '2026-10-15',
          numero_nf: '012596-02',
          forma_pagamento: 'boleto',
          pagamento: '',
          fonte: 'dda',
          nf_confirmada: true,
          nf_divergente: true,
        },
        {
          origem_id: '3',
          apelido: 'KING',
          descricao: 'Caike Batista dos Santos',
          valor: 70,
          vencimento: '2026-10-12',
          fonte: 'freecontrol',
          freecontrol_tipo: 'freelance',
          forma_pagamento: 'folha',
          registrado_em: 'REI',
        },
      ],
    })
    const wb = XLSX.read(buf, { type: 'buffer' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.Plan1, { header: 1, defval: '' })
    assert.equal(rows[0][1], 'BANCO 10/10 A 17/10')
    assert.equal(rows[1][3], 'TOTAL BR')
    assert.equal(rows[1][4], 260.5)
    assert.equal(rows[4][0], 'NF')
    assert.equal(rows[4][1], 'REI ALVIM')
    assert.equal(rows[4][5], 'STATUS NF')
    assert.equal(rows[6][0], '011279-01')
    assert.equal(rows[6][1], 'PLATLOG')
    assert.equal(rows[6][2], 100.5)
    assert.equal(rows[6][3], 46307)
    assert.equal(rows[6][5], 'NF confirmada')
    assert.equal(rows[7][0], '012596-02')
    assert.equal(rows[7][1], 'PLATLOG')
    assert.equal(rows[7][2], 50)
    assert.equal(rows[7][5], 'NF Parcial')
    assert.equal(rows[8][1], 'GIMBA')
    assert.equal(rows[8][2], 40)
    assert.equal(rows[8][5], 'NF Pendente')
    assert.equal(rows[9][1], 'TOTAL ')
    assert.equal(rows[9][2], 190.5)
    const king = rows.findIndex((r) => r[1] === 'KING ASSESSORIA')
    assert.ok(king > 4)
    assert.equal(rows[king][0], '')
    assert.equal(rows[king + 2][0], 'REI ALVIM')
    assert.equal(rows[king + 2][1], 'FREE Caike Batista dos Santos')
    assert.equal(rows[king + 2][4], 'FOLHA CADASTRADA')
    assert.equal(rows[king + 2][5], 'free confirmado')
    assert.equal(nomeArquivoPlanilha('2026-10-10', '2026-10-17'), 'BANCO 10.10 A 17.10.xlsx')
    assert.equal(rotuloEmpresa({ apelido: 'POPVAL' }), 'POPOYES VAL')
  })

  it('ordena cada loja por vencimento e, no mesmo dia, pelo valor maior', async () => {
    const buf = await montarPlanilhaBanco({
      de: '2026-10-25',
      ate: '2026-10-31',
      empresas: [{ id: '1', apelido: 'REI', razao_social: 'REI ALVIM' }],
      linhas: [
        { origem_id: '1', apelido: 'REI', descricao: 'MENOR NO DIA', valor: 30, vencimento: '2026-10-26', forma_pagamento: 'boleto' },
        { origem_id: '1', apelido: 'REI', descricao: 'TARDE E ALTO', valor: 900, vencimento: '2026-10-28', forma_pagamento: 'boleto' },
        { origem_id: '1', apelido: 'REI', descricao: 'MAIOR NO DIA', valor: 400, vencimento: '2026-10-26', forma_pagamento: 'boleto' },
        { origem_id: '1', apelido: 'REI', descricao: 'DIA ANTERIOR', valor: 10, vencimento: '2026-10-25', forma_pagamento: 'boleto' },
      ],
    })
    const wb = XLSX.read(buf, { type: 'buffer' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.Plan1, { header: 1, defval: '' })
    const dados = rows.filter((r) => ['DIA ANTERIOR', 'MAIOR NO DIA', 'MENOR NO DIA', 'TARDE E ALTO'].includes(r[1]))
    assert.deepEqual(dados.map((r) => [r[1], r[2]]), [
      ['DIA ANTERIOR', 10],
      ['MAIOR NO DIA', 400],
      ['MENOR NO DIA', 30],
      ['TARDE E ALTO', 900],
    ])
  })
})
