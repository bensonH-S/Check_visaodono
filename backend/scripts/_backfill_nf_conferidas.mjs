/** Marca NF confirmada na Agenda + remove duplicatas ESTOQUE-NFE do Inbox. */
import dotenv from 'dotenv'
import pg from 'pg'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import {
  cancelarDuplicatasNfeInbox,
  sincronizarNfesConferidas,
} from '../src/financeiro/lib/nfEntrada.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const portalRoot = path.join(root, '..')
dotenv.config({ path: path.join(root, '.env') })

function lerEnvArquivo(arquivo) {
  if (!fs.existsSync(arquivo)) return {}
  const out = {}
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}

const arquivo = {
  ...lerEnvArquivo(path.join(portalRoot, '.env')),
  ...lerEnvArquivo(path.join(root, '.env')),
}
const financeDb =
  process.env.FINANCE_DB_NAME || arquivo.FINANCE_DB_NAME || arquivo.DB_NAME_PROD || process.env.DB_NAME || 'vision_check'
const portalDb = process.env.DB_NAME || 'vision_check'
const cfg = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  port: Number(process.env.DB_PORT || 5432),
}

const portal = new pg.Client({ ...cfg, database: portalDb })
const finance = new pg.Client({
  ...cfg,
  database: financeDb,
  options: '-c search_path=finance,public',
})

await portal.connect()
await finance.connect()

const canceladas = await cancelarDuplicatasNfeInbox(finance)
console.log('duplicatas inbox canceladas', canceladas)

const sync = await sincronizarNfesConferidas({ financePool: finance, portalPool: portal })
console.log('sync', sync)

const semana = await finance.query(`
  select
    count(*) filter (where coalesce(nf_confirmada,false))::int as com_selo,
    count(*) filter (where not coalesce(nf_confirmada,false))::int as sem_selo
  from despesas
  where status in ('pronta','autorizada','enviada')
    and vencimento between '2026-10-18' and '2026-10-25'
`)
console.log('agenda semana', semana.rows[0])

await portal.end()
await finance.end()
