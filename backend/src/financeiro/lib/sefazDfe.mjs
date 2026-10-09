/**
 * Distribuição de DF-e do Ambiente Nacional (o canal da Receita / SEFAZ
 * para “notas destinadas” ao CNPJ). Exige o certificado A1 da própria empresa.
 *
 * Produção: https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx
 */
import https from 'node:https'
import { gunzipSync } from 'node:zlib'
import { parseNfeXml } from '../../services/nfeXml.js'

const URLS = {
  producao: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
}

const ACAO = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse'

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

function postar(url, corpo, tls) {
  return new Promise((resolve, reject) => {
    const destino = new URL(url)
    const req = https.request({
      protocol: destino.protocol,
      hostname: destino.hostname,
      port: 443,
      path: destino.pathname,
      method: 'POST',
      headers: {
        'content-type': `application/soap+xml; charset=utf-8; action="${ACAO}"`,
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
          reject(new Error(`A Receita Federal recusou a consulta (${res.statusCode}).`))
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
