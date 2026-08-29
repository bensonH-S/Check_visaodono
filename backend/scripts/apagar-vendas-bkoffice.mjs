/**
 * Apaga vendas BK Office (cabeçalho + itens). Não mexe no cadastro de produtos.
 *   node backend/scripts/apagar-vendas-bkoffice.mjs --yes
 */
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'backend', '.env') });

const yes = process.argv.includes('--yes');
const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'vision_check',
  port: Number(process.env.DB_PORT || 5432),
});
await client.connect();

const { rows: before } = await client.query(`
  SELECT
    (SELECT COUNT(*)::int FROM estoque_vendas WHERE origem = 'bkoffice') AS vendas,
    (SELECT COUNT(*)::int FROM estoque_venda_itens vi
       JOIN estoque_vendas v ON v.id_venda = vi.id_venda
      WHERE v.origem = 'bkoffice') AS itens
`);
console.log('Antes:', before[0]);

if (!yes) {
  console.log('Dry-run. Passe --yes para apagar.');
  await client.end();
  process.exit(0);
}

await client.query('BEGIN');
const delItens = await client.query(`
  DELETE FROM estoque_venda_itens vi
  USING estoque_vendas v
  WHERE vi.id_venda = v.id_venda AND v.origem = 'bkoffice'
`);
const delVend = await client.query(`DELETE FROM estoque_vendas WHERE origem = 'bkoffice'`);
await client.query('COMMIT');
console.log(`Apagado: ${delVend.rowCount} vendas, ${delItens.rowCount} itens (produtos vendidos).`);
await client.end();
