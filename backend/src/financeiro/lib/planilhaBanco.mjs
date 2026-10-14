import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'

const ORDEM = [
  ['REI'],
  ['LORD'],
  ['IMPERADOR'],
  ['PRINCIPE'],
  ['GLADIADOR'],
  ['DUQUE'],
  ['FELICA'],
  ['ARQUIDUQUE'],
  ['ESCUDEIRO'],
  ['CAVALEIRO'],
  ['VISCONDE'],
  ['SENHOR'],
  ['REGENTE'],
  ['BARAO'],
  ['ARQUEIRO'],
  ['CAPITAO'],
  ['IMPERATRIZ'],
  ['RAINHA'],
  ['CONDESSA'],
  ['POPVAL', 'POP VAL', 'POPOYES', 'POPEYES', 'POPOYES VAL'],
  ['DONZELA'],
  ['DAMA'],
  ['KING ASSESSORIA', 'KING'],
  ['SUPER KING'],
  ['ALVIM GESTAO'],
  ['ALVIM PARTICIPACOES'],
]

const ROTULO = {
  REI: 'REI ALVIM',
  LORD: 'LORD ALVIM',
  IMPERADOR: 'IMPERADOR ALVIM',
  PRINCIPE: 'PRINCIPE ALVIM',
  GLADIADOR: 'GLADIADOR',
  DUQUE: 'DUQUE ALVIM',
  FELICA: 'FELICA',
  ARQUIDUQUE: 'ARQUIDUQUE ALVIM',
  ESCUDEIRO: 'ESCUDEIRO ALVIM',
  CAVALEIRO: 'CAVALEIRO ALVIM',
  VISCONDE: 'VISCONDE ALVIM',
  SENHOR: 'SENHOR ALVIM',
  REGENTE: 'REGENTE ALVIM',
  BARAO: 'BARÃO ALVIM',
  ARQUEIRO: 'ARQUEIRO ALVIM',
  CAPITAO: 'CAPITÃO ALVIM',
  IMPERATRIZ: 'IMPERATRIZ ALVIM',
  RAINHA: 'RAINHA ALVIM',
  CONDESSA: 'CONDESSA ALVIM',
  POPVAL: 'POPOYES VAL',
  DONZELA: 'DONZELA ALVIM',
  DAMA: 'DAMA ALVIM',
  KING: 'KING ASSESSORIA',
  'SUPER KING': 'SUPER KING',
  'ALVIM GESTAO': 'ALVIM GESTÃO',
  'ALVIM PARTICIPACOES': 'ALVIM PARTICIPAÇÕES',
}

const SEM_NF = new Set(['FELICA', 'KING', 'SUPER KING', 'ALVIM GESTAO', 'ALVIM PARTICIPACOES', 'LEC', 'ALVIM HOLDINGS', 'SEMPER'])
const LOGO = join(dirname(fileURLToPath(import.meta.url)), '../assets/logo-banco.jpg')

const AZUL = 'FF8DB3E2'
const LARANJA = 'FFFABF8F'
const AMARELO = 'FFFFC000'
const ROSA_USA = 'FFF2DBDB'
const BRANCO = 'FFFFFFFF'
const PRETO = 'FF000000'

const FMT_REAL = '" R$ "* #,##0.00" ";"-R$ "* #,##0.00" ";" R$ "* "-"??" "'
const FMT_TOTAL_BR = '" "[$R$-416]" "* #,##0.00" ";"-"[$R$-416]" "* #,##0.00" ";" "[$R$-416]" "* "-"??" "'
const FMT_DOLAR = '" ""$"* #,##0.00" ";" ""$"* "-"#,##0.00" ";" ""$"* "-"??" "'
const FMT_DATA = 'd-mmm'

const bordaFina = {
  top: { style: 'thin', color: { argb: PRETO } },
  left: { style: 'thin', color: { argb: PRETO } },
  bottom: { style: 'thin', color: { argb: PRETO } },
  right: { style: 'thin', color: { argb: PRETO } },
}

function normalizar(nome) {
  return String(nome || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

const CHAVES = ORDEM.flatMap((chaves, ordem) => chaves.map((chave) => ({ chave: normalizar(chave), ordem })))
  .sort((a, b) => b.chave.length - a.chave.length)

function ordemDe(nome) {
  const n = normalizar(nome)
  if (!n) return ORDEM.length
  const achou = CHAVES.find((item) => n === item.chave || n.startsWith(`${item.chave} `))
  return achou ? achou.ordem : ORDEM.length
}

function chaveEmpresa(empresa) {
  const nomes = [empresa?.apelido, empresa?.razao_social].filter(Boolean)
  let melhor = ORDEM.length
  let chave = normalizar(empresa?.apelido || empresa?.razao_social || '')
  for (const nome of nomes) {
    const n = normalizar(nome)
    const achou = CHAVES.find((item) => n === item.chave || n.startsWith(`${item.chave} `))
    if (achou && achou.ordem < melhor) {
      melhor = achou.ordem
      chave = achou.chave
    }
  }
  return chave
}

export function rotuloEmpresa(empresa) {
  const chave = chaveEmpresa(empresa)
  if (ROTULO[chave]) return ROTULO[chave]
  const apelido = String(empresa?.apelido || '').trim()
  if (apelido) return apelido
  return String(empresa?.razao_social || 'SEM EMPRESA').trim()
}

function semNf(empresa) {
  return SEM_NF.has(chaveEmpresa(empresa))
}

function diaBr(iso, sep = '/') {
  const [ano, mes, dia] = String(iso || '').slice(0, 10).split('-')
  if (!ano || !mes || !dia) return ''
  return `${dia}${sep}${mes}`
}

function serialExcel(iso) {
  const [ano, mes, dia] = String(iso || '').slice(0, 10).split('-').map(Number)
  if (!ano || !mes || !dia) return null
  const utc = Date.UTC(ano, mes - 1, dia)
  const epoch = Date.UTC(1899, 11, 30)
  return Math.round((utc - epoch) / 86400000)
}

function dinheiro(valor) {
  return Math.round(Number(valor) * 100) / 100
}

function nomeFornecedor(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (/^(FREE|TREIN|PASSAG|REEMB|RESCISAO|RESCISÃO|FERIAS|FÉRIAS|MULTA)\b/i.test(t)) return t
  const n = normalizar(t)
  const partes = t.split(' ')
  if (partes.length > 1 && /\b(LTDA|SA|EIRELI|EPP|ME|DISTRIBUICAO|DISTRIBUIDORA|COMERCIO|SERVICOS|ENERGIA|TELECOMUNICACOES|INDUSTRIA)\b/.test(n)) {
    return partes[0]
  }
  return t
}

function descricaoLinha(linha) {
  const texto = String(linha.descricao || '').replace(/\s+/g, ' ').trim()
  if (linha.fonte !== 'freecontrol') return nomeFornecedor(texto)
  if (/^(FREE|TREIN|PASSAG|REEMB|RESCISAO|FERIAS)\b/i.test(texto)) return nomeFornecedor(texto)
  if (linha.freecontrol_tipo === 'treinamento') return nomeFornecedor(`TREIN ${texto}`.trim())
  if (linha.freecontrol_tipo === 'freelance') return nomeFornecedor(`FREE ${texto}`.trim())
  return nomeFornecedor(texto)
}

function codigoLinha(linha) {
  const forma = String(linha.forma_pagamento || '')
  const pagamento = String(linha.pagamento || '').trim()
  if (forma === 'folha' || /^folha(\s+(pagamento|cadastrada))?$/i.test(pagamento)) return 'FOLHA CADASTRADA'
  if (pagamento && !/^(BANCO|FC|DDA)\|/.test(pagamento)) return pagamento
  const doc = String(linha.documento_ref || '').replace(/\D/g, '')
  if (doc.length >= 44 && doc.length <= 48) return doc
  return ''
}

function colunaNf(linha, empresa) {
  if (semNf(empresa)) {
    const registro = String(linha.registrado_em || '').trim()
    if (registro && normalizar(registro) !== normalizar(empresa?.apelido)) {
      return rotuloEmpresa({ apelido: registro })
    }
    return ''
  }
  return String(linha.numero_nf || '').trim()
}

function ordenarEmpresas(empresas) {
  return [...empresas].sort((a, b) => {
    const diff = ordemDe(a.apelido || a.razao_social) - ordemDe(b.apelido || b.razao_social)
    if (diff) return diff
    return rotuloEmpresa(a).localeCompare(rotuloEmpresa(b), 'pt-BR')
  })
}

function pintar(celula, { fill, nome = 'Calibri', tamanho = 12, fmt, alinhamento = 'center', negrito = false, borda = true }) {
  celula.alignment = { vertical: 'middle', horizontal: alinhamento }
  celula.font = { name: nome, size: tamanho, bold: negrito, color: { argb: PRETO } }
  if (fill) celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
  if (fmt) celula.numFmt = fmt
  if (borda) celula.border = bordaFina
}

export function nomeArquivoPlanilha(de, ate) {
  return `BANCO ${diaBr(de, '.')} A ${diaBr(ate, '.')}.xlsx`
}

export async function montarPlanilhaBanco({ de, ate, empresas, linhas }) {
  const grupos = new Map()
  for (const linha of linhas || []) {
    const chave = String(linha.origem_id || linha.apelido || '')
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(linha)
  }

  const blocos = ordenarEmpresas(empresas || []).filter((empresa) => {
    const itens = grupos.get(empresa.id) || grupos.get(empresa.apelido) || []
    return itens.length > 0
  })

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Meridian'
  const ws = wb.addWorksheet('Plan1', {
    views: [{ showGridLines: false, zoomScale: 120, zoomScaleNormal: 120, showRowColHeaders: true }],
    properties: { defaultRowHeight: 15 },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  })

  ws.columns = [
    { width: 16.57 },
    { width: 38.57 },
    { width: 25.29 },
    { width: 17.29 },
    { width: 67.86 },
  ]

  ws.mergeCells('B1:C4')
  ws.mergeCells('D1:E1')
  ws.mergeCells('D4:E4')
  const titulo = ws.getCell('B1')
  titulo.value = `BANCO ${diaBr(de)} A ${diaBr(ate)}`
  titulo.font = { name: 'Arial', size: 14, bold: true, color: { argb: PRETO } }
  titulo.alignment = { vertical: 'middle', horizontal: 'center' }
  titulo.numFmt = '@'
  ws.getRow(1).height = 15
  ws.getRow(2).height = 16.5
  ws.getRow(3).height = 16.5
  ws.getRow(4).height = 15

  pintar(ws.getCell('D2'), { fill: BRANCO, nome: 'Arial', tamanho: 10, negrito: true, alinhamento: 'left', fmt: '@' })
  ws.getCell('D2').value = 'TOTAL BR'
  pintar(ws.getCell('E2'), { fill: AMARELO, negrito: true, fmt: FMT_TOTAL_BR })

  pintar(ws.getCell('D3'), { fill: BRANCO, nome: 'Arial', tamanho: 10, negrito: true, alinhamento: 'left', fmt: '@' })
  ws.getCell('D3').value = 'TOTAL USA'
  pintar(ws.getCell('E3'), { fill: ROSA_USA, negrito: true, fmt: FMT_DOLAR })
  ws.getCell('E3').value = 0

  if (existsSync(LOGO)) {
    const logoId = wb.addImage({ buffer: readFileSync(LOGO), extension: 'jpeg' })
    ws.addImage(logoId, {
      tl: { col: 0.08, row: 0.05 },
      ext: { width: 118, height: 68 },
      editAs: 'oneCell',
    })
  }

  const totais = []
  let somaGeral = 0
  let cursor = 5

  for (const empresa of blocos) {
    const itens = (grupos.get(empresa.id) || grupos.get(empresa.apelido) || [])
      .slice()
      .sort((a, b) => dinheiro(b.valor) - dinheiro(a.valor) || String(a.vencimento).localeCompare(String(b.vencimento)) || descricaoLinha(a).localeCompare(descricaoLinha(b), 'pt-BR'))
    const nome = rotuloEmpresa(empresa)
    const cabecalho = semNf(empresa)
      ? ['', nome, 'VALOR', ' VENCIMENTO', 'CÓDIGO']
      : ['NF', nome, 'VALOR', ' VENCIMENTO', 'CÓDIGO']

    const linhaCab = ws.getRow(cursor)
    linhaCab.height = 15
    cabecalho.forEach((texto, col) => {
      const celula = linhaCab.getCell(col + 1)
      celula.value = texto
      pintar(celula, { fill: AZUL, nome: 'Arial', negrito: col !== 2 })
      celula.numFmt = '@'
    })
    cursor += 1
    ws.getRow(cursor).height = 15
    cursor += 1

    const inicioDados = cursor
    for (const item of itens) {
      const valor = dinheiro(item.valor)
      somaGeral += valor
      const linha = ws.getRow(cursor)
      linha.height = 15
      const valores = [colunaNf(item, empresa), descricaoLinha(item), valor, serialExcel(item.vencimento), codigoLinha(item)]
      const fundos = [BRANCO, LARANJA, LARANJA, LARANJA, BRANCO]
      const negritos = [false, true, false, true, true]
      const formatos = [undefined, undefined, FMT_REAL, FMT_DATA, '@']
      valores.forEach((valorCelula, col) => {
        const celula = linha.getCell(col + 1)
        celula.value = valorCelula === null || valorCelula === '' ? null : valorCelula
        pintar(celula, { fill: fundos[col], negrito: negritos[col], fmt: formatos[col] })
      })
      cursor += 1
    }
    const fimDados = cursor - 1

    const linhaTotal = ws.getRow(cursor)
    linhaTotal.height = 15.8
    for (let col = 1; col <= 5; col += 1) pintar(linhaTotal.getCell(col), { fill: AZUL })
    linhaTotal.getCell(2).value = 'TOTAL '
    pintar(linhaTotal.getCell(2), { fill: AZUL, nome: 'Arial', negrito: true })
    const celulaSoma = linhaTotal.getCell(3)
    const somaBloco = dinheiro(itens.reduce((acc, item) => acc + dinheiro(item.valor), 0))
    if (itens.length) {
      celulaSoma.value = { formula: `SUM(C${inicioDados}:C${fimDados})`, result: somaBloco }
      totais.push(`C${cursor}`)
    } else {
      celulaSoma.value = 0
    }
    pintar(celulaSoma, { fill: AZUL, fmt: FMT_REAL })
    pintar(linhaTotal.getCell(4), { fill: AZUL, negrito: true, tamanho: 11 })
    pintar(linhaTotal.getCell(5), { fill: AZUL, negrito: true, tamanho: 11, fmt: '@' })
    cursor += 1
    ws.getRow(cursor).height = 15
    cursor += 1
  }

  const totalBr = ws.getCell('E2')
  if (totais.length) {
    totalBr.value = { formula: `SUM(${totais.join(',')})`, result: dinheiro(somaGeral) }
  } else {
    totalBr.value = 0
  }
  totalBr.numFmt = FMT_TOTAL_BR

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
