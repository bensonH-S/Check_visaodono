import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env'), override: true });

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME_DEV || 'vision_check_dev',
  port: Number(process.env.DB_PORT || 5432),
});

const { rows } = await pool.query(
  `UPDATE frota_multas_detran_sync
   SET avisos = '[]'::jsonb,
       fonte = 'detran-portal'
   WHERE id_sync = (
     SELECT id_sync FROM frota_multas_detran_sync ORDER BY id_sync DESC LIMIT 1
   )
   RETURNING id_sync, status, fonte, data_ref`,
);
console.log('cache limpo:', rows[0] || null);
await pool.end();
