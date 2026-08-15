import pg from 'pg';
import { logger } from './logger.js';

/** DATE do PostgreSQL como string YYYY-MM-DD (evita bug de fuso no JSON). */
pg.types.setTypeParser(1082, (value) => value);

/**
 * Local (`npm run dev`): sempre vision_check_dev.
 * Produção (`--production` / NODE_ENV=production): DB_NAME ou vision_check.
 */
export function resolveDbName({
  env = process.env,
  argv = process.argv,
} = {}) {
  const isProd = argv.includes('--production') || env.NODE_ENV === 'production';
  if (!isProd) return 'vision_check_dev';
  return String(env.DB_NAME || '').trim() || 'vision_check';
}

const dbName = resolveDbName();
process.env.DB_NAME = dbName;

const ssl =
  process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
    ? { rejectUnauthorized: false }
    : undefined;

export const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: dbName,
  port: Number(process.env.DB_PORT || 5432),
  ssl,
});

pool.on('error', (err) => logger.error('db', 'Erro no pool PostgreSQL', { error: err.message }));

export const hrPool = new pg.Pool({
  host: process.env.HR_DB_HOST || '15.204.244.132',
  user: process.env.HR_DB_USER || 'alvim',
  password: process.env.HR_DB_PASS || '1=scvBM=2tR1&N',
  database: process.env.HR_DB_NAME || 'hr_payroll',
  port: Number(process.env.HR_DB_PORT || 5432),
  connectionTimeoutMillis: 5000,
});

hrPool.on('error', (err) => logger.error('db', 'Erro no pool HR PostgreSQL', { error: err.message }));
