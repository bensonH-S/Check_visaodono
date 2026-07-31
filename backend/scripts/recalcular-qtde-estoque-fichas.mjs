/**
 * Recalcula qtde_estoque de todas as fichas (corrige descartáveis tratados como kg).
 * node backend/scripts/recalcular-qtde-estoque-fichas.mjs
 */
import 'dotenv/config';
import pg from 'pg';
import { qtdeReceitaParaEstoque } from '../src/services/fichaReceitaEstoque.js';

const dbName = process.env.DB_NAME || '';
if (!/dev/i.test(dbName)) {
  console.error('ABORT: só DEV');
  process.exit(1);
}

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: { rejectUnauthorized: false },
});

const { rows } = await pool.query(`
  SELECT i.id_item, i.quantidade, i.unidade_receita, i.qtde_estoque,
         ins.descricao, ins.und_convertida, ins.valor_unidade,
         p.codigo AS prod
  FROM ficha_tecnica_itens i
  JOIN ficha_tecnica f ON f.id_ficha = i.id_ficha
  JOIN produtos p ON p.id_produto = f.id_produto
  LEFT JOIN insumos ins
    ON ins.id_loja = p.id_loja AND UPPER(ins.codigo) = UPPER(i.codigo_insumo)
`);

let upd = 0;
const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const r of rows) {
    const nova = qtdeReceitaParaEstoque(
      Number(r.quantidade),
      r.unidade_receita || 'und',
      { descricao: r.descricao, und_convertida: r.und_convertida },
    );
    if (Math.abs(nova - Number(r.qtde_estoque || 0)) > 1e-9) {
      await client.query(`UPDATE ficha_tecnica_itens SET qtde_estoque = $1 WHERE id_item = $2`, [
        nova,
        r.id_item,
      ]);
      upd += 1;
    }
  }
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}

const check = await pool.query(`
  SELECT i.codigo_insumo, i.quantidade, i.unidade_receita, i.qtde_estoque,
         ROUND((i.qtde_estoque * COALESCE(ins.valor_unidade,0))::numeric, 4) AS custo,
         ins.descricao
  FROM ficha_tecnica_itens i
  JOIN ficha_tecnica f ON f.id_ficha = i.id_ficha
  JOIN produtos p ON p.id_produto = f.id_produto
  LEFT JOIN insumos ins ON ins.id_loja = p.id_loja AND UPPER(ins.codigo)=UPPER(i.codigo_insumo)
  WHERE p.codigo = '8000290'
  ORDER BY i.codigo_insumo
  LIMIT 20
`);
console.log('atualizados', upd, '/', rows.length);
console.log(check.rows);
await pool.end();
