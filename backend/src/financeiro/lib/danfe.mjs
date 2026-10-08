import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { gerarPDF } = require('nfe-danfe-pdf')

function prepararXml(xml) {
  let raw = String(xml || '').replace(/^\uFEFF/, '').trim()
  if (!raw || raw.startsWith('{') || !/<NFe[\s>]|<nfeProc[\s>]/i.test(raw)) {
    throw new Error('O XML dessa nota não está disponível.')
  }
  if (!/<(?:\w+:)?pag[\s>]/i.test(raw)) {
    raw = raw.replace(
      /<\/(?:\w+:)?infNFe>/i,
      '<pag><detPag><indPag>0</indPag><tPag>99</tPag><vPag>0.00</vPag></detPag></pag></infNFe>',
    )
  }
  if (!/<nfeProc[\s>]/i.test(raw)) {
    const inner = raw.replace(/^<\?xml[^?]*\?>/i, '').trim()
    raw = `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00">${inner}</nfeProc>`
  }
  return raw
}

function paraBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

export async function gerarDanfe(xml) {
  const doc = await gerarPDF(prepararXml(xml), { textoRodape: 'Grupo Alvim' })
  const buf = await paraBuffer(doc)
  if (!buf.length) throw new Error('Não gerou o PDF da nota.')
  return buf
}
