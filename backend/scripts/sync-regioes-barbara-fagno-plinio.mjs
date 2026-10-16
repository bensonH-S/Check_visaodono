/**
 * Alinha frota_regiao_lojas / regionais à planilha:
 * Bárbara, Fagno, Plínio × lojas.
 *
 * Uso:
 *   node backend/scripts/sync-regioes-barbara-fagno-plinio.mjs
 *   node backend/scripts/sync-regioes-barbara-fagno-plinio.mjs --db-prod
 */
import pg from 'pg'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const portalRoot = path.resolve(__dirname, '../..')

function lerEnv(file) {
  if (!fs.existsSync(file)) return {}
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

const env = {
  ...lerEnv(path.join(portalRoot, '.env')),
  ...lerEnv(path.join(portalRoot, 'backend', '.env')),
  ...process.env,
}
const prod = process.argv.includes('--db-prod')
const database = prod
  ? (env.DB_NAME_PROD || env.FINANCE_DB_NAME || 'vision_check')
  : (env.DB_NAME || 'vision_check_dev')

const PLANILHA = [
  { regional: 'Bárbara', lojas: ['POP VAL', 'POPYES VALPARAISO', 'VALPARAISO', 'DF PLAZA', 'CALDAS NOVAS', 'RECANTO', 'RECANTO DAS EMAS', 'SAMAMBAIA', 'PONTE ALTA'] },
  { regional: 'Fagno', lojas: ['408 SUL', 'LAGO SUL', 'SUDOESTE', 'CEILANDIA', 'CEILÂNDIA', 'VENANCIO', 'VENÂNCIO', 'TERRACO', 'TERRAÇO', 'ESTRUTURAL'] },
  { regional: 'Plínio', lojas: ['201 NORTE', '706', '706/7 NORTE', '706 NORTE', 'PLANALTINA', 'SOBRADINHO', 'NOROESTE', 'UNAI', 'UNAÍ', 'SAO SEBASTIAO', 'SÃO SEBASTIÃO'] },
]

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function lojaBate(nomeLoja, aliases) {
  const n = norm(nomeLoja)
  return aliases.some((a) => {
    const al = norm(a)
    return n === al || n.includes(al) || al.includes(n)
  })
}

const pool = new pg.Pool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASS,
  database,
  port: Number(env.DB_PORT || 5432),
  ssl: env.DB_SSL === 'true' || env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
})

async function acharUsuario(client, nome) {
  const chave = norm(nome)
  const { rows } = await client.query(
    `SELECT id_usuario, nome, email
     FROM usuarios
     WHERE coalesce(ativo, true)
     ORDER BY id_usuario`,
  )
  const hits = rows.filter((u) => {
    const n = norm(u.nome)
    const e = norm(u.email || '')
    return n.includes(chave) || e.includes(chave.replace(/ /g, ''))
  })
  if (!hits.length) return null
  hits.sort((a, b) => a.nome.length - b.nome.length)
  return hits[0]
}

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: lojas } = await client.query(
      `SELECT id_loja, name, bk_number FROM lojas WHERE coalesce(is_active, true) ORDER BY name`,
    )
    console.log(`[sync-regioes] banco=${database} lojas=${lojas.length}`)

    for (const bloco of PLANILHA) {
      const user = await acharUsuario(client, bloco.regional)
      if (!user) {
        console.warn(`[sync-regioes] usuario não encontrado: ${bloco.regional}`)
        continue
      }
      console.log(`[sync-regioes] ${bloco.regional} → #${user.id_usuario} ${user.nome}`)

      const { rows: todasReg } = await client.query(
        `SELECT id_regiao, nome, id_regional FROM frota_regioes WHERE ativo ORDER BY id_regiao`,
      )
      const { rows: vinculos } = await client.query(
        `SELECT id_regiao FROM frota_regiao_regionais WHERE id_usuario = $1`,
        [user.id_usuario],
      )
      const idsVinculo = new Set(vinculos.map((r) => r.id_regiao))
      let regioes = todasReg.filter(
        (r) =>
          r.id_regional === user.id_usuario ||
          idsVinculo.has(r.id_regiao) ||
          norm(r.nome).includes(norm(bloco.regional)),
      )
      if (!regioes.length) {
        const { rows: criada } = await client.query(
          `INSERT INTO frota_regioes (nome, descricao, ativo, id_regional)
           VALUES ($1, $2, TRUE, $3)
           RETURNING id_regiao, nome`,
          [`Região ${bloco.regional}`, `Planilha regionais — ${bloco.regional}`, user.id_usuario],
        )
        regioes = criada
        console.log(`[sync-regioes] criada região ${criada[0].nome} (#${criada[0].id_regiao})`)
      }

      const idRegiao = regioes[0].id_regiao
      await client.query(
        `UPDATE frota_regioes SET id_regional = $2, updated_at = NOW() WHERE id_regiao = $1`,
        [idRegiao, user.id_usuario],
      )
      await client.query(
        `INSERT INTO frota_regiao_regionais (id_regiao, id_usuario) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [idRegiao, user.id_usuario],
      )

      const ids = lojas.filter((l) => lojaBate(l.name, bloco.lojas)).map((l) => l.id_loja)
      console.log(`[sync-regioes] ${bloco.regional}: ${ids.length} lojas → região #${idRegiao}`)
      for (const id of ids) {
        // Tira de outras regiões ativas e põe nesta
        await client.query(`DELETE FROM frota_regiao_lojas WHERE id_loja = $1`, [id])
        await client.query(
          `INSERT INTO frota_regiao_lojas (id_regiao, id_loja) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [idRegiao, id],
        )
      }
      for (const l of lojas.filter((x) => ids.includes(x.id_loja))) {
        console.log(`  · ${l.name}`)
      }
    }

    await client.query('COMMIT')
    console.log('[sync-regioes] ok')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[sync-regioes] falhou:', err.message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
