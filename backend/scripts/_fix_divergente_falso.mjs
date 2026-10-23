/**
 * NF marcada divergente sem falta em nenhum item (itens sem insumo no cadastro).
 * Uso: node scripts/_fix_divergente_falso.mjs [--aplicar]
 */
import dotenv from 'dotenv'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env') })
const aplicar = process.argv.includes('--aplicar')
const c = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  port: Number(process.env.DB_PORT || 5432),
  database: 'vision_check',
})
await c.connect()
const { rows } = await c.query(`
  select n.id_nfe, n.id_loja, l.name as loja, n.numero, n.valor_total::float8 as valor
  from estoque_nfe n
  join lojas l on l.id_loja = n.id_loja
  where n.status_entrega = 'divergente'
    and n.entrada_registrada
    and exists (select 1 from estoque_nfe_itens i where i.id_nfe = n.id_nfe)
    and not exists (
      select 1 from estoque_nfe_itens i
      where i.id_nfe = n.id_nfe
        and (i.qtd_conferida is null
             or i.qtd_conferida < coalesce(i.qtd_estoque, i.q_com, 0) - 0.0001)
    )
  order by l.name, n.numero
`)
console.log(`${rows.length} NF divergente sem falta`)
for (const r of rows) console.log(`${r.loja} | NF ${r.numero} | R$ ${r.valor} | id ${r.id_nfe}`)
if (aplicar && rows.length) {
  const ids = rows.map((r) => r.id_nfe)
  const u = await c.query(
    `update estoque_nfe set status_entrega = 'conferida', atualizado_em = now()
     where id_nfe = any($1::int[]) and status_entrega = 'divergente'`,
    [ids],
  )
  console.log(`atualizadas ${u.rowCount}: ${ids.join(',')}`)
}
await c.end()
