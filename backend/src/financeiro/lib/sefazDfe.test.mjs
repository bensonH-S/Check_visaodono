/**
 * Parser da Distribuição DF-e — sem chamar a Receita.
 *   node --test src/financeiro/lib/sefazDfe.test.mjs
 */
import crypto from 'node:crypto'
import { gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cUfDe,
  documentosDe,
  envelopeConsChave,
  envelopeDistNsu,
  eventoCiencia,
  interpretarDocumento,
  interpretarEvento,
  notaDeEntrada,
  nsu15,
  numeroDaChave,
} from './sefazDfe.mjs'

const CHAVE = '53241026075154000136550010000012341123456789'

describe('sefaz DF-e', () => {
  it('monta o pedido distNSU com CNPJ e NSU de 15 dígitos', () => {
    const xml = envelopeDistNsu({ cnpj: '26.075.154/0001-36', cUF: '53', ultNSU: '12', tpAmb: '1' })
    assert.match(xml, /<CNPJ>26075154000136<\/CNPJ>/)
    assert.match(xml, /<cUFAutor>53<\/cUFAutor>/)
    assert.match(xml, /<ultNSU>000000000000012<\/ultNSU>/)
    assert.equal(nsu15(''), '000000000000000')
    assert.equal(cUfDe('sp'), '35')
    assert.equal(cUfDe(''), '53')
  })

  it('lê número e série da chave de acesso', () => {
    assert.deepEqual(numeroDaChave(CHAVE), { serie: '1', numero: '1234' })
  })

  it('abre o resumo gzipado que a Receita manda no docZip', () => {
    const resumo = `<?xml version="1.0" encoding="UTF-8"?>
<resNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <chNFe>${CHAVE}</chNFe>
  <CNPJ>12345678000199</CNPJ>
  <xNome>FORNECEDOR &amp; CIA</xNome>
  <dhEmi>2026-10-08T14:00:00-03:00</dhEmi>
  <tpNF>1</tpNF>
  <vNF>1500.50</vNF>
  <cSitNFe>1</cSitNFe>
</resNFe>`
    const b64 = gzipSync(Buffer.from(resumo)).toString('base64')
    const soap = `<?xml version="1.0"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresseResult xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <retDistDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">
        <cStat>138</cStat>
        <xMotivo>Documento localizado</xMotivo>
        <ultNSU>000000000000020</ultNSU>
        <maxNSU>000000000000020</maxNSU>
        <loteDistDFeInt>
          <docZip NSU="000000000000020" schema="resNFe_v1.01.xsd">${b64}</docZip>
        </loteDistDFeInt>
      </retDistDFeInt>
    </nfeDistDFeInteresseResult>
  </soap12:Body>
</soap12:Envelope>`
    const ret = documentosDe(soap)
    assert.equal(ret.cStat, '138')
    assert.equal(ret.documentos.length, 1)
    const doc = ret.documentos[0]
    assert.equal(doc.tipo, 'resumo')
    assert.equal(doc.emitente_nome, 'FORNECEDOR & CIA')
    assert.equal(doc.numero, '1234')
    assert.equal(doc.valor_total, 1500.5)
    assert.equal(doc.emissao, '2026-10-08')
    assert.equal(doc.situacao, 'autorizada')
    assert.equal(notaDeEntrada(doc, '26075154000136'), true)
  })

  it('ignora a NF que a própria empresa emitiu e marca cancelamento', () => {
    const venda = interpretarDocumento(`<nfeProc><NFe><infNFe Id="NFe${CHAVE}"></infNFe></NFe></nfeProc>`)
    assert.equal(venda.tipo === 'completa' || venda.tipo === 'resumo', true)
    const cancel = interpretarDocumento('<resEvento><tpEvento>110111</tpEvento><chNFe>53241026075154000136550010000012341123456780</chNFe></resEvento>')
    assert.equal(cancel.tipo, 'cancelamento')
    assert.equal(notaDeEntrada({
      tipo: 'completa',
      emitente_cnpj: '26075154000136',
      destinatario_cnpj: '12345678000199',
      chave: CHAVE,
    }, '26075154000136'), false)
    assert.equal(notaDeEntrada({
      tipo: 'completa',
      emitente_cnpj: '12345678000199',
      destinatario_cnpj: '26075154000136',
      chave: CHAVE,
    }, '26075154000136'), true)
  })

  it('pede o XML pela chave e assina a ciência da operação', () => {
    const pedido = envelopeConsChave({ cnpj: '26.075.154/0001-36', cUF: '52', chave: CHAVE, tpAmb: '1' })
    assert.match(pedido, /<consChNFe>\s*<chNFe>53241026075154000136550010000012341123456789<\/chNFe>/)
    assert.match(pedido, /<cUFAutor>52<\/cUFAutor>/)
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const keyPem = privateKey.export({ type: 'pkcs1', format: 'pem' })
    const { env, signedInfo } = eventoCiencia({
      cnpj: '26075154000136',
      chave: CHAVE,
      dhEvento: '2026-10-08T23:47:00-03:00',
      tpAmb: '1',
      keyPem,
      certPem: '-----BEGIN CERTIFICATE-----\nQQ==\n-----END CERTIFICATE-----',
      idLote: '7',
    })
    assert.match(env, /<tpEvento>210210<\/tpEvento>/)
    assert.match(env, /<descEvento>Ciencia da Operacao<\/descEvento>/)
    assert.match(env, /<X509Certificate>QQ==<\/X509Certificate>/)
    const comCadeia = eventoCiencia({
      cnpj: '26075154000136',
      chave: CHAVE,
      dhEvento: '2026-10-08T23:47:00-03:00',
      tpAmb: '1',
      keyPem,
      certPem: '-----BEGIN CERTIFICATE-----\nQQ==\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nRR==\n-----END CERTIFICATE-----',
      idLote: '7',
    })
    assert.match(comCadeia.env, /<X509Certificate>QQ==<\/X509Certificate>/)
    assert.doesNotMatch(comCadeia.env, /RR==/)
    const valor = env.match(/<SignatureValue>([^<]+)<\/SignatureValue>/)?.[1]
    const verificar = crypto.createVerify('RSA-SHA1')
    verificar.update(signedInfo)
    assert.equal(verificar.verify(publicKey, valor, 'base64'), true)
    const registrado = interpretarEvento('<retEnvEvento><cStat>128</cStat><xMotivo>Lote processado</xMotivo><retEvento><infEvento><cStat>135</cStat><xMotivo>Evento registrado</xMotivo></infEvento></retEvento></retEnvEvento>')
    assert.equal(registrado.ok, true)
    assert.equal(registrado.cStat, '135')
  })
})
