/**
 * Ponte temporária: Hermes ainda posta no Azimut (/financas/ → :3018 / meridian_finance).
 * O Meridian lê vision_check.finance — espelha heartbeat (+ fechamentos POS recentes).
 */
import pg from 'pg'

let rodando = false
let ultimo = null
let nfcCursor = null

function poolOpts(env, database, searchPath) {
  const ssl = env.DB_SSL === '1' || env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined
  return {
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASS,
    database,
    port: Number(env.DB_PORT || 5432),
    ssl,
    connectionTimeoutMillis: 8000,
    max: 2,
    ...(searchPath ? { options: `-c search_path=${searchPath}` } : {}),
  }
}

async function sincronizarNfc(azimut, meridian, porBk) {
  try {
    await azimut.query(`select 1 from public.nfc_venda limit 1`)
  } catch (err) {
    if (err.code === '42P01') return 0
    throw err
  }
  await meridian.query(`
    create table if not exists public.nfc_venda (
      id uuid primary key default gen_random_uuid(),
      empresa_id uuid,
      bk_number text,
      chave text not null unique,
      data date not null,
      numero text,
      serie text,
      valor numeric(14, 2),
      tipo text not null default 'autorizada',
      xml text not null,
      criado_em timestamptz not null default now(),
      atualizado_em timestamptz not null default now()
    )
  `)
  if (!nfcCursor) {
    const atual = await meridian.query(`
      select atualizado_em, chave
      from public.nfc_venda
      order by atualizado_em desc, chave desc
      limit 1
    `)
    const row = atual.rows[0]
    nfcCursor = row
      ? { em: row.atualizado_em, chave: row.chave }
      : { em: new Date(0), chave: '' }
  }
  let copiadas = 0
  for (let volta = 0; volta < 25; volta += 1) {
    const lote = await azimut.query(`
      select n.chave, n.data::text as data, n.numero, n.serie, n.valor, n.tipo, n.xml, n.atualizado_em,
             regexp_replace(coalesce(n.bk_number, e.bk_number, ''), '\\D', '', 'g') as bk
      from public.nfc_venda n
      left join empresas e on e.id = n.empresa_id
      where n.atualizado_em > $1
         or (n.atualizado_em = $1 and n.chave > $2)
      order by n.atualizado_em, n.chave
      limit 200
    `, [nfcCursor.em, nfcCursor.chave])
    if (!lote.rows.length) break
    for (const row of lote.rows) {
      nfcCursor = { em: row.atualizado_em, chave: row.chave }
      const empresaId = porBk.get(row.bk)
      if (!empresaId) continue
      await meridian.query(`
        insert into public.nfc_venda (
          empresa_id, bk_number, chave, data, numero, serie, valor, tipo, xml, atualizado_em
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        on conflict (chave) do update set
          empresa_id = excluded.empresa_id,
          bk_number = excluded.bk_number,
          data = excluded.data,
          numero = excluded.numero,
          serie = excluded.serie,
          valor = excluded.valor,
          tipo = excluded.tipo,
          xml = excluded.xml,
          atualizado_em = excluded.atualizado_em
      `, [
        empresaId, row.bk, row.chave, row.data, row.numero, row.serie,
        row.valor, row.tipo, row.xml, row.atualizado_em,
      ])
      copiadas += 1
    }
    if (lote.rows.length < 200) break
  }
  return copiadas
}

export async function syncCaixaAzimutParaMeridian(env = process.env, { dias = 45 } = {}) {
  if (rodando) return { skipped: true, ...ultimo }
  rodando = true
  const azimut = new pg.Pool(poolOpts(env, env.AZIMUT_CAIXA_DB || 'meridian_finance'))
  const meridian = new pg.Pool(poolOpts(
    env,
    env.FINANCE_DB_NAME || env.DB_NAME || 'vision_check',
    'finance,public',
  ))
  try {
    const lojasM = await meridian.query(`
      SELECT id, regexp_replace(coalesce(bk_number,''), '\\D', '', 'g') AS bk
      FROM empresas WHERE ativo AND tipo = 'loja'
    `)
    const porBk = new Map(lojasM.rows.filter((r) => r.bk).map((r) => [r.bk, r.id]))

    const statusA = await azimut.query(`
      SELECT regexp_replace(coalesce(e.bk_number, s.bk_number, ''), '\\D', '', 'g') AS bk,
             s.ultimo_ok, s.ultimo_dia, s.ultima_mensagem
      FROM caixa_loja_status s
      LEFT JOIN empresas e ON e.id = s.empresa_id
      WHERE s.ultimo_ok IS NOT NULL
    `)

    let statusOk = 0
    for (const row of statusA.rows) {
      const empresaId = porBk.get(row.bk)
      if (!empresaId) continue
      await meridian.query(`
        INSERT INTO caixa_loja_status (empresa_id, bk_number, ultimo_ok, ultimo_dia, ultima_mensagem)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (empresa_id) DO UPDATE SET
          bk_number = EXCLUDED.bk_number,
          ultimo_ok = GREATEST(caixa_loja_status.ultimo_ok, EXCLUDED.ultimo_ok),
          ultimo_dia = COALESCE(EXCLUDED.ultimo_dia, caixa_loja_status.ultimo_dia),
          ultima_mensagem = COALESCE(EXCLUDED.ultima_mensagem, caixa_loja_status.ultima_mensagem)
      `, [empresaId, row.bk, row.ultimo_ok, row.ultimo_dia, row.ultima_mensagem || 'sync azimut'])
      statusOk += 1
    }

    const campos = [
      'dinheiro', 'pix', 'debito', 'credito', 'cart_digital',
      'ifood', 'azul', 'rappi', 'food99', 'despesas_caixa',
    ]
    const fechA = await azimut.query(`
      SELECT regexp_replace(coalesce(e.bk_number,''), '\\D', '', 'g') AS bk,
             f.data::text AS data, f.status, f.observacao,
             ${campos.map((c) => `f.${c}`).join(', ')}
      FROM fechamento_caixa f
      JOIN empresas e ON e.id = f.empresa_id
      WHERE f.data >= (CURRENT_DATE - $1::int)
        AND (f.dinheiro + f.pix + f.debito + f.credito + f.cart_digital
           + f.ifood + f.azul + f.rappi + f.food99) > 0
    `, [dias])

    const somaLocal = campos.map((c) => `coalesce(fechamento_caixa.${c}, 0)`).join(' + ')
    let fechOk = 0
    let fechNovos = 0
    for (const row of fechA.rows) {
      const empresaId = porBk.get(row.bk)
      if (!empresaId) continue
      const vals = campos.map((c) => Number(row[c]) || 0)
      const gravou = await meridian.query(`
        INSERT INTO fechamento_caixa (
          id, empresa_id, data, status, observacao,
          ${campos.join(', ')}, atualizado_em
        ) VALUES (
          gen_random_uuid(), $1, $2, COALESCE($3,'rascunho'), COALESCE($4,''),
          ${campos.map((_, i) => `$${i + 5}`).join(', ')}, now()
        )
        ON CONFLICT (empresa_id, data) DO UPDATE SET
          id = COALESCE(fechamento_caixa.id, EXCLUDED.id),
          ${campos.map((c) => `${c} = CASE
            WHEN fechamento_caixa.status = 'fechado' THEN fechamento_caixa.${c}
            WHEN (${somaLocal}) > 0 THEN fechamento_caixa.${c}
            ELSE EXCLUDED.${c}
          END`).join(', ')},
          observacao = CASE
            WHEN fechamento_caixa.status = 'fechado' THEN fechamento_caixa.observacao
            WHEN (${somaLocal}) > 0 THEN fechamento_caixa.observacao
            ELSE COALESCE(EXCLUDED.observacao, fechamento_caixa.observacao)
          END,
          atualizado_em = CASE
            WHEN fechamento_caixa.status = 'fechado' OR (${somaLocal}) > 0 THEN fechamento_caixa.atualizado_em
            ELSE now()
          END
        RETURNING (xmax = 0) AS inserido
      `, [empresaId, row.data, row.status, row.observacao, ...vals])
      fechOk += 1
      if (gravou.rows[0]?.inserido) fechNovos += 1
    }

    const nfcCopiadas = await sincronizarNfc(azimut, meridian, porBk)
    ultimo = { ok: true, statusOk, fechOk, fechNovos, nfcCopiadas, em: new Date().toISOString() }
    return ultimo
  } finally {
    rodando = false
    await Promise.all([azimut.end().catch(() => {}), meridian.end().catch(() => {})])
  }
}

export function iniciarSyncCaixaAzimut(env = process.env) {
  if (env.AZIMUT_CAIXA_SYNC === '0' || env.AZIMUT_CAIXA_SYNC === 'false') {
    console.log('[caixa] ponte Azimut→Meridian desligada (AZIMUT_CAIXA_SYNC=0)')
    return
  }
  const min = Math.max(5, Number(env.AZIMUT_CAIXA_SYNC_MIN || 15) || 15)
  const tick = () => {
    syncCaixaAzimutParaMeridian(env).then((r) => {
      if (r?.skipped) return
      console.log(`[caixa] ponte Azimut→Meridian: ${r.statusOk} status, ${r.fechOk} fechamentos, ${r.fechNovos || 0} novos, ${r.nfcCopiadas || 0} xml`)
    }).catch((err) => {
      console.warn(`[caixa] ponte Azimut falhou: ${err.message}`)
    })
  }
  setTimeout(tick, 12_000)
  setInterval(tick, min * 60_000)
  console.log(`[caixa] ponte Azimut→Meridian a cada ${min} min (enquanto /financas/api/caixa apontar pro Azimut)`)
}
