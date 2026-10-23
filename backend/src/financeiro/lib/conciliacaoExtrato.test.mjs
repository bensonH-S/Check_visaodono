import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  acharConta,
  contaDoCsv,
  contaDoOfx,
  contaDoTexto,
  escolherConciliacaoAutomatica,
  escolherDespesaPagar,
  lerCsvExtrato,
  lerOfx,
  lerPlanilhaExtrato,
  pareceNaoTitulo,
  resolverConta,
  resumoExtrato,
  sugerirPagar,
} from './conciliacaoExtrato.mjs'
import XLSX from 'xlsx'

describe('conciliação extrato', () => {
  it('lê OFX de débito e crédito', () => {
    const ofx = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261012
<TRNAMT>-15446.67
<FITID>ABC123
<MEMO>PLATLOG BOLETO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261012
<TRNAMT>1000.00
<FITID>CRED1
<MEMO>CIELO
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`
    const linhas = lerOfx(Buffer.from(ofx, 'utf8'))
    assert.equal(linhas.length, 2)
    assert.equal(linhas[0].operacao, 'D')
    assert.equal(linhas[0].valor, 15446.67)
    assert.equal(linhas[0].data_contabil, '2026-10-12')
    assert.equal(linhas[0].historico, 'PLATLOG BOLETO')
    assert.equal(linhas[1].operacao, 'C')
  })

  it('lê CSV com débito e crédito', () => {
    const csv = `Data;Débito;Crédito;Histórico
12/10/2026;1078,74;;GIMBA
12/10/2026;;500,00;CIELO VISA
`
    const linhas = lerCsvExtrato(Buffer.from(csv, 'utf8'))
    assert.equal(linhas.length, 2)
    assert.equal(linhas[0].operacao, 'D')
    assert.equal(linhas[0].valor, 1078.74)
    assert.equal(linhas[1].operacao, 'C')
  })

  it('casa sozinho valor único e ignora entrada/tarifa', () => {
    const despesa = escolherDespesaPagar(
      { operacao: 'D', estorno: false, valor: 100.5, data_contabil: '2026-10-12', empresa_id: 'e1' },
      [
        { id: 'd1', empresa_origem_id: 'e1', valor: 100.5, vencimento: '2026-10-13', status: 'pronta' },
        { id: 'd2', empresa_origem_id: 'e1', valor: 200, vencimento: '2026-10-12', status: 'pronta' },
      ],
    )
    assert.equal(despesa.id, 'd1')
    const unico = escolherConciliacaoAutomatica(
      { operacao: 'D', estorno: false, valor: 15446.67, data_contabil: '2026-10-20', empresa_id: 'e1', historico: 'BOLETO PLATLOG' },
      [{ id: 'd9', empresa_origem_id: 'e1', valor: 15446.67, vencimento: '2026-10-12', status: 'pronta', descricao: 'PLATLOG' }],
    )
    assert.equal(unico.id, 'd9')
    const longe = escolherConciliacaoAutomatica(
      { operacao: 'D', estorno: false, valor: 2781.13, data_contabil: '2026-10-05', empresa_id: 'e1', historico: 'BOLETO PAGO PLATLOG IMPORTACAO' },
      [{ id: 'd26', empresa_origem_id: 'e1', valor: 2781.13, vencimento: '2026-10-26', status: 'pronta', descricao: 'PLATLOG IMP LOG E DISTRIBUICAO LTDA' }],
    )
    assert.equal(longe, null)
    assert.equal(pareceNaoTitulo({ operacao: 'C', historico: 'CIELO VISA' }), true)
    assert.equal(pareceNaoTitulo({ operacao: 'D', historico: 'TARIFA PACOTE' }), true)
    assert.equal(pareceNaoTitulo({ operacao: 'D', historico: 'APL APLIC AUT MAIS' }), true)
    assert.equal(pareceNaoTitulo({ operacao: 'D', historico: 'PLATLOG BOLETO' }), false)
    assert.equal(pareceNaoTitulo(
      { operacao: 'D', historico: 'PIX ENVIADO BURGER KING 26.075.154/0001-36' },
      { cnpjsGrupo: ['26075154000136'] },
    ), true)
    assert.equal(pareceNaoTitulo(
      { operacao: 'D', historico: 'PIX ENVIADO FORNECEDOR X 12.345.678/0001-99' },
      { cnpjsGrupo: ['26075154000136'] },
    ), false)
    const porNome = escolherConciliacaoAutomatica(
      { operacao: 'D', estorno: false, valor: 932.31, data_contabil: '2026-10-09', empresa_id: 'e1', historico: 'BOLETO PAGO SUPRICORP S A' },
      [{ id: 'd8', empresa_origem_id: 'e1', valor: 932.31, vencimento: '2026-10-09', status: 'pronta', descricao: 'SUPRICORP' }],
    )
    assert.equal(porNome?.id, 'd8')
    const sugestoes = sugerirPagar(
      [{ id: 'l1', operacao: 'D', valor: 100.5, data_contabil: '2026-10-12', empresa_id: 'e1', status: 'pendente' }],
      [{ id: 'd1', empresa_origem_id: 'e1', valor: 100.5, vencimento: '2026-10-12', status: 'pronta' }],
    )
    assert.deepEqual(sugestoes, [{ lancamento_id: 'l1', despesa_id: 'd1' }])

    // CNPJ no MEMO do OFX (não no CHECKNUM) + mesma raiz de filial
    const porCnpjMemo = escolherConciliacaoAutomatica(
      {
        operacao: 'D',
        estorno: false,
        valor: 1800,
        data_contabil: '2026-10-13',
        empresa_id: 'e1',
        historico: 'PIX ENVIADO SYBRA 02.496.994/0001-04',
        documento_ref: '20261013002',
      },
      [{
        id: 'sybra',
        empresa_origem_id: 'e1',
        valor: 1800,
        vencimento: '2026-10-13',
        status: 'conciliada',
        descricao: 'SYBRA',
        fornecedor: 'SYBRA',
        cpf_cnpj: '02496994000104',
      }],
    )
    assert.equal(porCnpjMemo?.id, 'sybra')

    const porRaizFilial = escolherConciliacaoAutomatica(
      {
        operacao: 'D',
        estorno: false,
        valor: 1078.74,
        data_contabil: '2026-10-13',
        empresa_id: 'e1',
        historico: 'BOLETO PAGO SUPRICORP SU SUPRICORP SUPRIMENTOS LTDA 54.651.716/0001-88',
      },
      [{
        id: 'gimba',
        empresa_origem_id: 'e1',
        valor: 1078.74,
        vencimento: '2026-10-12',
        status: 'pronta',
        descricao: 'GIMBA',
        fornecedor: 'GIMBA',
        cpf_cnpj: '54651716001150',
      }],
    )
    assert.equal(porRaizFilial?.id, 'gimba')

    assert.equal(pareceNaoTitulo({ operacao: 'D', historico: 'SISPAG SALARIOS' }), true)

    const ofxCnpj = lerOfx(Buffer.from(`OFXHEADER:100
<OFX><STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261013
<TRNAMT>-1800.00
<FITID>20261013002
<CHECKNUM>20261013002
<MEMO>PIX ENVIADO SYBRA 02.496.994/0001-04
</STMTTRN></OFX>`))
    assert.equal(ofxCnpj[0].documento_ref, '02496994000104')
  })

  it('resume entradas, saídas e o que ainda está em aberto', () => {
    const resumo = resumoExtrato([
      { operacao: 'C', valor: 1000, status: 'pendente', estorno: false },
      { operacao: 'D', valor: 400, status: 'conciliado', despesa_id: 'd1', estorno: false },
      { operacao: 'D', valor: 50, status: 'pendente', estorno: false },
      { operacao: 'D', valor: 10, status: 'sem_par', estorno: false },
      { operacao: 'C', valor: 10, status: 'pendente', estorno: true },
    ])
    assert.equal(resumo.entradas, 1010)
    assert.equal(resumo.saidas, 460)
    assert.equal(resumo.liquido, 550)
    assert.equal(resumo.qtd, 5)
    assert.equal(resumo.conciliados, 1)
    assert.equal(resumo.em_aberto, 2)
    assert.equal(resumo.valor_aberto, 1050)
  })

  it('identifica a conta pelo cabeçalho do arquivo', () => {
    const contas = [
      { id: 'bb1', banco: 'banco_do_brasil', agencia: '3599-8', numero: '21633', digito: 'X', empresa_id: 'e1', cnpj: '26075154000136', apelido: 'REI' },
      { id: 'bb2', banco: 'banco_do_brasil', agencia: '3599-8', numero: '21634', digito: '5', empresa_id: 'e2', cnpj: '123', apelido: 'LORD' },
      { id: 'it1', banco: 'itau', agencia: '4739', numero: '97985', digito: '6', empresa_id: 'e1', cnpj: '26075154000136', apelido: 'REI' },
    ]
    const ofxBb = Buffer.from('<OFX><BANKID>001<BRANCHID>3599-8<ACCTID>21633-X<STMTTRN></OFX>')
    assert.deepEqual(acharConta(contas, contaDoOfx(ofxBb)).map((c) => c.id), ['bb1'])
    const ofxItau = Buffer.from('<OFX><BANKID>0341<BRANCHID>4739<ACCTID>979856<STMTTRN></OFX>')
    assert.deepEqual(acharConta(contas, contaDoOfx(ofxItau)).map((c) => c.id), ['it1'])
    const ofxItauComAgencia = Buffer.from('<OFX><BANKID>341<ACCTID>4739979856<STMTTRN></OFX>')
    assert.deepEqual(acharConta(contas, contaDoOfx(ofxItauComAgencia)).map((c) => c.id), ['it1'])
    const csv = Buffer.from('Banco do Brasil\nAgência: 3599-8  Conta: 21634-5\nData;Valor;Histórico\n12/10/2026;-10,00;X\n')
    assert.deepEqual(acharConta(contas, contaDoCsv(csv)).map((c) => c.id), ['bb2'])
    assert.equal(lerCsvExtrato(csv).length, 1)
  })

  it('identifica a conta da planilha xlsx sozinho', () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Banco do Brasil'],
      ['Agência', '3599-8'],
      ['Conta', '21633-X'],
      ['CNPJ', '26.075.154/0001-36'],
      [],
      ['Data', 'Lançamento', 'Razão Social', 'CPF/CNPJ', 'Valor'],
      [new Date(2026, 9, 12), 'PAGAMENTO BOLETO', 'PLATLOG', '123', -15446.67],
      [new Date(2026, 9, 12), 'PIX RECEBIDO', 'CIELO', '', 1000],
    ])
    XLSX.utils.book_append_sheet(wb, ws, 'Extrato')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const { linhas, conta } = lerPlanilhaExtrato(buffer)
    assert.equal(linhas.length, 2)
    assert.equal(conta.agencia, '3599-8')
    assert.equal(conta.conta, '21633-X')
    assert.equal(conta.cnpj, '26075154000136')
    const contas = [
      { id: 'bb1', banco: 'banco_do_brasil', agencia: '3599-8', numero: '21633', digito: 'X', empresa_id: 'e1', cnpj: '26075154000136', apelido: 'REI' },
      { id: 'it1', banco: 'itau', agencia: '4739', numero: '97985', digito: '6', empresa_id: 'e1', cnpj: '26075154000136', apelido: 'REI' },
    ]
    assert.deepEqual(resolverConta(contas, conta).map((c) => c.id), ['bb1'])
  })

  it('resolve conta pela loja quando o arquivo não traz número', () => {
    const contas = [
      { id: 'it1', banco: 'itau', agencia: '4739', numero: '97985', digito: '6', empresa_id: 'e1', cnpj: '26075154000136', apelido: 'REI' },
      { id: 'it2', banco: 'itau', agencia: '4739', numero: '11111', digito: '1', empresa_id: 'e2', cnpj: '999', apelido: 'LORD' },
    ]
    assert.deepEqual(resolverConta(contas, contaDoTexto('Extrato Itaú'), { empresaId: 'e1' }).map((c) => c.id), ['it1'])
  })
})
