/** Liga DDA↔NF + cria na Agenda as conferidas sem DDA + remove rascunhos ESTOQUE-NFE. */
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
console.log('rascunhos inbox cancelados', canceladas)

const sync = await sincronizarNfesConferidas({ financePool: finance, portalPool: portal })
console.log('sync', sync)

const amostra = await finance.query(`
  select eo.apelido as loja,
         left(coalesce(f.nome, d.descricao), 40) as fornecedor,
         d.numero_nf,
         d.fonte,
         d.nf_ciclo,
         d.valor::float8 as valor,
         to_char(d.vencimento,'YYYY-MM-DD') as venc,
         d.nfe_id
  from despesas d
  join empresas eo on eo.id = d.empresa_origem_id
  left join fornecedores f on f.id = d.fornecedor_id
  where d.fonte = 'nfe'
    and d.status = 'pronta'
    and coalesce(d.nf_confirmada, false)
  order by d.vencimento desc nulls last
  limit 15
`)
console.log('amostra fonte=nfe confirmadas', amostra.rowCount)
console.log(JSON.stringify(amostra.rows, null, 2))

await portal.end()
await finance.end()
