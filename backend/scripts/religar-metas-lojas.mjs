/**
 * Re-vincula id_loja em metas_rankings e metas_painel_lojas (sem precisar da planilha).
 * Uso: node backend/scripts/religar-metas-lojas.mjs [id_periodo]
 */
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import { carregarLojas, resolverLoja } from './metasLojaResolver.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const idPeriodo = Number(process.argv[2] || 2);

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

const client = await pool.connect();
try {
  await client.query('BEGIN');
  const lojasDb = await carregarLojas(client);

  const rankings = await client.query(
    `SELECT id_ranking, nome_loja_planilha, id_loja FROM metas_rankings WHERE id_periodo = $1`,
    [idPeriodo],
  );
  let rankOk = 0;
  for (const row of rankings.rows) {
    const loja = resolverLoja(lojasDb, row.nome_loja_planilha);
    if (loja && loja.id_loja !== row.id_loja) {
      await client.query(`UPDATE metas_rankings SET id_loja = $1 WHERE id_ranking = $2`, [
        loja.id_loja,
        row.id_ranking,
      ]);
      rankOk += 1;
    }
  }

  const painel = await client.query(
    `SELECT pl.id_painel, pl.rotulo_curto, pl.id_loja
     FROM metas_painel_lojas pl
     JOIN metas_paineis p ON p.id_painel = pl.id_painel
     WHERE p.id_periodo = $1`,
    [idPeriodo],
  );
  let painelOk = 0;
  for (const row of painel.rows) {
    const loja = resolverLoja(lojasDb, row.rotulo_curto);
    if (loja && loja.id_loja !== row.id_loja) {
      await client.query(
        `UPDATE metas_painel_lojas SET id_loja = $1 WHERE id_painel = $2 AND rotulo_curto = $3`,
        [loja.id_loja, row.id_painel, row.rotulo_curto],
      );
      painelOk += 1;
    }
  }

  await client.query('COMMIT');
  console.log(`Período ${idPeriodo}: ${rankOk} rankings e ${painelOk} painéis re-vinculados.`);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
  await pool.end();
}
