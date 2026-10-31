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

const PREFIXOS_PESSOA = 'FREE|TREIN|DESP|FREELANCE|TREINAMENTO|DESPESA|AUX|META|REEMB|PASSAG|FERIADOS|PREMIACAO|PREMIAÇÃO|OUTRAS'

/** Remove [FREE]/FREE/TREIN do texto — o tipo fica só no selo. */
function limparDescricaoFreecontrol(texto) {
  return String(texto || '')
    .replace(/^\s*\[(?:FREE|TREIN|DESP|FREELANCE|TREINAMENTO|DESPESA)\]\s*/i, '')
    .replace(/^\s*(?:FREE|TREIN|DESP|FREELANCE|TREINAMENTO|DESPESA)\b[:\-\s]*/i, '')
    .replace(/^\++/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Nome da pessoa, sem FREE+AUX+META… — identidade estável no lote. */
function nomeSemPrefixos(texto) {
  const s = String(texto || '')
    .replace(/^\s*\[(?:FREE|TREIN|DESP|FREELANCE|TREINAMENTO|DESPESA)\]\s*/i, '')
    .replace(new RegExp(`^(?:${PREFIXOS_PESSOA})(?:\\+(?:${PREFIXOS_PESSOA}))*[\\s:+-]*`, 'i'), '')
    .replace(/^\++/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return s || String(texto || '').trim()
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

/** Mesma regra da planilha BANCO: um registro por pessoa+loja+folha/pix, somando tipos. */
function mesclarLancamentos(linhas) {
  const map = new Map()
  const ordem = []
  for (const raw of linhas || []) {
    const valor = Number(raw?.valor)
    if (!Number.isFinite(valor) || valor <= 0) continue
    const descricao = String(raw.descricao || raw.desc || '').trim()
    if (!descricao) continue
    const codigo = String(raw.codigo_ref || '').trim()
    const nome = norm(nomeSemPrefixos(descricao))
    const chave = [
      norm(raw.secao || ''),
      codigo || nome,
      formaPagamentoChave(raw.pagamento),
    ].join('|')
    const prev = map.get(chave)
    if (!prev) {
      const prefs = Array.isArray(raw.prefs) ? raw.prefs.map(String) : []
      map.set(chave, { ...raw, descricao, valor, prefs })
      ordem.push(chave)
      continue
    }
    prev.valor = round2(prev.valor + valor)
    const prefs = new Set([...(prev.prefs || []), ...((raw.prefs || []).map(String))])
    prev.prefs = [...prefs]
    if (descricao.length > String(prev.descricao || '').length) prev.descricao = descricao
    if (!prev.pix_key && raw.pix_key) prev.pix_key = raw.pix_key
    if (!prev.codigo_ref && raw.codigo_ref) prev.codigo_ref = raw.codigo_ref
    if (!prev.alocacao && raw.alocacao) prev.alocacao = raw.alocacao
  }
  return ordem.map((k) => map.get(k))
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

function formaPagamentoChave(pag) {
  const p = String(pag || '').toUpperCase()
  return p === 'FOLHA' || p.startsWith('FOLHA') ? 'folha' : 'chave_pix'
}

function hashRef(periodKey, parts) {
  const hash = crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16)
  return `FC|${periodKey}|${hash}`
}

/** Identidade estável da pessoa na semana — valor/horas não entram, senão o ajuste vira outra linha. */
function docRefEstavel(periodKey, linha) {
  const nome = norm(nomeSemPrefixos(linha.descricao || ''))
  const codigo = String(linha.codigo_ref || '').trim()
  return hashRef(periodKey, [
    periodKey,
    norm(linha.secao || ''),
    codigo || nome,
    formaPagamentoChave(linha.pagamento),
  ])
}

/** Hash antigo (incluía valor) — ainda usado para achar lançamento já importado. */
function docRefLegado(periodKey, linha) {
  return hashRef(periodKey, [
    periodKey,
    linha.secao || '',
    linha.descricao || '',
    String(linha.valor ?? ''),
    linha.pagamento || '',
    linha.pix_key || '',
    linha.codigo_ref || '',
  ])
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
  const curto = alvoSec.replace(/\s+ALVIM$/, '').trim()
  const candidatos = [alvoSec, curto]
  for (const [de, para] of ALIASES_SECAO) {
    if (alvoSec && (alvoSec === norm(de) || alvoSec.includes(norm(de)))) {
      candidatos.push(norm(para))
    }
  }
  for (const alvo of candidatos.filter(Boolean)) {
    const exato = empresas.find((e) => norm(e.apelido) === alvo || norm(e.razao_social) === alvo)
    if (exato) return exato
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
  return aplicarLoteFreecontrol(pool, body)
}

export async function aplicarLoteFreecontrol(pool, body = {}) {
  const periodFrom = String(body.period_from || '').slice(0, 10)
  const periodTo = String(body.period_to || '').slice(0, 10)
  const periodKey = String(body.period_key || `${periodFrom}_${periodTo}`).trim()
  // Serviço seg→dom; vence na segunda subsequente (Agenda dom→sáb).
  const vencimento = String(body.vencimento || segundaSubsequente(periodTo) || periodTo).slice(0, 10)
  const linhas = mesclarLancamentos(Array.isArray(body.lancamentos) ? body.lancamentos : [])

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
  let atualizadas = 0
  let existentes = 0
  let ignoradas = 0
  const erros = []
  const ids = []
  const refsKeep = []
  const empresasOk = new Set()
  const vencimentoFinal = /^\d{4}-\d{2}-\d{2}$/.test(vencimento) ? vencimento : periodTo

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
      || empresas.find((e) => /ALVIM PARTICIP/.test(norm(e.apelido) + ' ' + norm(e.razao_social)))
      || empresas.find((e) => norm(e.apelido) === 'KING')
    if (!empresa) {
      erros.push({ descricao, secao: raw.secao, loja: raw.loja, motivo: 'empresa não encontrada' })
      ignoradas += 1
      continue
    }
    const registro = resolverRegistro(empresas, raw.alocacao)
    const { forma, dados } = formaDePagamento(raw.pagamento, raw.pix_key)
    const chaveLinha = {
      secao: raw.secao,
      descricao,
      valor,
      pagamento: raw.pagamento,
      pix_key: raw.pix_key,
      codigo_ref: raw.codigo_ref,
    }
    const documento_ref = docRefEstavel(periodKey, chaveLinha)
    const documento_legado = docRefLegado(periodKey, chaveLinha)
    const descFinal = limparDescricaoFreecontrol(descricao).slice(0, 240)

    const dup = await pool.query(
      `select id::text as id, documento_ref, status, valor::float8 as valor
       from despesas
       where empresa_origem_id = $1
         and fonte = 'freecontrol'
         and status <> 'cancelada'
         and (
           documento_ref = $2
           or documento_ref = $3
           or (
             documento_ref like $4
             and upper(btrim(descricao)) = upper(btrim($5))
             and forma_pagamento = $6
           )
         )
       order by
         case
           when documento_ref = $2 then 0
           when documento_ref = $3 then 1
           else 2
         end,
         id desc
       limit 1`,
      [empresa.id, documento_ref, documento_legado, `FC|${periodKey}|%`, descFinal, forma],
    )

    refsKeep.push(documento_ref)
    empresasOk.add(String(empresa.id))

    if (dup.rows[0]) {
      const atual = dup.rows[0]
      ids.push(atual.id)
      const pago = atual.status === 'paga' || atual.status === 'conciliada'
      if (pago) {
        existentes += 1
        continue
      }
      await pool.query(
        `update despesas set
           descricao = $2,
           documento_ref = $3,
           numero_nf = $4,
           competencia = $5::date,
           vencimento = $6::date,
           data_lancamento = coalesce(data_lancamento, $5::date),
           valor = $7,
           forma_pagamento = $8,
           dados_pagamento = $9,
           freecontrol_tipo = $10,
           empresa_registro_id = coalesce($11, empresa_registro_id),
           conferencia_status = coalesce(conferencia_status, 'ok')
         where id = $1::uuid`,
        [
          atual.id,
          descFinal,
          documento_ref,
          raw.codigo_ref ? String(raw.codigo_ref).trim().slice(0, 60) : null,
          periodFrom,
          vencimentoFinal,
          valor,
          forma,
          dados,
          tipo,
          registro?.id || null,
        ],
      )
      atualizadas += 1
      continue
    }

    const { rows } = await pool.query(
      `
      insert into despesas (
        id, descricao, empresa_origem_id, empresa_registro_id,
        documento_ref, numero_nf, competencia, vencimento, data_lancamento, valor,
        forma_pagamento, dados_pagamento, status, fonte, freecontrol_tipo,
        conferencia_status
      ) values (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6::date, $7::date, $6::date, $8,
        $9, $10, 'pronta', 'freecontrol', $11, 'ok'
      )
      returning id::text as id
      `,
      [
        descFinal,
        empresa.id,
        registro?.id || null,
        documento_ref,
        raw.codigo_ref ? String(raw.codigo_ref).trim().slice(0, 60) : null,
        periodFrom,
        vencimentoFinal,
        valor,
        forma,
        dados,
        tipo,
      ],
    )
    criadas += 1
    if (rows[0]?.id) ids.push(rows[0].id)
  }

  if (empresasOk.size && refsKeep.length) {
    await pool.query(
      `update despesas
       set status = 'cancelada'
       where fonte = 'freecontrol'
         and status not in ('paga', 'conciliada', 'cancelada')
         and empresa_origem_id::text = any($1::text[])
         and documento_ref like $2
         and documento_ref <> all($3::text[])`,
      [[...empresasOk], `FC|${periodKey}|%`, refsKeep],
    ).catch(() => undefined)
  }

  await pool.query(
    `update despesas
     set vencimento = $1::date
     where fonte = 'freecontrol'
       and status not in ('paga', 'conciliada', 'cancelada')
       and documento_ref like $2
       and vencimento is distinct from $1::date`,
    [vencimentoFinal, `FC|${periodKey}|%`],
  ).catch(() => undefined)

  return {
    ok: true,
    period_key: periodKey,
    period_from: periodFrom,
    period_to: periodTo,
    vencimento: vencimentoFinal,
    criadas,
    atualizadas,
    existentes,
    ignoradas,
    erros: erros.slice(0, 40),
    ids,
  }
}

function ymdLocal(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function semanaTrabalhoYmd(base = new Date()) {
  const x = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0)
  const dow = x.getDay()
  const toMon = dow === 0 ? -6 : 1 - dow
  const mon = new Date(x)
  mon.setDate(x.getDate() + toMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { from: ymdLocal(mon), to: ymdLocal(sun) }
}

function semanasParaPuxar() {
  const atual = semanaTrabalhoYmd()
  const previaBase = new Date()
  previaBase.setDate(previaBase.getDate() - 7)
  const previa = semanaTrabalhoYmd(previaBase)
  const seen = new Set()
  const out = []
  for (const s of [previa, atual]) {
    const k = `${s.from}_${s.to}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(s)
  }
  return out
}

let puxando = null
let puxouEm = 0

function basesFreecontrol(env) {
  const extra = [
    'http://172.17.0.1:3004',
    'http://172.17.0.1:5000',
    'http://172.17.0.1:5001',
    'http://host.docker.internal:3004',
    'http://host.docker.internal:5000',
    'http://host.docker.internal:5001',
    'http://127.0.0.1:3004',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5001',
    'http://localhost:3004',
    'http://localhost:5000',
    'http://localhost:5001',
  ]
  const principal = String(env.FREECONTROL_API_URL || '').trim().replace(/\/+$/, '')
  const out = []
  for (const u of [principal, ...extra]) {
    const n = String(u || '').trim().replace(/\/+$/, '')
    if (n && !out.includes(n)) out.push(n)
  }
  return out
}

async function fetchBancoLote(base, token, from, to, timeoutMs) {
  const url = `${base}/api/regional-approvals/banco-lote?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
    const text = await res.text()
    let lote = null
    try {
      lote = text ? JSON.parse(text) : null
    } catch {
      lote = null
    }
    return { res, lote }
  } finally {
    clearTimeout(t)
  }
}

export async function puxarBancoFreecontrol(pool, env = process.env) {
  const token = String(env.FREECONTROL_APPROVAL_TOKEN || env.REGIONAL_APPROVAL_API_TOKEN || '').trim()
  const bases = basesFreecontrol(env)
  if (!bases.length || !token) {
    return { ok: false, skipped: true, message: 'FREECONTROL_API_URL / FREECONTROL_APPROVAL_TOKEN ausentes.' }
  }

  const semanas = semanasParaPuxar()
  let baseOk = ''
  for (const cand of bases) {
    try {
      const { res } = await fetchBancoLote(cand, token, semanas[0].from, semanas[0].to, 8_000)
      if (res.ok || res.status === 401 || res.status === 403) {
        baseOk = cand
        break
      }
    } catch {
      /* tenta o próximo host */
    }
  }
  const base = baseOk || bases[0]

  const resultados = []
  for (const sem of semanas) {
    let lote
    try {
      const { res, lote: parsed } = await fetchBancoLote(base, token, sem.from, sem.to, 180_000)
      lote = parsed
      if (!res.ok) {
        resultados.push({
          ok: false,
          period_from: sem.from,
          period_to: sem.to,
          message: (lote && (lote.message || lote.erro || lote.error)) || `HTTP ${res.status}`,
        })
        continue
      }
    } catch (err) {
      resultados.push({
        ok: false,
        period_from: sem.from,
        period_to: sem.to,
        message: String(err?.message || err).slice(0, 300),
      })
      continue
    }

    const lancamentos = Array.isArray(lote?.lancamentos) ? lote.lancamentos : []
    if (!lancamentos.length) {
      resultados.push({
        ok: true,
        period_from: sem.from,
        period_to: sem.to,
        criadas: 0,
        atualizadas: 0,
        ignoradas: 0,
        message: 'Sem lançamentos nesta semana.',
      })
      continue
    }

    const aplicado = await aplicarLoteFreecontrol(pool, {
      period_from: lote.period_from || sem.from,
      period_to: lote.period_to || sem.to,
      period_key: lote.period_key || `${sem.from}_${sem.to}`,
      vencimento: lote.vencimento,
      lancamentos,
    })
    resultados.push(aplicado)
  }

  const criadas = resultados.reduce((s, r) => s + (Number(r.criadas) || 0), 0)
  const atualizadas = resultados.reduce((s, r) => s + (Number(r.atualizadas) || 0), 0)
  const erros = resultados.filter((r) => r.ok === false)
  return {
    ok: erros.length < resultados.length || resultados.length === 0,
    criadas,
    atualizadas,
    semanas: resultados,
  }
}

export function puxarBancoFreecontrolSePreciso(pool, env = process.env, { force = false, minMs = 120_000 } = {}) {
  if (!force && Date.now() - puxouEm < minMs) {
    return Promise.resolve({ ok: true, skipped: true, motivo: 'recente' })
  }
  if (puxando) return puxando
  puxando = puxarBancoFreecontrol(pool, env)
    .then((r) => {
      puxouEm = Date.now()
      const criadas = r.criadas ?? 0
      const atualizadas = r.atualizadas ?? 0
      if (!r.skipped) {
        console.log(
          `[financeiro] FreeControl puxado — criadas=${criadas} atualizadas=${atualizadas} ${JSON.stringify((r.semanas || []).map((s) => s.period_from || s.message))}`,
        )
      }
      return r
    })
    .catch((err) => {
      console.warn(`[financeiro] FreeControl puxar: ${err.message}`)
      return { ok: false, message: err.message }
    })
    .finally(() => {
      puxando = null
    })
  return puxando
}

export async function garantirSchemaFreecontrol(pool) {
  const fs = await import('fs')
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const sql = fs.readFileSync(path.join(root, 'db', '012_despesa_fonte_freecontrol.sql'), 'utf8')
  await pool.query(sql)
}
