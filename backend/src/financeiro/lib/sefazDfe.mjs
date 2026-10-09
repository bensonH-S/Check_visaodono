/**
 * Distribuição de DF-e do Ambiente Nacional (o canal da Receita / SEFAZ
 * para “notas destinadas” ao CNPJ). Exige o certificado A1 da própria empresa.
 *
 * Produção: https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx
 */
import crypto from 'node:crypto'
import https from 'node:https'
import { gunzipSync } from 'node:zlib'
import { parseNfeXml } from '../../services/nfeXml.js'

const URLS = {
  producao: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
}

const ACAO = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse'
const ACAO_EVENTO = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento'
const URLS_EVENTO = {
  producao: 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  homologacao: 'https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
}

const UF_IBGE = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
  MG: '31', ES: '32', RJ: '33', SP: '35',
  PR: '41', SC: '42', RS: '43',
  MS: '50', MT: '51', GO: '52', DF: '53',
}

function digitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

function unescapeXml(valor) {
  return String(valor ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function semNs(xml) {
  return String(xml || '').replace(/<(\/?)[\w.-]+:/g, '<$1')
}

function tag(xml, name) {
  const re = new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i')
  const m = String(xml || '').match(re)
  return m ? m[1].trim() : ''
}

function textoXml(valor) {
  return unescapeXml(valor).replace(/\s+/g, ' ').trim()
}

function numero(valor) {
  if (valor == null || valor === '') return null
  const n = Number(String(valor).replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

export function nsu15(valor) {
  const d = digitos(valor)
  if (!d) return '000000000000000'
  return d.padStart(15, '0').slice(-15)
}

export function cUfDe(uf) {
  const chave = String(uf || '').trim().toUpperCase()
  return UF_IBGE[chave] || '53'
}

export function numeroDaChave(chave) {
  const c = digitos(chave)
  if (c.length !== 44) return { numero: '', serie: '' }
  return {
    serie: String(Number(c.slice(22, 25))),
    numero: String(Number(c.slice(25, 34))),
  }
}

export function envelopeDistNsu({ cnpj, cUF, ultNSU, tpAmb = '1' }) {
  const doc = digitos(cnpj)
  const uf = String(cUF || '53').padStart(2, '0')
  const nsu = nsu15(ultNSU)
  const amb = tpAmb === '2' ? '2' : '1'
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${amb}</tpAmb>
          <cUFAutor>${uf}</cUFAutor>
          <CNPJ>${doc}</CNPJ>
          <distNSU>
            <ultNSU>${nsu}</ultNSU>
          </distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`
}

/** Pede o XML de uma chave. A Receita só devolve a NF-e completa depois da ciência. */
export function envelopeConsChave({ cnpj, cUF, chave, tpAmb = '1' }) {
  const doc = digitos(cnpj)
  const uf = String(cUF || '53').padStart(2, '0')
  const ch = digitos(chave)
  const amb = tpAmb === '2' ? '2' : '1'
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${amb}</tpAmb>
          <cUFAutor>${uf}</cUFAutor>
          <CNPJ>${doc}</CNPJ>
          <consChNFe>
            <chNFe>${ch}</chNFe>
          </consChNFe>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`
}

function certBase64(certPem) {
  return String(certPem || '').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
}

/** Ciência da operação (210210), assinada com o A1 do destinatário. */
export function eventoCiencia({ cnpj, chave, dhEvento, tpAmb = '1', keyPem, certPem, idLote = '1' }) {
  const doc = digitos(cnpj)
  const ch = digitos(chave)
  if (doc.length !== 14) throw new Error('CNPJ inválido para a ciência da nota.')
  if (ch.length !== 44) throw new Error('Chave da nota inválida.')
  if (!keyPem || !certPem) throw new Error('Certificado A1 sem chave para registrar a ciência.')
  const id = `ID210210${ch}01`
  const amb = tpAmb === '2' ? '2' : '1'
  const inf =
    `<infEvento xmlns="http://www.portalfiscal.inf.br/nfe" Id="${id}">` +
    `<cOrgao>91</cOrgao>` +
    `<tpAmb>${amb}</tpAmb>` +
    `<CNPJ>${doc}</CNPJ>` +
    `<chNFe>${ch}</chNFe>` +
    `<dhEvento>${dhEvento}</dhEvento>` +
    `<tpEvento>210210</tpEvento>` +
    `<nSeqEvento>1</nSeqEvento>` +
    `<verEvento>1.00</verEvento>` +
    `<detEvento versao="1.00">` +
    `<descEvento>Ciencia da Operacao</descEvento>` +
    `</detEvento>` +
    `</infEvento>`
  const digest = crypto.createHash('sha1').update(inf, 'utf8').digest('base64')
  const signedInfo =
    '<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">' +
    '<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>' +
    '<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>' +
    `<Reference URI="#${id}">` +
    '<Transforms>' +
    '<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>' +
    '<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>' +
    '</Transforms>' +
    '<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>' +
    `<DigestValue>${digest}</DigestValue>` +
    '</Reference>' +
    '</SignedInfo>'
  const assinatura = crypto.createSign('RSA-SHA1').update(signedInfo, 'utf8').sign(keyPem, 'base64')
  const evento =
    '<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">' +
    inf +
    '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">' +
    signedInfo +
    `<SignatureValue>${assinatura}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${certBase64(certPem)}</X509Certificate></X509Data></KeyInfo>` +
    '</Signature>' +
    '</evento>'
  const lote = String(idLote).replace(/\D/g, '').slice(0, 15) || '1'
  const env =
    '<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">' +
    `<idLote>${lote}</idLote>` +
    evento +
    '</envEvento>'
  return { env, inf, signedInfo, id }
}

export function envelopeEvento(envEvento) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeRecepcaoEvento xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      <nfeDadosMsg>
        ${envEvento}
      </nfeDadosMsg>
    </nfeRecepcaoEvento>
  </soap12:Body>
</soap12:Envelope>`
}

export function dhEventoAgora() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const p = Object.fromEntries(partes.filter((item) => item.type !== 'literal').map((item) => [item.type, item.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}-03:00`
}

export function xmlDoDocZip(base64) {
  const buf = Buffer.from(String(base64 || '').replace(/\s+/g, ''), 'base64')
  if (!buf.length) return ''
  try {
    return gunzipSync(buf).toString('utf8')
  } catch {
    return buf.toString('utf8')
  }
}

export function interpretarRetorno(xmlBruto) {
  const xml = semNs(unescapeXml(xmlBruto))
  const fault = textoXml(tag(xml, 'faultstring') || tag(xml, 'Text'))
  const cStat = tag(xml, 'cStat')
  if (!cStat) {
    throw new Error(fault || 'A Receita Federal devolveu uma resposta sem status.')
  }
  const docZips = []
  const re = /<docZip\b([^>]*)>([^<]*)<\/docZip>/gi
  let achado
  while ((achado = re.exec(xml)) !== null) {
    const attrs = achado[1]
    docZips.push({
      nsu: (attrs.match(/\bNSU="(\d+)"/i) || [])[1] || '',
      schema: (attrs.match(/\bschema="([^"]+)"/i) || [])[1] || '',
      base64: achado[2].replace(/\s+/g, ''),
    })
  }
  return {
    cStat,
    xMotivo: textoXml(tag(xml, 'xMotivo')),
    ultNSU: nsu15(tag(xml, 'ultNSU')),
    maxNSU: nsu15(tag(xml, 'maxNSU') || tag(xml, 'ultNSU')),
    docZips,
  }
}

function situacaoResumo(codigo) {
  if (codigo === '2') return 'denegada'
  if (codigo === '3') return 'cancelada'
  return 'autorizada'
}

export function interpretarDocumento(xmlRaw) {
  const bruto = String(xmlRaw || '')
  const xml = semNs(bruto)
  if (/<resNFe[\s>]/i.test(xml)) {
    const chave = digitos(tag(xml, 'chNFe'))
    const nums = numeroDaChave(chave)
    return {
      tipo: 'resumo',
      chave,
      numero: nums.numero,
      serie: nums.serie,
      emitente_cnpj: digitos(tag(xml, 'CNPJ') || tag(xml, 'CPF')),
      emitente_nome: textoXml(tag(xml, 'xNome')),
      emissao: String(tag(xml, 'dhEmi') || '').slice(0, 10) || null,
      valor_total: numero(tag(xml, 'vNF')),
      situacao: situacaoResumo(tag(xml, 'cSitNFe')),
    }
  }
  if (/<nfeProc[\s>]/i.test(xml) || /<NFe[\s>]/i.test(xml)) {
    try {
      const parsed = parseNfeXml(bruto)
      return {
        tipo: 'completa',
        situacao: 'autorizada',
        chave: parsed.chave,
        numero: parsed.numero,
        serie: parsed.serie,
        emissao: parsed.emissao,
        valor_total: parsed.valor_total,
        emitente_cnpj: digitos(parsed.emitente?.cnpj),
        emitente_nome: parsed.emitente?.nome || '',
        destinatario_cnpj: digitos(parsed.destinatario?.cnpj),
        nfe: parsed,
      }
    } catch (err) {
      const chave = (bruto.match(/Id=["']NFe(\d{44})["']/i) || [])[1] || ''
      const nums = numeroDaChave(chave)
      return {
        tipo: 'resumo',
        chave,
        numero: nums.numero,
        serie: nums.serie,
        emitente_cnpj: '',
        emitente_nome: '',
        emissao: null,
        valor_total: null,
        situacao: 'autorizada',
        aviso: err.message,
      }
    }
  }
  const tp = tag(xml, 'tpEvento')
  if (tp) {
    return {
      tipo: tp === '110111' || tp === '110112' ? 'cancelamento' : 'evento',
      tpEvento: tp,
      chave: digitos(tag(xml, 'chNFe')),
    }
  }
  return { tipo: 'ignorado' }
}

export function documentosDe(xmlRetorno) {
  const ret = interpretarRetorno(xmlRetorno)
  const documentos = ret.docZips.map((zip) => {
    const xml = xmlDoDocZip(zip.base64)
    return { ...interpretarDocumento(xml), nsu: zip.nsu, schema: zip.schema, xml }
  })
  return { ...ret, documentos }
}

function postar(url, corpo, tls, acao = ACAO) {
  return new Promise((resolve, reject) => {
    const destino = new URL(url)
    const req = https.request({
      protocol: destino.protocol,
      hostname: destino.hostname,
      port: 443,
      path: destino.pathname,
      method: 'POST',
      headers: {
        'content-type': `application/soap+xml; charset=utf-8; action="${acao}"`,
        accept: 'application/soap+xml, text/xml',
        'content-length': Buffer.byteLength(corpo),
      },
      minVersion: 'TLSv1.2',
      timeout: 25000,
      ...(tls || {}),
    }, (res) => {
      const partes = []
      res.on('data', (parte) => partes.push(parte))
      res.on('end', () => {
        const bruto = Buffer.concat(partes).toString('utf8')
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const falha = semNs(unescapeXml(bruto))
          const motivo = textoXml(tag(falha, 'faultstring') || tag(falha, 'Text') || tag(falha, 'xMotivo'))
          reject(new Error(motivo || `A Receita Federal recusou a consulta (${res.statusCode}).`))
          return
        }
        resolve(bruto)
      })
    })
    req.on('timeout', () => req.destroy(new Error('A Receita Federal não respondeu a tempo.')))
    req.on('error', reject)
    req.write(corpo)
    req.end()
  })
}

export async function consultarDistribuicao(tls, { cnpj, cUF, ultNSU, ambiente = 'producao' }) {
  const tpAmb = ambiente === 'homologacao' ? '2' : '1'
  const url = URLS[ambiente === 'homologacao' ? 'homologacao' : 'producao']
  const corpo = envelopeDistNsu({ cnpj, cUF, ultNSU, tpAmb })
  const bruto = await postar(url, corpo, tls)
  return documentosDe(bruto)
}

export async function consultarPorChave(tls, { cnpj, cUF, chave, ambiente = 'producao' }) {
  const tpAmb = ambiente === 'homologacao' ? '2' : '1'
  const url = URLS[ambiente === 'homologacao' ? 'homologacao' : 'producao']
  const bruto = await postar(url, envelopeConsChave({ cnpj, cUF, chave, tpAmb }), tls)
  return documentosDe(bruto)
}

export function interpretarEvento(xmlBruto) {
  const xml = semNs(unescapeXml(xmlBruto))
  const fault = textoXml(tag(xml, 'faultstring') || tag(xml, 'Text'))
  const stats = []
  const reStat = /<cStat>(\d+)<\/cStat>/gi
  let achado
  while ((achado = reStat.exec(xml)) !== null) stats.push(achado[1])
  const motivos = []
  const reMotivo = /<xMotivo>([\s\S]*?)<\/xMotivo>/gi
  while ((achado = reMotivo.exec(xml)) !== null) motivos.push(textoXml(achado[1]))
  if (!stats.length) throw new Error(fault || 'A Receita não registrou a ciência da nota.')
  const ok = stats.some((codigo) => codigo === '135' || codigo === '136' || codigo === '573')
  return {
    ok,
    cStat: stats[stats.length - 1],
    xMotivo: motivos[motivos.length - 1] || fault,
  }
}

export async function manifestarCiencia(tls, { cnpj, chave, ambiente = 'producao' }) {
  const tpAmb = ambiente === 'homologacao' ? '2' : '1'
  const { env } = eventoCiencia({
    cnpj,
    chave,
    dhEvento: dhEventoAgora(),
    tpAmb,
    keyPem: tls?.key,
    certPem: tls?.cert,
    idLote: String(Date.now()),
  })
  const url = URLS_EVENTO[ambiente === 'homologacao' ? 'homologacao' : 'producao']
  const bruto = await postar(url, envelopeEvento(env), tls, ACAO_EVENTO)
  return interpretarEvento(bruto)
}

export function xmlNfeDe(retorno) {
  const doc = (retorno?.documentos || []).find((item) => item.tipo === 'completa' && item.xml && /<NFe[\s>]/i.test(item.xml))
  return doc?.xml || ''
}

/** Nota de saída nossa (venda) não entra no gestor. Resumo da Receita é sempre destinada a nós. */
export function notaDeEntrada(doc, cnpjEmpresa) {
  const nosso = digitos(cnpjEmpresa)
  if (!doc || doc.tipo === 'ignorado' || doc.tipo === 'evento') return false
  if (doc.tipo === 'cancelamento' || doc.tipo === 'resumo') return Boolean(doc.chave)
  if (doc.tipo === 'completa') {
    const dest = digitos(doc.destinatario_cnpj)
    const emit = digitos(doc.emitente_cnpj)
    if (dest && dest === nosso) return true
    if (emit && emit === nosso && dest && dest !== nosso) return false
    return !emit || emit !== nosso
  }
  return false
}
