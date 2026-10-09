import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

function soDigitos(v) {
  return String(v || '').replace(/\D/g, '')
}

function moedaBr(texto) {
  const m = String(texto || '').trim().match(/^([\d.]+),(\d{2})$/)
  if (!m) return null
  const n = Number(`${m[1].replace(/\./g, '')}.${m[2]}`)
  return Number.isFinite(n) ? n : null
}

function dataIso(br) {
  const m = String(br || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

function competenciaDe(iso) {
  if (!iso || iso.length < 10) return null
  return `${iso.slice(0, 7)}-01`
}

function limparNome(v) {
  return String(v || '').replace(/\s+/g, ' ').trim()
}

function pixCopiaCola(texto) {
  const m = String(texto || '').match(/00020101[0-9A-Za-z.+\/\-:]{20,}/)
  return m ? m[0].trim() : null
}

function linhaDigitavel(texto) {
  const m = String(texto || '').match(
    /(\d{11})\s*(\d)\s*(\d{11})\s*(\d)\s*(\d{11})\s*(\d)\s*(\d{11})\s*(\d)/,
  )
  if (!m) return null
  return `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}${m[7]}${m[8]}`
}

/** CNPJ formatado completo; se só houver raiz (8 dígitos), devolve a raiz. */
function cnpjFormatado(texto) {
  const m = String(texto || '').match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)
  if (m) return soDigitos(m[0])
  const curto = String(texto || '').match(/\b(\d{2}\.\d{3}\.\d{3})\b/)
  return curto ? soDigitos(curto[1]) : null
}

/**
 * Prefere CNPJ perto de um rótulo (Empregador, CNPJ, etc.).
 * Sem hardcode de empresa — só estrutura do documento.
 */
function cnpjPorRotulo(texto, rotulos) {
  for (const rotulo of rotulos) {
    const re = new RegExp(
      `${rotulo}[^\\d]{0,80}?(\\d{2}\\.\\d{3}\\.\\d{3}\\/\\d{4}-\\d{2}|\\d{2}\\.\\d{3}\\.\\d{3})`,
      'i',
    )
    const m = String(texto || '').match(re)
    if (m) return soDigitos(m[1])
  }
  return cnpjFormatado(texto)
}

function parseGfd(texto) {
  if (!/Guia do FGTS Digital|GFD\s*-\s*Guia/i.test(texto)) return null
  const valor =
    moedaBr((texto.match(/Valor a recolher\s*([\d.]+,\d{2})/i) || [])[1])
    ?? moedaBr((texto.match(/Total da Guia:\s*([\d.]+,\d{2})/i) || [])[1])
  const venc = dataIso((texto.match(/Pagar este documento at[eé]\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1])
  const id = ((texto.match(/Identificador\s*([0-9-]+)/i) || [])[1] || '').trim()
  const tag = limparNome((texto.match(/Tag\s*\n?\s*([^\n]+)/i) || [])[1])
  const empregador = limparNome((texto.match(/Nome\/Raz[aã]o Social do Empregador\s*\n?\s*([^\n]+)/i) || [])[1])
  const pix = pixCopiaCola(texto)
  if (!valor || !venc) return null
  return {
    tipo: 'gfd',
    descricao: `GFD FGTS — ${tag || empregador || 'guia'}`.slice(0, 200),
    valor,
    vencimento: venc,
    competencia: competenciaDe(venc),
    cnpj: cnpjPorRotulo(texto, [
      'CPF\\/CNPJ do Empregador',
      'CNPJ do Empregador',
      'Empregador',
    ]),
    razao_social: empregador || null,
    forma_pagamento: pix ? 'chave_pix' : 'guia',
    dados_pagamento: pix || null,
    documento_ref: id ? `GFD|${id}` : `GFD|${venc}|${valor}`,
  }
}

function parseDarf(texto) {
  if (!/Documento de Arrecada|Receitas Federais|PGFN-SISPAR|Documento de Arrecadação/i.test(texto)) return null
  const valor =
    moedaBr((texto.match(/Valor Total do Documento\s*([\d.]+,\d{2})/i) || [])[1])
    ?? moedaBr((texto.match(/Valor:\s*([\d.]+,\d{2})/i) || [])[1])
  const venc = dataIso(
    (texto.match(/Pagar (?:este documento )?at[eé]:?\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1],
  )
  const numero = (
    (texto.match(/N[uú]mero(?: do Documento)?:?\s*([\d.-]+)/i) || [])[1]
    || (texto.match(/(\d{2}\.\d{2}\.\d+\.\d+-\d)/) || [])[1]
    || ''
  ).trim()
  const sispar = ((texto.match(/PGFN-SISPAR:([0-9.]+)/i) || [])[1] || '').trim()
  const razao = limparNome(
    (texto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+([^\n]{5,100})/i) || [])[1],
  )
  const codigo = linhaDigitavel(texto)
  if (!valor || !venc) return null
  return {
    tipo: 'darf',
    descricao: `DARF/PGFN${sispar ? ` ${sispar}` : ''} — ${razao || 'arrecadação'}`.slice(0, 200),
    valor,
    vencimento: venc,
    competencia: competenciaDe(venc),
    cnpj: cnpjPorRotulo(texto, ['CNPJ', 'Raz[aã]o Social']),
    razao_social: razao || null,
    forma_pagamento: 'guia',
    dados_pagamento: codigo,
    documento_ref: numero ? `DARF|${numero}` : `DARF|${sispar || venc}|${valor}`,
  }
}

function parseTrct(texto) {
  if (!/TERMO DE RESCIS|VALOR L[IÍ]QUIDO/i.test(texto) || !/CONTRATO DE TRABALHO/i.test(texto)) return null
  const valorMatch = texto.match(/VALOR L[IÍ]QUIDO\s*(?:R\$\s*)?([\d.]+,\d{2})/i)
    || texto.match(/VALOR L[IÍ]QUIDO\s*\n\s*R\$\s*([\d.]+,\d{2})/i)
  const valor = moedaBr((valorMatch || [])[1])
  // pdf-parse às vezes cola as 3 datas: dd/mm/aaaa + aviso + afastamento
  const trio = texto.match(/Data de Afastamento[\s\S]{0,60}?(\d{2}\/\d{2}\/\d{4})\s*(\d{2}\/\d{2}\/\d{4})\s*(\d{2}\/\d{2}\/\d{4})/i)
    || texto.match(/(\d{2}\/\d{2}\/\d{4})\s*(\d{2}\/\d{2}\/\d{4})\s*(\d{2}\/\d{2}\/\d{4})/)
  const afast = trio ? trio[3] : null
  const venc = dataIso(afast)
  const nome = limparNome((texto.match(/11 Nome\s*\n?\s*([^\n]+)/i) || [])[1])
  const cpf = soDigitos((texto.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/) || [])[1])
  const empregador = limparNome((texto.match(/02 Raz[aã]o Social\/Nome\s*\n?\s*([^\n]+)/i) || [])[1])
  if (!valor || !venc) return null
  return {
    tipo: 'trct',
    descricao: `Rescisão — ${nome || empregador || 'TRCT'}`.slice(0, 200),
    valor,
    vencimento: venc,
    competencia: competenciaDe(venc),
    cnpj: cnpjPorRotulo(texto, ['01 CNPJ\\/CEI', 'CNPJ\\/CEI', 'CNPJ']),
    razao_social: empregador || null,
    forma_pagamento: 'folha',
    dados_pagamento: null,
    documento_ref: `TRCT|${cpf || nome || 'sem-cpf'}|${venc}`,
  }
}

/** Nome do empregado no arquivo, sem amarrar a loja específica. */
function nomeDoArquivo(nomeArquivo) {
  const base = String(nomeArquivo || '').replace(/\.[^.]+$/, '')
  // Recibo_de_Ferias_-_NOME_COMPLETO_-_QUALQUER_EMPRESA
  const m = base.match(
    /(?:Recibo|F[eé]rias|GFD|RCT|TRCT|DARF|PGFN).*?[_-]{1,3}([A-Za-zÁÉÍÓÚáéíóúÃÕãõÂÊÔâêôÇç][A-Za-zÁÉÍÓÚáéíóúÃÕãõÂÊÔâêôÇç _-]{4,80}?)(?:[_-]{1,3}[A-Za-z].*)?$/i,
  )
  if (!m) return ''
  let bruto = m[1].replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  // tira sufixo típico de empresa no fim do trecho (última palavra em MAIÚSCULAS sozinha não)
  bruto = bruto.replace(/\s+(LTDA|ME|EIRELI|SA|S\/A)$/i, '').trim()
  return bruto.length >= 5 ? bruto : ''
}

function parseFerias(texto, nomeArquivo = '') {
  if (!/RECIBO DE F[EÉ]RIAS|AVISO DE F[EÉ]RIAS/i.test(texto)) return null
  const valor =
    moedaBr((texto.match(/TOTAL LIQUIDO:\s*([\d.]+,\d{2})/i) || [])[1])
    ?? moedaBr((texto.match(/import[aâ]ncia l[ií]quida de R\$\s*([\d.]+,\d{2})/i) || [])[1])
  const venc = dataIso(
    (texto.match(/disposi[cç][aã]o em\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1]
    || (texto.match(/CIENTE,\s*Data:\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1],
  )
  const empresaLinha = limparNome((texto.match(/Empresa:\s*\n?\s*([^\n]+)/i) || [])[1])
  const doTexto = limparNome(
    (texto.match(/CIENTE,\s*Data:\s*\d{2}\/\d{2}\/\d{4}\s*\n\s*([^\n]{6,80})/i) || [])[1]
    || (texto.match(/Nome Empregado:\s*\n?\s*([^\n]{5,80})/i) || [])[1]
    || (texto.match(/([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ][A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ ]{6,60}?)C[oó]digo:\s*\d+/i) || [])[1]
    // "NOME EMPRESA LTDA" → pega o nome antes da razão social do CNPJ block
    || (texto.match(/\n([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ][A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ ]{6,60})\n[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ].{0,40}\nCNPJ:/i) || [])[1]
    || (empresaLinha
      ? (texto.match(new RegExp(`([A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ][A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ ]{6,60})\\s+${empresaLinha.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')) || [])[1]
      : null)
    || '',
  )
  const nomeOk = doTexto || nomeDoArquivo(nomeArquivo)
  if (!valor || !venc) return null
  const cnpj = cnpjPorRotulo(texto, ['CNPJ:', 'CNPJ'])
  return {
    tipo: 'ferias',
    descricao: `Férias — ${nomeOk || 'recibo'}`.slice(0, 200),
    valor,
    vencimento: venc,
    competencia: competenciaDe(venc),
    cnpj,
    razao_social: empresaLinha || null,
    forma_pagamento: 'folha',
    dados_pagamento: null,
    documento_ref: `FERIAS|${cnpj || 'sem-cnpj'}|${(nomeOk || 'sem-nome').slice(0, 40)}|${venc}`,
  }
}

export async function lerTextoPdf(buffer) {
  const data = await pdfParse(buffer)
  return String(data?.text || '')
}

/** Extrai campos de GFD, DARF/PGFN, TRCT ou recibo de férias. */
export function classificarPdfDespesa(texto, nomeArquivo = '') {
  const bruto = String(texto || '')
  if (!bruto.trim()) {
    throw Object.assign(new Error('PDF sem texto legível (pode ser imagem escaneada).'), { status: 400 })
  }
  const parsed =
    parseGfd(bruto)
    || parseDarf(bruto)
    || parseTrct(bruto)
    || parseFerias(bruto, nomeArquivo)
  if (!parsed) {
    throw Object.assign(
      new Error(`PDF não reconhecido (${nomeArquivo || 'arquivo'}). Aceitos: GFD FGTS, DARF/PGFN, TRCT e recibo de férias.`),
      { status: 400 },
    )
  }
  if (!(parsed.valor > 0)) {
    throw Object.assign(new Error('Não achou o valor no PDF.'), { status: 400 })
  }
  return parsed
}

export async function parsePdfDespesa(buffer, nomeArquivo = '') {
  const texto = await lerTextoPdf(buffer)
  return classificarPdfDespesa(texto, nomeArquivo)
}
