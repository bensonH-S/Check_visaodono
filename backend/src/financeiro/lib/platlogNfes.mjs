/**
 * Lista e exporta DANFEs das NFs Platlog (estoque_nfe) por período de emissão.
 * Nome do arquivo: {numeroNF}:{loja}:{data}.pdf  (":" vira "-" no Windows)
 */
import fs from 'fs'
import path from 'path'
import { getLogsDir, getProjectRoot } from '../../projectPaths.js'
import { gerarDanfe } from './danfe.mjs'

function dinheiro(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function lojaArquivo(n) {
  const base = String(n.bk || n.loja || n.id_loja || 'loja')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 40)
  return base || 'loja'
}

/** Padrão pedido: numeroNF:loja:data — caracteres ilegais no FS viram "-". */
export function nomeDanfeArquivo(n) {
  const numero = String(n.numero ?? n.id_nfe ?? 'sem_numero').replace(/[^\w.-]+/g, '')
  const loja = lojaArquivo(n)
  const data = String(n.emissao || '').slice(0, 10) || 'sem_data'
  const bruto = `${numero}:${loja}:${data}.pdf`
  return bruto.replace(/[<>:"/\\|?*]/g, '-')
}

/** Resolve xml_path do Docker (/app/Logs/...) para a pasta Logs do projeto. */
export function resolverXmlNfe(stored) {
  const s = String(stored || '').trim()
  if (!s) return null
  if (fs.existsSync(s)) return s

  const norm = s.replace(/\\/g, '/')
  const root = getProjectRoot()
  const logs = getLogsDir()

  const idx = norm.toLowerCase().lastIndexOf('/logs/')
  if (idx >= 0) {
    const rel = norm.slice(idx + 1)
    const cand = path.join(root, rel)
    if (fs.existsSync(cand)) return cand
  }

  const m = norm.match(/esupri-nfe\/.+$/i)
  if (m) {
    const cand = path.join(logs, m[0])
    if (fs.existsSync(cand)) return cand
  }

  const base = path.basename(norm)
  if (base) {
    const mid = norm.match(/esupri-nfe\/(\d+)\//i)
    if (mid) {
      const cand = path.join(logs, 'esupri-nfe', mid[1], base)
      if (fs.existsSync(cand)) return cand
    }
  }
  return null
}

async function danfeDeNota(n) {
  const src = resolverXmlNfe(n.xml_path)
  if (!src) return null
  const xml = fs.readFileSync(src, 'utf8')
  return gerarDanfe(xml)
}

export async function listarNfesPlatlog(portalPool, { de, ate } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) {
    throw Object.assign(new Error('Informe o período de emissão.'), { status: 400 })
  }

  const { rows } = await portalPool.query(
    `
    select n.id_nfe,
           n.numero,
           n.chave,
           n.serie,
           to_char(n.emissao::date, 'YYYY-MM-DD') as emissao,
           to_char(date_trunc('month', n.emissao::date), 'YYYY-MM') as mes,
           n.valor_total::float8 as valor_total,
           n.xml_path,
           n.status_entrega,
           n.entrada_registrada,
           l.id_loja,
           l.name as loja,
           regexp_replace(coalesce(l.bk_number, ''), '\\D', '', 'g') as bk
    from public.estoque_nfe n
    join public.lojas l on l.id_loja = n.id_loja
    where lower(coalesce(n.fornecedor, '')) = 'platlog'
      and n.emissao::date between $1::date and $2::date
    order by n.emissao asc, l.name, n.numero
    `,
    [de, ate],
  )

  const notas = rows.map((r) => {
    const disco = resolverXmlNfe(r.xml_path)
    return {
      id_nfe: r.id_nfe,
      numero: r.numero,
      chave: r.chave,
      serie: r.serie,
      emissao: r.emissao,
      mes: r.mes,
      valor_total: dinheiro(r.valor_total),
      loja: r.loja,
      bk: r.bk || null,
      id_loja: r.id_loja,
      status_entrega: r.status_entrega,
      entrada_registrada: !!r.entrada_registrada,
      tem_xml: !!disco,
      xml_path: r.xml_path,
      arquivo_danfe: nomeDanfeArquivo(r),
    }
  })

  const porMes = new Map()
  for (const n of notas) {
    const cur = porMes.get(n.mes) || { mes: n.mes, qtd: 0, com_xml: 0, valor: 0 }
    cur.qtd += 1
    if (n.tem_xml) cur.com_xml += 1
    cur.valor = dinheiro(cur.valor + n.valor_total)
    porMes.set(n.mes, cur)
  }

  return {
    de,
    ate,
    total: notas.length,
    com_xml: notas.filter((n) => n.tem_xml).length,
    sem_xml: notas.filter((n) => !n.tem_xml).length,
    valor: dinheiro(notas.reduce((s, n) => s + n.valor_total, 0)),
    por_mes: [...porMes.values()],
    notas,
  }
}

/**
 * Gera DANFEs em Logs/exports/platlog-danfe-{de}_{ate}/
 * Arquivo: {numeroNF}-{loja}-{data}.pdf  (= padrao numero:loja:data)
 */
export async function exportarPastaPlatlog(portalPool, { de, ate } = {}) {
  const lista = await listarNfesPlatlog(portalPool, { de, ate })
  const pastaRel = path.join('Logs', 'exports', `platlog-danfe-${de}_${ate}`)
  const pastaAbs = path.join(getProjectRoot(), pastaRel)
  fs.mkdirSync(pastaAbs, { recursive: true })

  let copiados = 0
  const faltando = []
  const falhas = []

  for (const n of lista.notas) {
    try {
      const pdf = await danfeDeNota(n)
      if (!pdf) {
        faltando.push({ id_nfe: n.id_nfe, numero: n.numero, loja: n.loja, emissao: n.emissao })
        continue
      }
      const nome = nomeDanfeArquivo(n)
      fs.writeFileSync(path.join(pastaAbs, nome), pdf)
      copiados += 1
    } catch (err) {
      falhas.push({
        id_nfe: n.id_nfe,
        numero: n.numero,
        loja: n.loja,
        emissao: n.emissao,
        erro: err?.message || String(err),
      })
    }
  }

  return {
    de,
    ate,
    pasta: pastaRel.replace(/\\/g, '/'),
    pasta_abs: pastaAbs,
    total: lista.total,
    copiados,
    faltando_xml: faltando.length,
    falhas_danfe: falhas.length,
    faltando: faltando.slice(0, 50),
    falhas: falhas.slice(0, 30),
  }
}

/** CRC32 para ZIP STORE. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function u16(n) {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n, 0)
  return b
}
function u32(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n >>> 0, 0)
  return b
}

function zipEntry(nome, data, offset) {
  const nameBuf = Buffer.from(nome, 'utf8')
  const crc = crc32(data)
  const local = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(crc),
    u32(data.length),
    u32(data.length),
    u16(nameBuf.length),
    u16(0),
    nameBuf,
    data,
  ])
  const central = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x01, 0x02]),
    u16(20),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(crc),
    u32(data.length),
    u32(data.length),
    u16(nameBuf.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(offset),
    nameBuf,
  ])
  return { local, central, nextOffset: offset + local.length }
}

/**
 * ZIP com DANFEs Platlog — entradas flat: {numero}-{loja}-{data}.pdf
 */
export async function montarZipPlatlog(portalPool, { de, ate } = {}) {
  const lista = await listarNfesPlatlog(portalPool, { de, ate })
  const locals = []
  const centrais = []
  let offset = 0
  let faltando = 0
  let falhas = 0

  for (const n of lista.notas) {
    try {
      const pdf = await danfeDeNota(n)
      if (!pdf) {
        faltando += 1
        continue
      }
      const nome = nomeDanfeArquivo(n)
      const { local, central, nextOffset } = zipEntry(nome, pdf, offset)
      locals.push(local)
      centrais.push(central)
      offset = nextOffset
    } catch {
      falhas += 1
    }
  }

  const centralDir = Buffer.concat(centrais)
  const end = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16(0),
    u16(0),
    u16(centrais.length),
    u16(centrais.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])

  return {
    de,
    ate,
    buffer: Buffer.concat([...locals, centralDir, end]),
    arquivos: locals.length,
    faltando_xml: faltando,
    falhas_danfe: falhas,
    total: lista.total,
    nome: `platlog-danfe-${de}_${ate}.zip`,
  }
}
