/**
 * Puxa NF-e destinadas ao CNPJ na Receita (Ambiente Nacional).
 *   node scripts/sync-sefaz-nfe.mjs --db=prod
 *   node scripts/sync-sefaz-nfe.mjs --cnpj=26075154000136 --db=prod
 */
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..', '..')
dotenv.config({ path: path.join(root, '.env'), override: false })
dotenv.config({ path: path.join(root, 'backend', '.env'), override: true })

const args = process.argv.slice(2)
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`))
  return hit ? hit.slice(k.length + 1) : def
}

const dbFlag = getArg('--db', 'prod')
if (dbFlag === 'prod') {
  process.env.DB_NAME = process.env.DB_NAME_PROD || process.env.DB_NAME || 'vision_check'
  process.env.NODE_ENV = 'production'
  process.env.DB_USE_PROD = '1'
} else {
  process.env.DB_NAME = process.env.DB_NAME_DEV || 'vision_check_dev'
  process.env.NODE_ENV = 'development'
  delete process.env.DB_USE_PROD
}

const cnpj = String(getArg('--cnpj', '')).replace(/\D/g, '')

const { pool } = await import('../src/db.js')
const { coletarNotasReceita, listarNotasReceita } = await import('../src/financeiro/lib/syncNfeSefaz.mjs')

const finance = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
  options: '-c search_path=finance,public',
})

try {
  console.log(`[sefaz] banco ${process.env.DB_NAME}${cnpj ? ` cnpj ${cnpj}` : ' todas as lojas'}`)
  const resultado = await coletarNotasReceita(finance, cnpj ? { cnpj } : {})
  console.log(`[sefaz] ${resultado.mensagem}`)
  const notas = await listarNotasReceita(finance)
  const desta = cnpj
    ? notas.filter((n) => String(n.cnpj_empresa).replace(/\D/g, '') === cnpj)
    : notas
  console.log(`[sefaz] ${desta.length} nota(s) listadas no inbox`)
  const porLoja = await finance.query(
    `SELECT COALESCE(e.apelido, n.cnpj_empresa) AS loja, COUNT(*)::int AS n, MAX(n.emissao)::text AS ultima
     FROM nfe_recebida n
     LEFT JOIN empresas e ON e.id = n.empresa_id
     GROUP BY 1
     ORDER BY 1`,
  )
  for (const linha of porLoja.rows) console.log(`- ${linha.loja}: ${linha.n} nota(s), até ${linha.ultima || 's/ data'}`)
  const gestor = await pool.query(
    `SELECT COUNT(*)::int AS n FROM estoque_nfe WHERE fornecedor = 'sefaz'`,
  )
  console.log(`[sefaz] ${gestor.rows[0].n} nota(s) no gestor`)
} finally {
  await finance.end()
  await pool.end()
}
