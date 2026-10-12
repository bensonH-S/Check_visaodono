/**
 * Ponte: copia heartbeat (e fechamentos POS recentes) do Azimut → Meridian.
 * Casamento por bk_number.
 *
 *   node scripts/sync-caixa-azimut-para-meridian.mjs
 *   node scripts/sync-caixa-azimut-para-meridian.mjs --dias=45
 */
import dotenv from 'dotenv'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
dotenv.config({ path: path.join(root, '.env') })
dotenv.config({ path: path.join(root, 'backend/.env') })

const dias = Number((process.argv.find((a) => a.startsWith('--dias=')) || '--dias=45').split('=')[1]) || 45
const ssl = process.env.DB_SSL === '1' || process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: false }
  : undefined
const base = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  port: Number(process.env.DB_PORT || 5432),
  ssl,
}

const azimut = new pg.Pool({ ...base, database: 'meridian_finance' })
const meridian = new pg.Pool({
  ...base,
  database: process.env.FINANCE_DB_NAME || process.env.DB_NAME || 'vision_check',
  options: '-c search_path=finance,public',
})

const CAMPOS = [
  'dinheiro', 'pix', 'debito', 'credito', 'cart_digital',
  'ifood', 'azul', 'rappi', 'food99', 'despesas_caixa',
]

async function colunaExiste(pool, schema, tabela, coluna) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [schema, tabela, coluna],
  )
  return rows.length > 0
}

async function main() {
  await meridian.query(`
    CREATE TABLE IF NOT EXISTS caixa_loja_status (
      empresa_id uuid PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
      bk_number text,
      ultimo_ok timestamptz,
      ultimo_dia date,
      ultima_mensagem text
    )
  `)

  const lojasM = await meridian.query(`
    SELECT id, apelido, regexp_replace(coalesce(bk_number,''), '\\D', '', 'g') AS bk
    FROM empresas WHERE ativo AND tipo = 'loja'
  `)
  const porBk = new Map(lojasM.rows.filter((r) => r.bk).map((r) => [r.bk, r]))

  const statusA = await azimut.query(`
    SELECT regexp_replace(coalesce(e.bk_number, s.bk_number, ''), '\\D', '', 'g') AS bk,
           s.ultimo_ok, s.ultimo_dia, s.ultima_mensagem
    FROM caixa_loja_status s
    LEFT JOIN empresas e ON e.id = s.empresa_id
  `)

  let statusOk = 0
  for (const row of statusA.rows) {
    const loja = porBk.get(row.bk)
    if (!loja || !row.ultimo_ok) continue
    await meridian.query(`
      INSERT INTO caixa_loja_status (empresa_id, bk_number, ultimo_ok, ultimo_dia, ultima_mensagem)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (empresa_id) DO UPDATE SET
        bk_number = EXCLUDED.bk_number,
        ultimo_ok = GREATEST(caixa_loja_status.ultimo_ok, EXCLUDED.ultimo_ok),
        ultimo_dia = COALESCE(EXCLUDED.ultimo_dia, caixa_loja_status.ultimo_dia),
        ultima_mensagem = COALESCE(EXCLUDED.ultima_mensagem, caixa_loja_status.ultima_mensagem)
    `, [loja.id, row.bk, row.ultimo_ok, row.ultimo_dia, row.ultima_mensagem || 'sync azimut'])
    statusOk += 1
  }

  const temOrigem = await colunaExiste(azimut, 'public', 'fechamento_caixa', 'origem')
  const temDepositosA = await colunaExiste(azimut, 'public', 'fechamento_caixa', 'depositos_caixa')
  const temDepositosM = await colunaExiste(meridian, 'finance', 'fechamento_caixa', 'depositos_caixa')
  const temBandeirasM = await colunaExiste(meridian, 'finance', 'fechamento_caixa', 'bandeiras')
  const temOrigemM = await colunaExiste(meridian, 'finance', 'fechamento_caixa', 'origem')

  const camposSel = [...CAMPOS]
  if (temDepositosA && temDepositosM) camposSel.push('depositos_caixa')

  const fechA = await azimut.query(`
    SELECT regexp_replace(coalesce(e.bk_number,''), '\\D', '', 'g') AS bk,
           f.data::text AS data,
           ${temOrigem ? 'f.origem' : "'pos'"} AS origem,
           f.status, f.observacao,
           ${camposSel.map((c) => `f.${c}`).join(', ')}
    FROM fechamento_caixa f
    JOIN empresas e ON e.id = f.empresa_id
    WHERE f.data >= (CURRENT_DATE - $1::int)
      AND (
        ${temOrigem ? `coalesce(f.origem,'') IN ('pos','hermes','azimut')` : 'true'}
        OR (f.dinheiro + f.pix + f.debito + f.credito + f.cart_digital + f.ifood + f.azul + f.rappi + f.food99) > 0
      )
  `, [dias])

  let fechOk = 0
  for (const row of fechA.rows) {
    const loja = porBk.get(row.bk)
    if (!loja) continue
    const valores = camposSel.map((c) => Number(row[c]) || 0)
    const sets = camposSel.map((c, i) => `${c} = CASE WHEN fechamento_caixa.status = 'fechado' THEN fechamento_caixa.${c} ELSE $${i + 5} END`)
    const insertCols = ['empresa_id', 'data', 'status', 'observacao', ...camposSel]
    const insertVals = ['$1', '$2', 'COALESCE($3, \'rascunho\')', 'COALESCE($4, \'\')', ...camposSel.map((_, i) => `$${i + 5}`)]
    if (temOrigemM) {
      insertCols.splice(2, 0, 'origem')
      insertVals.splice(2, 0, `'pos'`)
      sets.push(`origem = CASE WHEN fechamento_caixa.status = 'fechado' THEN fechamento_caixa.origem ELSE 'pos' END`)
    }
    if (temBandeirasM) {
      // mantém bandeiras existentes; Hermes no Azimut pode não ter espelhado
    }

    await meridian.query(`
      INSERT INTO fechamento_caixa (${insertCols.join(', ')}, atualizado_em)
      VALUES (${insertVals.join(', ')}, now())
      ON CONFLICT (empresa_id, data) DO UPDATE SET
        ${sets.join(',\n        ')},
        observacao = CASE
          WHEN fechamento_caixa.status = 'fechado' THEN fechamento_caixa.observacao
          ELSE COALESCE(EXCLUDED.observacao, fechamento_caixa.observacao)
        END,
        atualizado_em = now()
    `, [loja.id, row.data, row.status, row.observacao, ...valores])
    fechOk += 1
  }

  const online = await meridian.query(`
    SELECT count(*)::int AS n FROM caixa_loja_status
    WHERE ultimo_ok > now() - interval '26 hours'
  `)

  console.log(JSON.stringify({
    status_sincronizados: statusOk,
    fechamentos_sincronizados: fechOk,
    pdv_online_meridian: online.rows[0].n,
    dias,
  }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await Promise.all([azimut.end(), meridian.end()])
  })
