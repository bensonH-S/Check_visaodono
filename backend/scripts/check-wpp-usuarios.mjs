import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432,
});

const { rows } = await pool.query(`
  SELECT id_usuario, nome, email, telefone_whatsapp, notifica_whatsapp, cargo_aprovacao
  FROM usuarios
  WHERE LOWER(email) IN (
    'plinio@grupoalvim.com.br',
    'frotadf@gmail.com',
    'barbara@grupoalvim.com.br',
    'fagno@grupoalvim.com.br',
    'felipe@grupoalvim.com.br'
  )
  ORDER BY nome
`);
console.table(rows);
await pool.end();
