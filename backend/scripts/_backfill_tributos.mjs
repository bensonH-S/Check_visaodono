/** Classifica + confere tributos (linha digitável × Agenda). */
import dotenv from 'dotenv'
import pg from 'pg'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { sincronizarConferenciaTributos } from '../src/financeiro/lib/conferirTributo.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const portalRoot = path.join(root, '..')
dotenv.config({ path: path.join(root, '.env') })

function ler(p) {
  if (!fs.existsSync(p)) return {}
  const o = {}
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return o
}
const arquivo = { ...ler(path.join(portalRoot, '.env')), ...ler(path.join(root, '.env')) }
const finance = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  port: Number(process.env.DB_PORT || 5432),
  database: arquivo.FINANCE_DB_NAME || arquivo.DB_NAME_PROD || process.env.DB_NAME || 'vision_check',
  options: '-c search_path=finance,public',
})
await finance.connect()
const r = await sincronizarConferenciaTributos(finance)
console.log(r)
const amostra = await finance.query(`
  select eo.apelido, left(d.descricao,40) as desc, d.tributo_tipo, d.conferencia_status,
         d.valor::float8, left(coalesce(d.conferencia_detalhe,''),120) as detalhe
  from despesas d
  join empresas eo on eo.id = d.empresa_origem_id
  where d.tributo_tipo is not null and d.status <> 'cancelada'
  order by d.conferencia_status nulls last, d.vencimento desc
  limit 20
`)
console.log(JSON.stringify(amostra.rows, null, 2))
await finance.end()
