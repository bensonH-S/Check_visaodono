import crypto from 'crypto'

const TIPOS = new Set(['freelance', 'treinamento', 'despesa'])

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

/** Fim da semana de serviço (dom) → segunda de pagamento. */
function segundaSubsequente(ymd) {
  const raw = String(ymd || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ''
  const [yy, mm, dd] = raw.split('-').map(Number)
  const d = new Date(yy, mm - 1, dd, 12, 0, 0)
  const dow = d.getDay()
  const add = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow
  d.setDate(d.getDate() + add)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function tokenOk(esperado, recebido) {
  const a = String(esperado || '').trim()
  const b = String(recebido || '').trim()
  if (!a || !b || a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

function lerBearer(req) {
  const auth = String(req.headers.authorization || '')
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  const alt = String(req.headers['x-freecontrol-token'] || '').trim()
  return alt
}

function classificarTipo(prefs, descricao) {
  const blob = `${(prefs || []).join(' ')} ${descricao || ''}`.toUpperCase()
  if (/\bTREIN/.test(blob)) return 'treinamento'
  if (/\bFREE\b|\bFREEL/.test(blob)) return 'freelance'
  return 'despesa'
}

/** Remove [FREE]/FREE/TREIN do texto — o tipo fica só no selo. */
function limparDescricaoFreecontrol(texto) {
  return String(texto || '')
    .replace(/^\s*\[(?:FREE|TREIN|DESP|FREELANCE|TREINAMENTO|DESPESA)\]\s*/i, '')
    .replace(/^\s*(?:FREE|TREIN|DESP|FREELANCE|TREINAMENTO|DESPESA)\b[:\-\s]*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function formaDePagamento(pag, pixKey) {
  const p = String(pag || '').toUpperCase()
  if (p === 'FOLHA' || p.startsWith('FOLHA')) return { forma: 'folha', dados: 'FOLHA CADASTRADA' }
  const chave = String(pixKey || '').trim()
  if (chave && chave.toUpperCase() !== 'PIX' && !chave.includes('SEM CHAVE')) {
    return { forma: 'chave_pix', dados: chave }
  }
  return { forma: 'chave_pix', dados: chave || null }
}

function docRef(periodKey, linha) {
  const base = [
    periodKey,
    linha.secao || '',
    linha.descricao || '',
    String(linha.valor ?? ''),
    linha.pagamento || '',
    linha.pix_key || '',
    linha.codigo_ref || '',
  ].join('|')
  const hash = crypto.createHash('sha1').update(base).digest('hex').slice(0, 16)
  return `FC|${periodKey}|${hash}`
}

async function carregarEmpresas(pool) {
  const { rows } = await pool.query(`
    select id, apelido, razao_social, bk_number, tipo
    from empresas
    where ativo
  `)
  return rows
}

/** Aliases BANCO Free Control → apelido Meridian. */
const ALIASES_SECAO = [
  ['POPOYES VAL', 'POPVAL'],
  ['POPOYES', 'POPVAL'],
  ['POPEYES VAL', 'POPVAL'],
  ['POPEYES', 'POPVAL'],
  ['POP VAL', 'POPVAL'],
]

function resolverEmpresa(empresas, secao, loja) {
  const alvoSec = norm(secao)
  const candidatos = [alvoSec]
  for (const [de, para] of ALIASES_SECAO) {
    if (alvoSec && (alvoSec === norm(de) || alvoSec.includes(norm(de)))) {
      candidatos.push(norm(para))
    }
  }
  for (const alvo of candidatos.filter(Boolean)) {
    const hit = empresas.find((e) => {
      const a = norm(e.apelido)
      const r = norm(e.razao_social)
      return (a && (a === alvo || a.includes(alvo) || alvo.includes(a)))
        || (r && (r === alvo || r.includes(alvo) || alvo.includes(r)))
    })
    if (hit) return hit
  }
  const bk = String(loja || '').match(/\b(\d{4,6})\b/)
  if (bk) {
    const dig = bk[1]
    const hitBk = empresas.find((e) => String(e.bk_number || '').replace(/\D/g, '') === dig)
    if (hitBk) return hitBk
  }
  const alvoLoja = norm(loja).replace(/^BURGER KING\s*/, '')
  if (alvoLoja) {
    return empresas.find((e) => {
      const a = norm(e.apelido)
      const r = norm(e.razao_social)
      return (a && a.includes(alvoLoja)) || (r && r.includes(alvoLoja)) || (alvoLoja && a && alvoLoja.includes(a))
    }) || null
  }
  return null
}

function resolverRegistro(empresas, alocacao) {
  const a = norm(alocacao)
  if (!a) return null
  if (a.includes('KING') && !a.includes('SUPER')) {
    return empresas.find((e) => norm(e.apelido).includes('KING') && !norm(e.apelido).includes('SUPER')) || null
  }
  if (a.includes('SUPER') || a.includes('SK')) {
    return empresas.find((e) => {
      const n = norm(e.apelido)
      return n.includes('SUPER') || n === 'SK' || n.includes('SUPER KING')
    }) || null
  }
  return resolverEmpresa(empresas, alocacao, null)
}

/**
 * Recebe lote consolidado do Free Control e lança despesas prontas.
 * Auth: Bearer FREECONTROL_MERIDIAN_TOKEN (ou MERIDIAN_INGEST_TOKEN).
 */
export async function receberLoteFreecontrol(pool, req, env = process.env) {
  const esperado =
    env.FREECONTROL_MERIDIAN_TOKEN
    || env.MERIDIAN_INGEST_TOKEN
    || env.FREECONTROL_APPROVAL_TOKEN
  const token = lerBearer(req)
  if (!tokenOk(esperado, token)) {
    const err = new Error('Não autorizado.')
    err.status = 401
    throw err
  }

  const body = typeof req.body === 'object' && req.body ? req.body : {}
  const periodFrom = String(body.period_from || '').slice(0, 10)
  const periodTo = String(body.period_to || '').slice(0, 10)
  const periodKey = String(body.period_key || `${periodFrom}_${periodTo}`).trim()
  // Serviço seg→dom; vence na segunda subsequente (Agenda sáb→sáb).
  const vencimento = String(body.vencimento || segundaSubsequente(periodTo) || periodTo).slice(0, 10)
  const linhas = Array.isArray(body.lancamentos) ? body.lancamentos : []

  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(periodTo)) {
    const err = new Error('period_from e period_to (YYYY-MM-DD) são obrigatórios.')
    err.status = 400
    throw err
  }
  if (!linhas.length) {
    const err = new Error('Nenhum lançamento no lote.')
    err.status = 400
    throw err
  }

  await pool.query(`
    alter table despesas add column if not exists freecontrol_tipo text;
  `).catch(() => undefined)

  const empresas = await carregarEmpresas(pool)
  let criadas = 0
  let existentes = 0
  let ignoradas = 0
  const erros = []
  const ids = []

  for (const raw of linhas) {
    const valor = Number(raw.valor)
    if (!Number.isFinite(valor) || valor <= 0) {
      ignoradas += 1
      continue
    }
    const prefs = Array.isArray(raw.prefs) ? raw.prefs.map(String) : []
    const descricao = String(raw.descricao || raw.desc || '').trim()
    if (!descricao) {
      ignoradas += 1
      continue
    }
    const tipoRaw = String(raw.tipo || '').toLowerCase()
    const tipo = TIPOS.has(tipoRaw) ? tipoRaw : classificarTipo(prefs, descricao)
    const empresa = resolverEmpresa(empresas, raw.secao, raw.loja)
    if (!empresa) {
      erros.push({ descricao, secao: raw.secao, loja: raw.loja, motivo: 'empresa não encontrada' })
      ignoradas += 1
      continue
    }
    const registro = resolverRegistro(empresas, raw.alocacao)
    const { forma, dados } = formaDePagamento(raw.pagamento, raw.pix_key)
    const documento_ref = docRef(periodKey, {
      secao: raw.secao,
      descricao,
      valor,
      pagamento: raw.pagamento,
      pix_key: raw.pix_key,
      codigo_ref: raw.codigo_ref,
    })

    const dup = await pool.query(
      `select id::text as id from despesas
       where empresa_origem_id = $1 and documento_ref = $2 and status <> 'cancelada'
       limit 1`,
      [empresa.id, documento_ref],
    )
    if (dup.rows[0]) {
      existentes += 1
      ids.push(dup.rows[0].id)
      continue
    }

    // Tipo vai no selo (FREE/TREIN/DESP); descrição fica só com o nome/info.
    const descFinal = limparDescricaoFreecontrol(descricao)

    const { rows } = await pool.query(
      `
      insert into despesas (
        id, descricao, empresa_origem_id, empresa_registro_id,
        documento_ref, numero_nf, competencia, vencimento, valor,
        forma_pagamento, dados_pagamento, status, fonte, freecontrol_tipo
      ) values (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6::date, $7::date, $8,
        $9, $10, 'pronta', 'freecontrol', $11
      )
      returning id::text as id
      `,
      [
        descFinal.slice(0, 240),
        empresa.id,
        registro?.id || null,
        documento_ref,
        raw.codigo_ref ? String(raw.codigo_ref).trim().slice(0, 60) : null,
        periodFrom,
        /^\d{4}-\d{2}-\d{2}$/.test(vencimento) ? vencimento : periodTo,
        valor,
        forma,
        dados,
        tipo,
      ],
    )
    criadas += 1
    if (rows[0]?.id) ids.push(rows[0].id)
  }

  return {
    ok: true,
    period_key: periodKey,
    period_from: periodFrom,
    period_to: periodTo,
    criadas,
    existentes,
    ignoradas,
    erros: erros.slice(0, 40),
    ids,
  }
}

export async function garantirSchemaFreecontrol(pool) {
  const fs = await import('fs')
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const sql = fs.readFileSync(path.join(root, 'db', '012_despesa_fonte_freecontrol.sql'), 'utf8')
  await pool.query(sql)
}
