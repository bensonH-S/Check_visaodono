/**
 * Remove NCs de itens cuja observação indica "não se aplica" (dados antigos).
 * Uso: node backend/scripts/limpar-ncs-nao-aplica.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

const { rowCount } = await pool.query(`
  DELETE FROM nao_conformidades
  WHERE area <> 'Resultado geral'
    AND (
      descricao ~* 'obs\\.?:.*n[aã]o se aplica'
      OR descricao ~* 'obs\\.?:.*n[aã]o aplica'
      OR descricao ~* 'sem m[aá]quina'
      OR descricao ~* 'j[aá] estamos sem'
    )
`);

console.log(`${rowCount} NC(s) removida(s) (itens marcados como não se aplica).`);
await pool.end();
