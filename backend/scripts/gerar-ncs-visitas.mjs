/**
 * Gera NCs para visitas finalizadas que ainda não têm NC vinculada.
 * Uso: node backend/scripts/gerar-ncs-visitas.mjs [--limite=100]
 */
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import { gerarNcsFromVisita } from '../src/naoConformidadesChecklist.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const limiteArg = process.argv.find((a) => a.startsWith('--limite='));
const limite = limiteArg ? Number(limiteArg.split('=')[1]) : 500;

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

const { rows: visitas } = await pool.query(
  `SELECT v.id_visita
   FROM visitas v
   WHERE v.status = 'Finalizada'
     AND NOT EXISTS (SELECT 1 FROM nao_conformidades nc WHERE nc.id_visita = v.id_visita)
   ORDER BY v.data_visita DESC, v.id_visita DESC
   LIMIT $1`,
  [limite],
);

console.log(`Visitas finalizadas sem NC: ${visitas.length}`);

let totalCriadas = 0;
for (const { id_visita } of visitas) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await gerarNcsFromVisita(client, id_visita);
    await client.query('COMMIT');
    if (result.criadas > 0) {
      console.log(`  Visita #${id_visita}: ${result.criadas} NC(s)`);
      totalCriadas += result.criadas;
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`  Visita #${id_visita}: ERRO —`, e.message);
  } finally {
    client.release();
  }
}

console.log(`\nTotal: ${totalCriadas} NC(s) criadas.`);
await pool.end();
