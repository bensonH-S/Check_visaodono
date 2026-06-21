import pg from 'pg';
import { logger } from './logger.js';

/** DATE do PostgreSQL como string YYYY-MM-DD (evita bug de fuso no JSON). */
pg.types.setTypeParser(1082, (value) => value);

const ssl =
  process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
    ? { rejectUnauthorized: false }
    : undefined;

export const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl,
});

pool.on('error', (err) => logger.error('db', 'Erro no pool PostgreSQL', { error: err.message }));
