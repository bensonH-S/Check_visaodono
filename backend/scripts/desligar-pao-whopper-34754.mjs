/**
 * Pão Whopper no eSupri é só 034754. 34754 é duplicata (mesmo pão, sem zero).
 *   node backend/scripts/desligar-pao-whopper-34754.mjs --yes --db=dev
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, 'backend', '.env') });

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const dbFlag = args.find((a) => a.startsWith('--db='))?.slice(5) || 'prod';
const DB_NAME = dbFlag === 'dev' ? 'vision_check_dev' : dbFlag === 'prod' ? 'vision_check' : dbFlag;

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
});
await client.connect();
try {
  const { rows } = await client.query(`
    SELECT l.name, a.codigo AS dup, a.ativo AS dup_ativo, a.contagem_diaria AS dup_d,
           b.codigo AS keep, b.ativo AS keep_ativo, b.contagem_diaria AS keep_d
    FROM insumos a
    JOIN insumos b ON b.id_loja = a.id_loja AND b.codigo = '034754'
    JOIN lojas l ON l.id_loja = a.id_loja
    WHERE a.codigo = '34754'
      AND COALESCE(l.is_active, TRUE) AND l.name ILIKE '%burger king%'
    ORDER BY l.name
  `);
  console.log(`banco=${DB_NAME} pares=${rows.length}`);
  for (const r of rows.slice(0, 5)) {
    console.log(`  ${r.name}: ${r.dup} d=${r.dup_d}/a=${r.dup_ativo} → ${r.keep} d=${r.keep_d}/a=${r.keep_ativo}`);
  }
  if (!yes) {
    console.log('dry: use --yes');
    process.exit(0);
  }
  await client.query('BEGIN');
  const off = await client.query(`
    UPDATE insumos i
    SET ativo = FALSE, contagem_diaria = FALSE, contagem_critica = FALSE, atualizado_em = NOW()
    FROM lojas l
    WHERE i.id_loja = l.id_loja
      AND COALESCE(l.is_active, TRUE) AND l.name ILIKE '%burger king%'
      AND i.codigo = '34754'
  `);
  const on = await client.query(`
    UPDATE insumos i
    SET ativo = TRUE, contagem_diaria = TRUE, grupo_diario = 'pao', atualizado_em = NOW()
    FROM lojas l
    WHERE i.id_loja = l.id_loja
      AND COALESCE(l.is_active, TRUE) AND l.name ILIKE '%burger king%'
      AND i.codigo = '034754'
  `);
  await client.query(`
    UPDATE estoque_itens i
    SET id_insumo = k.id_insumo
    FROM estoque_contagens c, insumos d, insumos k
    WHERE i.id_contagem = c.id_contagem
      AND c.status = 'aberta'
      AND i.id_insumo = d.id_insumo AND d.codigo = '34754'
      AND k.id_loja = d.id_loja AND k.codigo = '034754'
      AND NOT EXISTS (
        SELECT 1 FROM estoque_itens x
        WHERE x.id_contagem = i.id_contagem AND x.id_insumo = k.id_insumo
      )
  `);
  const rem = await client.query(`
    DELETE FROM estoque_itens i
    USING estoque_contagens c, insumos p
    WHERE i.id_contagem = c.id_contagem
      AND c.status = 'aberta'
      AND i.id_insumo = p.id_insumo
      AND p.codigo = '34754'
  `);
  await client.query('COMMIT');
  console.log(`ok off_34754=${off.rowCount} on_034754=${on.rowCount} abertas_rem=${rem.rowCount}`);
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(e);
  process.exit(1);
} finally {
  await client.end();
}
