/**
 * Liga uma loja operacional aos painéis de um período de metas.
 * Uso:
 *   node backend/scripts/ligar-loja-metas-painel.mjs [id_periodo] [rotulo] [codigo_painel...]
 * Ex.:
 *   node backend/scripts/ligar-loja-metas-painel.mjs 2 "BK TERRACO" empresa_grupo2 gestor_grupo2
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
const rotulo = process.argv[3] || 'BK TERRACO';
const paineis = process.argv.slice(4);
const codigosPainel = paineis.length ? paineis : ['empresa_grupo2', 'gestor_grupo2'];

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
  const loja = resolverLoja(lojasDb, rotulo);
  if (!loja) throw new Error(`Loja não resolvida para rótulo: ${rotulo}`);
  if (!loja.bk_number) throw new Error(`Loja sem bk_number: ${loja.name}`);

  console.log(`Período #${idPeriodo}`);
  console.log(`Loja: #${loja.id_loja} ${loja.name} (BK ${loja.bk_number})`);
  console.log(`Rótulo: ${rotulo}`);

  for (const codigo of codigosPainel) {
    const { rows } = await client.query(
      `SELECT id_painel FROM metas_paineis WHERE id_periodo = $1 AND codigo = $2`,
      [idPeriodo, codigo],
    );
    if (!rows[0]) throw new Error(`Painel ${codigo} não encontrado no período ${idPeriodo}`);
    const idPainel = rows[0].id_painel;

    const exists = await client.query(
      `SELECT 1 FROM metas_painel_lojas WHERE id_painel = $1 AND id_loja = $2`,
      [idPainel, loja.id_loja],
    );
    if (exists.rows.length) {
      console.log(`Já ligada em ${codigo}`);
      continue;
    }

    const maxOrdem = await client.query(
      `SELECT COALESCE(MAX(ordem), -1)::int AS m FROM metas_painel_lojas WHERE id_painel = $1`,
      [idPainel],
    );
    const ordem = maxOrdem.rows[0].m + 1;

    await client.query(
      `INSERT INTO metas_painel_lojas (id_painel, id_loja, rotulo_curto, ordem)
       VALUES ($1, $2, $3, $4)`,
      [idPainel, loja.id_loja, rotulo, ordem],
    );
    console.log(`Inserida em ${codigo} (ordem ${ordem})`);
  }

  await client.query('COMMIT');

  const check = await client.query(
    `
    SELECT COUNT(DISTINCT l.id_loja)::int AS presentes
    FROM metas_painel_lojas pl
    JOIN metas_paineis p ON p.id_painel = pl.id_painel
    JOIN lojas l ON l.id_loja = pl.id_loja
    WHERE p.id_periodo = $1
  `,
    [idPeriodo],
  );
  const missing = await client.query(
    `
    SELECT l.name
    FROM lojas l
    WHERE l.is_active AND l.bk_number IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM metas_painel_lojas pl
        JOIN metas_paineis p ON p.id_painel = pl.id_painel
        WHERE pl.id_loja = l.id_loja AND p.id_periodo = $1
      )
    ORDER BY l.name
  `,
    [idPeriodo],
  );
  console.log(`\nPresentes no período: ${check.rows[0].presentes}`);
  console.log(
    missing.rows.length
      ? `Ainda ausentes: ${missing.rows.map((r) => r.name).join(', ')}`
      : 'Nenhuma operacional ausente.',
  );
} catch (e) {
  await client.query('ROLLBACK');
  console.error('Falha:', e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
