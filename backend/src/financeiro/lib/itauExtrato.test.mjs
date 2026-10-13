import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  URLS_PRODUCAO,
  achatarExtrato,
  escolherDespesa,
  consultarExtrato,
  statementIdConta,
  sugerirConciliacoes,
} from './itauExtrato.mjs'

const config = {
  ambiente: 'producao',
  client_id: 'cli-teste',
  client_secret: 'segredo',
  cert_pem: 'CERT',
  key_pem: 'KEY',
  ativo: true,
}

describe('statementId do extrato Itaú', () => {
  it('monta agência + 00 + conta de 5 + DAC', () => {
    assert.equal(statementIdConta({ agencia: '1500', numero: '12345', digito: '6' }), '150000123456')
  })

  it('completa agência e conta curtas', () => {
    assert.equal(statementIdConta({ agencia: '938', numero: '1234', digito: '0' }), '093800012340')
  })

  it('não repete o 00 quando a conta já tem 7 dígitos', () => {
    assert.equal(statementIdConta({ agencia: '1500', numero: '0012345', digito: '7' }), '150000123457')
  })

  it('ignora o DAC repetido no número com hífen', () => {
    assert.equal(statementIdConta({ agencia: '1500', numero: '12345-6', digito: '6' }), '150000123456')
  })
})

describe('leitura do extrato', () => {
  const corpo = {
    data: [{
      events: [{
        id: '104e2ce6-4b1d-3fba-adf0-694fde806773',
        type: 'lancamento',
        operation: 'C',
        reversal: false,
        date: { event: '2024-04-25T02:59:00Z', accounting: '2024-04-24' },
        literal: { code: '9507', shortened: 'SISPAG PIX PIX', complete: 'SISPAG PIX PIX' },
        amount: { value: 500, currency: 'BRL' },
        counterpart: { name: 'BRUNO E. S. FRAUCHES', document: '***.456.789-**' },
        origin: { identifier: 'E2E123', type: 'PIX', operation: 'PIX_EMISSAO' },
      }],
      balances: [{
        type: 'saldo_disponivel',
        date: { event: '2024-06-24' },
        amount: { value: 63.97, currency: 'BRL' },
      }],
    }],
    pagination: { page: 1, total_pages: 1, total_elements: 1, page_size: 1000 },
  }

  it('separa lançamento, saldo e paginação', () => {
    const pagina = achatarExtrato(corpo, {
      contaId: 'conta',
      empresaId: 'empresa',
      credencialId: 'cred',
      statementId: '150000123456',
    })
    assert.equal(pagina.lancamentos.length, 1)
    assert.equal(pagina.lancamentos[0].operacao, 'C')
    assert.equal(pagina.lancamentos[0].valor, 500)
    assert.equal(pagina.lancamentos[0].data_contabil, '2024-04-24')
    assert.equal(pagina.lancamentos[0].contraparte_nome, 'BRUNO E. S. FRAUCHES')
    assert.equal(pagina.lancamentos[0].origem_identificador, 'E2E123')
    assert.equal(pagina.saldo.valor, 63.97)
    assert.equal(pagina.totalPaginas, 1)
  })

  it('chama a URL de produção com mTLS, apikey e o statementId', async () => {
    const chamadas = []
    const pedir = async (url, opcoes) => {
      chamadas.push({ url: String(url), opcoes })
      if (String(url) === URLS_PRODUCAO.token) {
        return { ok: true, status: 200, json: { access_token: 'TOK', expires_in: 300 }, bruto: '' }
      }
      return { ok: true, status: 200, json: corpo, bruto: '' }
    }
    const extrato = await consultarExtrato(config, '150000123456', {
      pedir,
      inicio: '2026-10-07',
      fim: '2026-10-13',
      contaId: 'conta',
      empresaId: 'empresa',
    })
    assert.equal(extrato.lancamentos[0].evento_id, '104e2ce6-4b1d-3fba-adf0-694fde806773')
    const consulta = chamadas[1]
    assert.match(consulta.url, new RegExp(`^${URLS_PRODUCAO.api}/statements/150000123456\\?`))
    assert.match(consulta.url, /type=current_account/)
    assert.match(consulta.url, /start_date=2026-10-07/)
    assert.match(consulta.url, /end_date=2026-10-13/)
    assert.equal(consulta.opcoes.headers.authorization, 'Bearer TOK')
    assert.equal(consulta.opcoes.headers['x-itau-apikey'], 'cli-teste')
    assert.ok(consulta.opcoes.headers['x-itau-correlationID'])
    assert.equal(consulta.opcoes.tls.cert, 'CERT')
    assert.equal(consulta.opcoes.tls.key, 'KEY')
    assert.equal(chamadas[0].opcoes.tls.cert, 'CERT')
  })
})

describe('sugestão de conciliação', () => {
  const despesa = {
    id: 'd1',
    empresa_origem_id: 'e1',
    valor: 180.5,
    vencimento: '2026-10-10',
    documento_ref: null,
    status: 'autorizada',
  }

  it('amarra o débito quando só uma despesa tem o mesmo valor e a data perto', () => {
    const lancamento = {
      empresa_id: 'e1',
      operacao: 'D',
      estorno: false,
      valor: 180.5,
      data_contabil: '2026-10-09',
    }
    assert.equal(escolherDespesa(lancamento, [despesa]), 'd1')
  })

  it('não amarra crédito, estorno nem valor repetido', () => {
    const base = {
      empresa_id: 'e1',
      operacao: 'D',
      estorno: false,
      valor: 180.5,
      data_contabil: '2026-10-09',
    }
    assert.equal(escolherDespesa({ ...base, operacao: 'C' }, [despesa]), null)
    assert.equal(escolherDespesa({ ...base, estorno: true }, [despesa]), null)
    assert.equal(escolherDespesa(base, [despesa, { ...despesa, id: 'd2' }]), null)
  })

  it('não oferece a mesma despesa para dois débitos', () => {
    const linhas = [
      { conta_id: 'c', evento_id: 'a', empresa_id: 'e1', operacao: 'D', estorno: false, valor: 180.5, data_contabil: '2026-10-09' },
      { conta_id: 'c', evento_id: 'b', empresa_id: 'e1', operacao: 'D', estorno: false, valor: 180.5, data_contabil: '2026-10-11' },
    ]
    const pares = sugerirConciliacoes(linhas, [despesa])
    assert.equal(pares.length, 1)
    assert.equal(pares[0].despesa_id, 'd1')
  })
})
