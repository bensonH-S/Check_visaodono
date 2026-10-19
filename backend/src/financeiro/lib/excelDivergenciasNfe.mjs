import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'

/** Pegada CentralGA Intelligence Platform */
const PRETO = 'FF000000'
const LINHA_A = 'FF1C1C1C'
const LINHA_B = 'FF121212'
const LARANJA = 'FFFF6A00'
const BRANCO = 'FFFFFFFF'
const CINZA = 'FFA6A6A6'

const FMT_MOEDA = '"R$"#,##0.00'
const FMT_QTD = '#,##0.###'
const FMT_PCT = '0.0%'

const LOGO = join(dirname(fileURLToPath(import.meta.url)), '../assets/centralga-logo.png')

const borda = {
  top: { style: 'thin', color: { argb: 'FF333333' } },
  left: { style: 'thin', color: { argb: 'FF333333' } },
  bottom: { style: 'thin', color: { argb: 'FF333333' } },
  right: { style: 'thin', color: { argb: 'FF333333' } },
}

function numOrNull(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function textoOuNum(v) {
  if (v == null || v === '') return null
  const s = String(v).trim()
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s)
  return s
}

function pintarCabecalho(celula) {
  celula.font = { name: 'Arial', size: 10, bold: true, color: { argb: BRANCO } }
  celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } }
  celula.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
  celula.border = borda
}

function pintarDado(celula, { fill, numFmt, align = 'left', bold = false, cor = BRANCO } = {}) {
  celula.font = { name: 'Arial', size: 10, bold, color: { argb: cor } }
  celula.alignment = {
    vertical: 'middle',
    horizontal: align,
    wrapText: false,
    shrinkToFit: align === 'left',
  }
  celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill || LINHA_A } }
  if (numFmt) celula.numFmt = numFmt
  celula.border = borda
}

function pintarPreto(ws, ateLinha, cols) {
  for (let r = 1; r <= ateLinha; r += 1) {
    for (let c = 1; c <= cols; c += 1) {
      const cell = ws.getRow(r).getCell(c)
      if (!cell.fill) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRETO } }
      }
    }
  }
}

function cabecalhoPagina(ws, titulo, subtitulo, nCols) {
  for (let r = 1; r <= 8; r += 1) {
    ws.getRow(r).height = r <= 4 ? 14 : r === 7 ? 28 : 16
    for (let c = 1; c <= nCols; c += 1) {
      ws.getRow(r).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRETO } }
    }
  }
  const t = ws.getCell(7, 1)
  t.value = titulo
  t.font = { name: 'Arial', size: 16, bold: true, color: { argb: BRANCO } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRETO } }
  t.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }

  const s = ws.getCell(8, 1)
  s.value = subtitulo
  s.font = { name: 'Arial', size: 9, color: { argb: CINZA } }
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRETO } }
  s.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
}

function logo(wb, ws, logoId) {
  if (logoId == null) return
  ws.addImage(logoId, {
    tl: { col: 0.1, row: 0.15 },
    ext: { width: 200, height: 48 },
    editAs: 'oneCell',
  })
}

function escreverTabela(ws, inicio, colunas, linhas, { accentKey = null } = {}) {
  ws.columns = colunas.map((c) => ({ width: c.width, key: c.key }))

  const header = ws.getRow(inicio)
  header.height = 22
  colunas.forEach((col, idx) => {
    const cell = header.getCell(idx + 1)
    cell.value = col.header
    pintarCabecalho(cell)
  })

  linhas.forEach((linha, i) => {
    const row = ws.getRow(inicio + 1 + i)
    row.height = 20
    const fill = i % 2 === 0 ? LINHA_A : LINHA_B
    colunas.forEach((col, idx) => {
      const cell = row.getCell(idx + 1)
      let val = linha[col.key]
      if (col.asNumber) val = numOrNull(val)
      else if (col.asTextoOuNum) val = textoOuNum(val)
      cell.value = val ?? null
      const destaque = accentKey && col.key === accentKey
      pintarDado(cell, {
        fill,
        numFmt: col.numFmt,
        align: col.align || (col.numFmt || col.asNumber ? 'right' : 'left'),
        bold: !!destaque,
        cor: destaque ? LARANJA : BRANCO,
      })
    })
  })

  if (!linhas.length) {
    const row = ws.getRow(inicio + 1)
    row.height = 20
    row.getCell(1).value = 'Sem registros neste período'
    pintarDado(row.getCell(1), { fill: LINHA_A, cor: CINZA, bold: true })
  }

  const lastData = inicio + Math.max(linhas.length, 1)
  // Sem autoFilter: no tema escuro o botão de filtro vira um quadrado branco sobre o cabeçalho.
  ws.views = [{ state: 'frozen', ySplit: inicio, showGridLines: false }]
  return lastData
}

function kpi(ws, rLab, rVal, col, label, value, { numFmt, cor = LARANJA } = {}) {
  const lab = ws.getCell(rLab, col)
  lab.value = label
  lab.font = { name: 'Arial', size: 8, bold: true, color: { argb: CINZA } }
  lab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LINHA_A } }
  lab.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
  lab.border = borda

  const val = ws.getCell(rVal, col)
  val.value = value
  val.font = { name: 'Arial', size: 16, bold: true, color: { argb: cor } }
  val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LINHA_A } }
  val.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
  if (numFmt) val.numFmt = numFmt
  val.border = borda
}

function rotuloStatusEntrega(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'aguardando_conferencia') return 'NF Pendente'
  if (s === 'em_transito' || s === 'aguardando_portal') return 'NF Pendente'
  return status || '—'
}

function dataHojeBr() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())
}

export async function montarExcelDivergenciasNfe(data) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CentralGA'
  wb.created = new Date()

  let logoId = null
  if (existsSync(LOGO)) {
    logoId = wb.addImage({ buffer: readFileSync(LOGO), extension: 'png' })
  }

  const sub = `Conferência de recebimento · gerado em ${dataHojeBr()} · CentralGA Intelligence Platform`
  const totais = data.totais || {}
  const porLoja = (data.por_loja || []).map((r) => ({
    loja: r.loja,
    nfs: Number(r.nfs) || 0,
    itens_faltantes: Number(r.itens_faltantes) || 0,
    valor_faltante: Number(r.valor_faltante) || 0,
  }))
  const valorFaltanteTotal = porLoja.reduce((s, r) => s + r.valor_faltante, 0)
  const valorNfTotal = (data.por_nf || []).reduce((s, r) => s + (Number(r.valor_nf) || 0), 0)
  const pct = valorNfTotal > 0 ? valorFaltanteTotal / valorNfTotal : 0

  // ——— Resumo ———
  {
    const ws = wb.addWorksheet('Resumo', {
      properties: { defaultRowHeight: 18, tabColor: { argb: LARANJA } },
      views: [{ showGridLines: false }],
    })
    // Larguras alinhadas à mini-tabela (sem colunas spacer estreitas que esmagavam "Itens"/"Valor").
    ws.columns = [
      { width: 34 },
      { width: 10 },
      { width: 14 },
      { width: 16 },
      { width: 12 },
    ]
    logo(wb, ws, logoId)
    cabecalhoPagina(ws, 'Resumo executivo', sub, 5)

    ws.mergeCells('A11:B11')
    ws.mergeCells('A12:B12')
    ws.mergeCells('D11:E11')
    ws.mergeCells('D12:E12')
    ws.mergeCells('A14:B14')
    ws.mergeCells('A15:B15')
    ws.mergeCells('D14:E14')
    ws.mergeCells('D15:E15')

    kpi(ws, 11, 12, 1, 'VALOR FALTANTE (R$)', valorFaltanteTotal, { numFmt: FMT_MOEDA })
    kpi(ws, 11, 12, 4, '% DO VALOR DAS NFs', pct, { numFmt: FMT_PCT })
    kpi(ws, 14, 15, 1, 'NFs COM DIVERGÊNCIA', totais.nfs ?? (data.por_nf || []).length, { cor: BRANCO })
    kpi(ws, 14, 15, 4, 'ITENS FALTANTES', totais.linhas ?? (data.itens || []).length, { cor: BRANCO })
    // 3º KPI na coluna C (sem conflitar com spacer)
    {
      const lab = ws.getCell(11, 3)
      lab.value = 'LOJAS AFETADAS'
      lab.font = { name: 'Arial', size: 8, bold: true, color: { argb: CINZA } }
      lab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LINHA_A } }
      lab.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
      lab.border = borda
      const val = ws.getCell(12, 3)
      val.value = porLoja.length
      val.font = { name: 'Arial', size: 16, bold: true, color: { argb: BRANCO } }
      val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LINHA_A } }
      val.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
      val.border = borda
    }
    {
      const lab = ws.getCell(14, 3)
      lab.value = 'VALOR TOTAL NFs'
      lab.font = { name: 'Arial', size: 8, bold: true, color: { argb: CINZA } }
      lab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LINHA_A } }
      lab.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
      lab.border = borda
      const val = ws.getCell(15, 3)
      val.value = valorNfTotal
      val.font = { name: 'Arial', size: 16, bold: true, color: { argb: BRANCO } }
      val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LINHA_A } }
      val.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
      val.numFmt = FMT_MOEDA
      val.border = borda
    }
    ws.getRow(12).height = 36
    ws.getRow(15).height = 36

    const tit = ws.getCell(17, 1)
    tit.value = 'Valor faltante por loja'
    tit.font = { name: 'Arial', size: 11, bold: true, color: { argb: BRANCO } }
    tit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRETO } }

    const ordenado = porLoja
      .slice()
      .sort((a, b) => b.valor_faltante - a.valor_faltante)
      .map((r) => ({
        ...r,
        pct: valorFaltanteTotal > 0 ? r.valor_faltante / valorFaltanteTotal : 0,
      }))
    const h = ws.getRow(18)
    h.height = 22
    ;['Loja', 'NFs', 'Itens faltantes', 'Valor faltante', '% do total'].forEach((header, i) => {
      const cell = h.getCell(i + 1)
      cell.value = header
      pintarCabecalho(cell)
    })
    ordenado.forEach((r, i) => {
      const row = ws.getRow(19 + i)
      row.height = 20
      const fill = i % 2 === 0 ? LINHA_A : LINHA_B
      ;[r.loja, r.nfs, r.itens_faltantes, r.valor_faltante, r.pct].forEach((v, idx) => {
        const cell = row.getCell(idx + 1)
        cell.value = typeof v === 'number' ? v : v
        pintarDado(cell, {
          fill,
          numFmt: idx === 3 ? FMT_MOEDA : idx === 4 ? FMT_PCT : undefined,
          align: idx === 0 ? 'left' : idx <= 2 ? 'center' : 'right',
          cor: idx === 3 ? LARANJA : BRANCO,
          bold: idx === 3,
        })
      })
    })
    const rodape = ws.getCell(20 + ordenado.length, 1)
    rodape.value = 'Fonte: conferência de recebimento · Meridian / CentralGA'
    rodape.font = { name: 'Arial', size: 8, color: { argb: CINZA } }
    rodape.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRETO } }
    pintarPreto(ws, Math.max(28, 22 + ordenado.length), 5)
  }

  function aba(nome, titulo, colunas, linhas, opts) {
    const ws = wb.addWorksheet(nome, {
      properties: { defaultRowHeight: 20, tabColor: { argb: LARANJA } },
    })
    logo(wb, ws, logoId)
    cabecalhoPagina(ws, titulo, sub, colunas.length)
    const fim = escreverTabela(ws, 10, colunas, linhas, opts)
    pintarPreto(ws, Math.max(fim + 2, 14), colunas.length)
  }

  aba(
    'Por loja',
    'Divergências por loja',
    [
      { header: 'Loja', key: 'loja', width: 36 },
      { header: 'NFs', key: 'nfs', width: 10, asNumber: true, align: 'center' },
      { header: 'Itens faltantes', key: 'itens_faltantes', width: 16, asNumber: true, align: 'center' },
      { header: 'Valor faltante', key: 'valor_faltante', width: 16, asNumber: true, numFmt: FMT_MOEDA },
      { header: '% do total', key: 'pct', width: 12, asNumber: true, numFmt: FMT_PCT },
    ],
    porLoja
      .slice()
      .sort((a, b) => b.valor_faltante - a.valor_faltante)
      .map((r) => ({
        ...r,
        pct: valorFaltanteTotal > 0 ? r.valor_faltante / valorFaltanteTotal : 0,
      })),
    { accentKey: 'valor_faltante' },
  )

  aba(
    'Por NF',
    'Divergências por nota fiscal',
    [
      { header: 'Loja', key: 'loja', width: 34 },
      { header: 'NF', key: 'nf', width: 14, asTextoOuNum: true },
      { header: 'Fornecedor', key: 'fornecedor', width: 40 },
      { header: 'Conferência', key: 'conferencia', width: 14, align: 'center' },
      { header: 'Itens faltantes', key: 'itens_faltantes', width: 16, asNumber: true, align: 'center' },
      { header: 'Qtd faltante', key: 'qtd_faltante', width: 14, asNumber: true, numFmt: FMT_QTD },
      { header: 'Valor faltante', key: 'valor_faltante', width: 16, asNumber: true, numFmt: FMT_MOEDA },
      { header: 'Valor NF', key: 'valor_nf', width: 14, asNumber: true, numFmt: FMT_MOEDA },
    ],
    (data.por_nf || []).map((r) => ({
      loja: r.loja,
      nf: r.numero,
      fornecedor: r.emitente,
      conferencia: r.data_conferencia,
      itens_faltantes: r.itens_faltantes,
      qtd_faltante: r.qtd_faltante,
      valor_faltante: r.valor_faltante,
      valor_nf: r.valor_nf,
    })),
    { accentKey: 'valor_faltante' },
  )

  aba(
    'Itens faltantes',
    'Itens faltantes',
    [
      { header: 'Loja', key: 'loja', width: 32 },
      { header: 'NF', key: 'nf', width: 12, asTextoOuNum: true },
      { header: 'Série', key: 'serie', width: 8, asTextoOuNum: true, align: 'center' },
      { header: 'Fornecedor', key: 'fornecedor', width: 38 },
      { header: 'CNPJ', key: 'cnpj', width: 18 },
      { header: 'Origem', key: 'origem', width: 12 },
      { header: 'Emissão', key: 'emissao', width: 12, align: 'center' },
      { header: 'Conferência', key: 'conferencia', width: 12, align: 'center' },
      { header: 'Código', key: 'codigo', width: 12 },
      { header: 'Produto', key: 'produto', width: 42 },
      { header: 'Unidade', key: 'unidade', width: 10, align: 'center' },
      { header: 'Qtd NF', key: 'qtd_nf', width: 11, asNumber: true, numFmt: FMT_QTD },
      { header: 'Qtd recebida', key: 'qtd_recebida', width: 13, asNumber: true, numFmt: FMT_QTD },
      { header: 'Qtd faltante', key: 'qtd_faltante', width: 13, asNumber: true, numFmt: FMT_QTD },
      { header: 'Valor unitário', key: 'valor_unitario', width: 14, asNumber: true, numFmt: FMT_MOEDA },
      { header: 'Valor item NF', key: 'valor_item_nf', width: 14, asNumber: true, numFmt: FMT_MOEDA },
      { header: 'Valor faltante', key: 'valor_faltante', width: 14, asNumber: true, numFmt: FMT_MOEDA },
      { header: 'Observação', key: 'observacao', width: 30 },
    ],
    (data.itens || []).map((r) => ({
      loja: r.loja,
      nf: r.numero,
      serie: r.serie,
      fornecedor: r.emitente_nome,
      cnpj: r.emitente_cnpj,
      origem: r.fornecedor,
      emissao: r.emissao,
      conferencia: r.data_conferencia,
      codigo: r.codigo,
      produto: r.produto,
      unidade: r.unidade,
      qtd_nf: r.qtd_nf,
      qtd_recebida: r.qtd_recebida,
      qtd_faltante: r.qtd_faltante,
      valor_unitario: r.valor_unitario,
      valor_item_nf: r.valor_item_nf,
      valor_faltante: r.valor_faltante,
      observacao: r.divergencia_obs || '',
    })),
    { accentKey: 'valor_faltante' },
  )

  aba(
    'Sem confirmação',
    'NFs sem confirmação da loja',
    [
      { header: 'Loja', key: 'loja', width: 32 },
      { header: 'NF', key: 'nf', width: 12, asTextoOuNum: true },
      { header: 'Série', key: 'serie', width: 8, asTextoOuNum: true, align: 'center' },
      { header: 'Fornecedor', key: 'fornecedor', width: 38 },
      { header: 'CNPJ', key: 'cnpj', width: 18 },
      { header: 'Origem', key: 'origem', width: 12 },
      { header: 'Emissão', key: 'emissao', width: 12, align: 'center' },
      { header: 'Saída / entrega', key: 'saida', width: 14, align: 'center' },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Valor NF', key: 'valor_nf', width: 14, asNumber: true, numFmt: FMT_MOEDA },
      { header: 'Itens', key: 'itens', width: 10, asNumber: true, align: 'center' },
    ],
    (data.sem_confirmacao || []).map((r) => ({
      loja: r.loja,
      nf: r.numero,
      serie: r.serie,
      fornecedor: r.emitente_nome,
      cnpj: r.emitente_cnpj,
      origem: r.fornecedor,
      emissao: r.emissao,
      saida: r.data_saida,
      status: rotuloStatusEntrega(r.status_entrega),
      valor_nf: r.valor_total,
      itens: r.itens,
    })),
    { accentKey: 'status' },
  )

  aba(
    'Lojas sem confirmar',
    'Lojas com NFs aguardando conferência',
    [
      { header: 'Loja', key: 'loja', width: 28 },
      { header: 'NFs pendentes', key: 'nfs', width: 14, asNumber: true, align: 'center' },
      { header: 'Valor total', key: 'valor_total', width: 16, asNumber: true, numFmt: FMT_MOEDA },
      { header: 'Emissão mais antiga', key: 'emissao_min', width: 18, align: 'center' },
      { header: 'Emissão mais recente', key: 'emissao_max', width: 18, align: 'center' },
    ],
    (data.sem_confirmacao_por_loja || []).map((r) => ({
      loja: r.loja,
      nfs: r.nfs,
      valor_total: r.valor_total,
      emissao_min: r.emissao_min,
      emissao_max: r.emissao_max,
    })),
    { accentKey: 'valor_total' },
  )

  return Buffer.from(await wb.xlsx.writeBuffer())
}
