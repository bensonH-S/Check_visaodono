/**
 * Desliga piloto_baixa em todas as lojas.
 *   node scripts/_op_piloto_off_todas.mjs
 *   node scripts/_op_piloto_off_todas.mjs --apply
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });
process.env.NODE_ENV = 'production';
process.env.DB_NAME = 'vision_check';
if (!process.argv.includes('--production')) process.argv.push('--production');

const apply = process.argv.includes('--apply');
const { pool } = await import('../src/db.js');

const { rows: before } = await pool.query(`
  SELECT l.id_loja, l.name, COALESCE(p.piloto_baixa, FALSE) AS piloto_baixa
  FROM lojas l
  LEFT JOIN lojas_estoque_perfil p ON p.id_loja = l.id_loja
  WHERE l.bk_number IS NOT NULL AND TRIM(l.bk_number::text) <> ''
  ORDER BY l.name
`);

const on = before.filter((r) => r.piloto_baixa);
console.log(
  JSON.stringify(
    { apply, total: before.length, piloto_on: on.length, on: on.map((x) => x.name) },
    null,
    2,
  ),
);

if (!apply) {
  console.log('Dry-run. Use --apply para desligar.');
  await pool.end();
  process.exit(0);
}

const upd = await pool.query(`
  UPDATE lojas_estoque_perfil
  SET piloto_baixa = FALSE, atualizado_em = NOW()
  WHERE piloto_baixa IS DISTINCT FROM FALSE
`);

const ins = await pool.query(`
  INSERT INTO lojas_estoque_perfil (id_loja, piloto_baixa, atualizado_em)
  SELECT l.id_loja, FALSE, NOW()
  FROM lojas l
  WHERE l.bk_number IS NOT NULL AND TRIM(l.bk_number::text) <> ''
    AND NOT EXISTS (SELECT 1 FROM lojas_estoque_perfil p WHERE p.id_loja = l.id_loja)
`);

const { rows: after } = await pool.query(`
  SELECT COUNT(*)::int n,
         COUNT(*) FILTER (WHERE piloto_baixa)::int piloto_on
  FROM lojas_estoque_perfil
`);

console.log(
  JSON.stringify({ ok: true, updated: upd.rowCount, inserted: ins.rowCount, after: after[0] }, null, 2),
);
await pool.end();
