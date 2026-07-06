/**
 * Lista rankings/painéis de metas sem id_loja e testa o resolver.
 * Uso: node backend/scripts/diagnose-metas-lojas.mjs [id_periodo]
 */
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import { carregarLojas, resolverLoja, norm } from './metasLojaResolver.mjs';

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

try {
  const client = await pool.connect();
  try {
    const lojasDb = await carregarLojas(client);
    const ativas = lojasDb.rows.filter((l) => !norm(l.name).startsWith('ga -'));
    console.log(`Lojas ativas no cadastro: ${ativas.length}\n`);

    const rankings = await client.query(
      `SELECT DISTINCT nome_loja_planilha FROM metas_rankings
       WHERE id_periodo = $1 AND id_loja IS NULL AND nome_loja_planilha IS NOT NULL
       ORDER BY 1`,
      [idPeriodo],
    );
    console.log(`Rankings sem id_loja (período ${idPeriodo}): ${rankings.rows.length}`);
    for (const { nome_loja_planilha } of rankings.rows) {
      const hit = resolverLoja(lojasDb, nome_loja_planilha);
      console.log(`  ${hit ? '✓' : '✗'} ${nome_loja_planilha} → ${hit ? hit.name : '(sem match)'}`);
    }

    const painel = await client.query(
      `SELECT DISTINCT pl.rotulo_curto FROM metas_painel_lojas pl
       JOIN metas_paineis p ON p.id_painel = pl.id_painel
       WHERE p.id_periodo = $1 AND pl.id_loja IS NULL
       ORDER BY 1`,
      [idPeriodo],
    );
    console.log(`\nPainéis resumo sem id_loja: ${painel.rows.length}`);
    for (const { rotulo_curto } of painel.rows) {
      const hit = resolverLoja(lojasDb, rotulo_curto);
      console.log(`  ${hit ? '✓' : '✗'} ${rotulo_curto} → ${hit ? hit.name : '(sem match)'}`);
    }
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
