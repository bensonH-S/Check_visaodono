/**
 * Limpa sync de multas DETRAN do dia (permite nova tentativa após correção de config).
 * Uso: node backend/scripts/limpar-sync-multas-hoje.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: true });

const c = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
});
await c.connect();

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
const dia = `${parts.year}-${parts.month}-${parts.day}`;

await c.query('DELETE FROM frota_multas_detran');
const del = await c.query('DELETE FROM frota_multas_detran_sync WHERE data_ref = $1::date RETURNING id_sync, status', [
  dia,
]);
console.log(`Limpo sync do dia ${dia}:`, del.rows);
await c.end();
