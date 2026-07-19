/**
 * Recalcula lojas.nota_atual / ultima_visita a partir das visitas finalizadas.
 * Uso:
 *   node backend/scripts/sincronizar-notas-lojas.mjs           # preview
 *   node backend/scripts/sincronizar-notas-lojas.mjs --apply   # aplica
 *   node backend/scripts/sincronizar-notas-lojas.mjs --db vision_check --apply
 */
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: true });

const aplicar = process.argv.includes('--apply');
const dbArg = process.argv.find((a) => a.startsWith('--db='));
const dbIdx = process.argv.indexOf('--db');
const database =
  (dbArg && dbArg.slice(5)) ||
  (dbIdx >= 0 ? process.argv[dbIdx + 1] : null) ||
  process.env.DB_NAME ||
  'vision_check_dev';

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database,
  port: Number(process.env.DB_PORT || 5432),
  ssl:
    process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
      ? { rejectUnauthorized: false }
      : undefined,
});

const SQL_ORPHANS = `
  SELECT l.id_loja, l.name, l.nota_atual, l.ultima_visita,
         uv.nota_final AS nota_correta, uv.data_visita AS visita_correta
  FROM lojas l
  LEFT JOIN LATERAL (
    SELECT v.nota_final, v.data_visita
    FROM visitas v
    WHERE v.id_loja = l.id_loja
      AND v.status = 'Finalizada'
      AND v.nota_final IS NOT NULL
    ORDER BY v.data_visita DESC, v.id_visita DESC
    LIMIT 1
  ) uv ON TRUE
  WHERE
    (uv.nota_final IS NULL AND (l.ultima_visita IS NOT NULL OR COALESCE(l.nota_atual, 0) <> 0))
    OR (uv.nota_final IS NOT NULL AND (
      l.nota_atual IS DISTINCT FROM uv.nota_final
      OR l.ultima_visita IS DISTINCT FROM uv.data_visita
    ))
  ORDER BY l.name
`;

try {
  console.log(`[sync-notas] banco=${database} modo=${aplicar ? 'APPLY' : 'preview'}`);
  const { rows } = await pool.query(SQL_ORPHANS);
  if (!rows.length) {
    console.log('Nenhuma loja dessincronizada.');
  } else {
    for (const r of rows) {
      console.log(
        `#${r.id_loja} ${r.name}: ${r.nota_atual}@${r.ultima_visita || '—'} → ${
          r.nota_correta != null ? `${r.nota_correta}@${r.visita_correta}` : '0@NULL'
        }`,
      );
    }
  }

  if (aplicar && rows.length) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of rows) {
        if (r.nota_correta != null) {
          await client.query(
            `UPDATE lojas
             SET nota_atual = $1, ultima_visita = $2, updated_at = NOW()
             WHERE id_loja = $3`,
            [r.nota_correta, r.visita_correta, r.id_loja],
          );
        } else {
          await client.query(
            `UPDATE lojas
             SET nota_atual = 0, ultima_visita = NULL, updated_at = NOW()
             WHERE id_loja = $1`,
            [r.id_loja],
          );
        }
      }
      await client.query('COMMIT');
      console.log(`Atualizadas ${rows.length} loja(s).`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } else if (!aplicar && rows.length) {
    console.log('Dry-run. Rode com --apply para gravar.');
  }
} finally {
  await pool.end();
}
