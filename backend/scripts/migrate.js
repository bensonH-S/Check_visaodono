import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '..', 'migrations', '001_schema.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
});

try {
  await client.connect();
  console.log('Aplicando migration em', process.env.DB_NAME, '...');
  await client.query(sql);
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY 1
  `);
  console.log('OK — tabelas:', tables.rows.map((r) => r.table_name).join(', '));
} catch (err) {
  console.error('Falha na migration:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
