/**
 * Lista e exporta DANFEs Platlog cruzando eSupri (estoque) + Receita/SEFAZ (nfe_recebida).
 * Pasta: Logs/exports/platlog-danfe-{de}_{ate}/{bk}_{loja}/{numero}-{loja}-{data}.pdf
 */
import fs from 'fs'
import path from 'path'
import { getLogsDir, getProjectRoot } from '../../projectPaths.js'
import { gerarDanfe } from './danfe.mjs'

function dinheiro(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function digitos(v) {
  return String(v ?? '').replace(/\D/g, '')
}

function slugLoja(n) {
  return String(n.loja || 'loja')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 48) || 'loja'
}

function pastaLoja(n) {
  return `${n.bk || n.id_loja || '00'}_${slugLoja(n)}`
}

/** Padrão: numeroNF:loja:data — ":" vira "-" no Windows. */
export function nomeDanfeArquivo(n) {
  const numero = String(n.numero ?? n.id_nfe ?? 'sem_numero').replace(/[^\w.-]+/g, '')
  const loja = String(n.bk || slugLoja(n)).replace(/[^\w.-]+/g, '_')
  const data = String(n.emissao || '').slice(0, 10) || 'sem_data'
  return `${numero}:${loja}:${data}.pdf`.replace(/[<>:"/\\|?*]/g, '-')
}

/** Resolve xml_path Docker (/app/Logs/...) → Logs do projeto. */
export function resolverXmlNfe(stored) {
  const s = String(stored || '').trim()
  if (!s) return null
  if (fs.existsSync(s)) return s

  const norm = s.replace(/\\/g, '/')
  const root = getProjectRoot()
  const logs = getLogsDir()

  const idx = norm.toLowerCase().lastIndexOf('/logs/')
  if (idx >= 0) {
    const cand = path.join(root, norm.slice(idx + 1))
    if (fs.existsSync(cand)) return cand
  }

  for (const prefix of ['esupri-nfe', 'sefaz-nfe']) {
    const m = norm.match(new RegExp(`${prefix}\\/.+$`, 'i'))
    if (m) {
      const cand = path.join(logs, m[0])
      if (fs.existsSync(cand)) return cand
    }
  }

  const base = path.basename(norm)
  const mid = norm.match(/(?:esupri|sefaz)-nfe\/(\d+)\//i)
  if (mid && base) {
    for (const prefix of ['esupri-nfe', 'sefaz-nfe']) {
      const cand = path.join(logs, prefix, mid[1], base)
      if (fs.existsSync(cand)) return cand
    }
  }
  return null
}

function xmlInlineOk(xml) {
  const s = String(xml || '').trim()
  return s.length > 100 && /<NFe[\s>]|<nfeProc[\s>]/i.test(s)
}

/**
 * Universo Platlog = estoque (portal+sefaz emitente) ∪ receita, 1 linha por chave.
 * Fonte XML: disco estoque → disco sefaz → xml inline nfe_recebida.
 */
export async function listarNfesPlatlog(portalPool, { de, ate } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) {
    throw Object.assign(new Error('Informe o período de emissão.'), { status: 400 })
  }

  const { rows } = await portalPool.query(
    `
    with estoque as (
      select distinct on (regexp_replace(coalesce(n.chave, ''), '\\D', '', 'g'))
             n.id_nfe,
             n.numero,
             n.chave,
             n.serie,
             to_char(n.emissao::date, 'YYYY-MM-DD') as emissao,
             to_char(date_trunc('month', n.emissao::date), 'YYYY-MM') as mes,
             n.valor_total::float8 as valor_total,
             n.xml_path,
             n.status_entrega,
             n.entrada_registrada,
             lower(coalesce(n.fornecedor, '')) as fonte,
             l.id_loja,
             l.name as loja,
             regexp_replace(coalesce(l.bk_number, ''), '\\D', '', 'g') as bk,
             regexp_replace(coalesce(n.chave, ''), '\\D', '', 'g') as chave_dig
      from public.estoque_nfe n
      join public.lojas l on l.id_loja = n.id_loja
      where n.emissao::date between $1::date and $2::date
        and (
          lower(coalesce(n.fornecedor, '')) = 'platlog'
          or n.emitente_nome ilike '%PLATLOG%'
          or regexp_replace(coalesce(n.emitente_cnpj, ''), '\\D', '', 'g') like '02229804%'
        )
        and n.chave is not null and btrim(n.chave) <> ''
      order by regexp_replace(coalesce(n.chave, ''), '\\D', '', 'g'),
               case when lower(coalesce(n.fornecedor, '')) = 'platlog' then 0 else 1 end,
               case when n.xml_path is not null and btrim(n.xml_path) <> '' then 0 else 1 end,
               n.id_nfe desc
    ),
    receita as (
      select distinct on (regexp_replace(coalesce(r.chave, ''), '\\D', '', 'g'))
             r.id as id_recebida,
             r.numero,
             r.chave,
             r.serie,
             to_char(r.emissao::date, 'YYYY-MM-DD') as emissao,
             to_char(date_trunc('month', r.emissao::date), 'YYYY-MM') as mes,
             r.valor_total::float8 as valor_total,
             r.xml as receita_xml,
             r.tem_xml,
             regexp_replace(coalesce(r.cnpj_empresa, ''), '\\D', '', 'g') as cnpj_empresa,
             regexp_replace(coalesce(r.chave, ''), '\\D', '', 'g') as chave_dig
      from finance.nfe_recebida r
      where r.emissao::date between $1::date and $2::date
        and (
          r.emitente_nome ilike '%PLATLOG%'
          or regexp_replace(coalesce(r.emitente_cnpj, ''), '\\D', '', 'g') like '02229804%'
        )
        and r.chave is not null and btrim(r.chave) <> ''
      order by regexp_replace(coalesce(r.chave, ''), '\\D', '', 'g'),
               case when length(coalesce(r.xml, '')) > 100 then 0 else 1 end,
               r.id desc
    ),
    lojas_cnpj as (
      select id_loja, name as loja,
             regexp_replace(coalesce(bk_number, ''), '\\D', '', 'g') as bk,
             regexp_replace(coalesce(cnpj, ''), '\\D', '', 'g') as cnpj
      from public.lojas
    )
    select
      coalesce(e.id_nfe, null) as id_nfe,
      coalesce(e.numero, r.numero) as numero,
      coalesce(e.chave, r.chave) as chave,
      coalesce(e.serie, r.serie) as serie,
      coalesce(e.emissao, r.emissao) as emissao,
      coalesce(e.mes, r.mes) as mes,
      coalesce(e.valor_total, r.valor_total, 0)::float8 as valor_total,
      e.xml_path,
      e.status_entrega,
      coalesce(e.entrada_registrada, false) as entrada_registrada,
      coalesce(e.fonte, 'receita') as fonte,
      coalesce(e.id_loja, lc.id_loja) as id_loja,
      coalesce(e.loja, lc.loja, 'SEM LOJA') as loja,
      coalesce(nullif(e.bk, ''), nullif(lc.bk, ''), null) as bk,
      coalesce(e.chave_dig, r.chave_dig) as chave_dig,
      r.receita_xml,
      coalesce(r.tem_xml, false) as receita_tem_xml,
      case when e.chave_dig is not null and r.chave_dig is not null then 'ambas'
           when e.chave_dig is not null then 'esupri_estoque'
           else 'receita'
      end as cruzamento
    from estoque e
    full outer join receita r on r.chave_dig = e.chave_dig
    left join lojas_cnpj lc on lc.cnpj = r.cnpj_empresa
    order by coalesce(e.emissao, r.emissao), coalesce(e.loja, lc.loja), coalesce(e.numero, r.numero)
    `,
    [de, ate],
  )

  const notas = rows.map((r) => {
    const disco = resolverXmlNfe(r.xml_path)
    const sefazDisco = r.chave_dig
      ? resolverXmlNfe(path.join(getLogsDir(), 'sefaz-nfe', String(r.id_loja || ''), `${r.chave_dig}.xml`))
      : null
    const temInline = xmlInlineOk(r.receita_xml)
    const tem_xml = !!(disco || sefazDisco || temInline)
    return {
      id_nfe: r.id_nfe,
      numero: r.numero,
      chave: r.chave,
      chave_dig: r.chave_dig,
      serie: r.serie,
      emissao: r.emissao,
      mes: r.mes,
      valor_total: dinheiro(r.valor_total),
      loja: r.loja,
      bk: r.bk || null,
      id_loja: r.id_loja,
      status_entrega: r.status_entrega,
      entrada_registrada: !!r.entrada_registrada,
      fonte: r.fonte,
      cruzamento: r.cruzamento,
      tem_xml,
      xml_path: r.xml_path,
      xml_disco: disco || sefazDisco || null,
      receita_xml: temInline ? r.receita_xml : null,
      arquivo_danfe: nomeDanfeArquivo(r),
      pasta_loja: pastaLoja(r),
    }
  })

  const porMes = new Map()
  const porLoja = new Map()
  for (const n of notas) {
    const cur = porMes.get(n.mes) || { mes: n.mes, qtd: 0, com_xml: 0, valor: 0 }
    cur.qtd += 1
    if (n.tem_xml) cur.com_xml += 1
    cur.valor = dinheiro(cur.valor + n.valor_total)
    porMes.set(n.mes, cur)

    const lk = n.pasta_loja
    const lj = porLoja.get(lk) || { loja: n.loja, bk: n.bk, qtd: 0, com_xml: 0, valor: 0 }
    lj.qtd += 1
    if (n.tem_xml) lj.com_xml += 1
    lj.valor = dinheiro(lj.valor + n.valor_total)
    porLoja.set(lk, lj)
  }

  return {
    de,
    ate,
    total: notas.length,
    com_xml: notas.filter((n) => n.tem_xml).length,
    sem_xml: notas.filter((n) => !n.tem_xml).length,
    valor: dinheiro(notas.reduce((s, n) => s + n.valor_total, 0)),
    por_mes: [...porMes.values()],
    por_loja: [...porLoja.entries()]
      .map(([pasta, v]) => ({ pasta, ...v }))
      .sort((a, b) => b.qtd - a.qtd),
    cruzamento: {
      ambas: notas.filter((n) => n.cruzamento === 'ambas').length,
      so_esupri: notas.filter((n) => n.cruzamento === 'esupri_estoque').length,
      so_receita: notas.filter((n) => n.cruzamento === 'receita').length,
    },
    notas,
  }
}

async function xmlDaNota(n) {
  if (n.xml_disco && fs.existsSync(n.xml_disco)) {
    return fs.readFileSync(n.xml_disco, 'utf8')
  }
  if (n.receita_xml && xmlInlineOk(n.receita_xml)) return n.receita_xml
  if (n.xml_path) {
    const disco = resolverXmlNfe(n.xml_path)
    if (disco) return fs.readFileSync(disco, 'utf8')
  }
  return null
}

async function danfeDeNota(n) {
  const xml = await xmlDaNota(n)
  if (!xml) return null
  return gerarDanfe(xml)
}

/**
 * DANFEs em Logs/exports/platlog-danfe-{de}_{ate}/{bk}_{loja}/numero-loja-data.pdf
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
        faltando.push({
          id_nfe: n.id_nfe,
          numero: n.numero,
          loja: n.loja,
          emissao: n.emissao,
          cruzamento: n.cruzamento,
        })
        continue
      }
      const dir = path.join(pastaAbs, n.pasta_loja)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, nomeDanfeArquivo(n)), pdf)
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
    cruzamento: lista.cruzamento,
    por_loja: lista.por_loja,
    faltando: faltando.slice(0, 50),
    falhas: falhas.slice(0, 30),
  }
}

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

/** ZIP: {bk}_{loja}/numero-loja-data.pdf */
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
      const nome = `${n.pasta_loja}/${nomeDanfeArquivo(n)}`
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
    cruzamento: lista.cruzamento,
    nome: `platlog-danfe-${de}_${ate}.zip`,
  }
}

export { digitos, pastaLoja }
