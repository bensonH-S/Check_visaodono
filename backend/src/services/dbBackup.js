/**
 * Backup lógico do PostgreSQL (SQL) sem depender de pg_dump no Windows.
 * Gera TRUNCATE + INSERT + setval — restaurável em schema já existente.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { pool } from '../db.js';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const BACKUPS_DIR = path.join(ROOT, 'backups');

const BATCH = 200;

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  return BACKUPS_DIR;
}

function sqlIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'NULL';
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (Buffer.isBuffer(value)) return `E'\\\\x${value.toString('hex')}'`;
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

async function listPublicTables(client) {
  const { rows } = await client.query(`
    SELECT c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE 'pg_%'
    ORDER BY c.relname
  `);
  return rows.map((r) => r.name);
}

async function listSequences(client) {
  const { rows } = await client.query(`
    SELECT sequencename AS name, COALESCE(last_value, 0) AS last_value
    FROM pg_sequences
    WHERE schemaname = 'public'
    ORDER BY sequencename
  `);
  return rows;
}

async function tableColumns(client, table) {
  const { rows } = await client.query(
    `
    SELECT a.attname AS name
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = $1
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY a.attnum
    `,
    [table],
  );
  return rows.map((r) => r.name);
}

/**
 * Gera arquivo .sql.gz em backups/ e devolve metadados.
 * @param {{ onProgress?: (msg: string) => void }} opts
 */
export async function gerarBackupSqlGzip(opts = {}) {
  ensureBackupsDir();
  const dbName = process.env.DB_NAME || 'vision_check';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `backup_${dbName}_${stamp}.sql.gz`;
  const filePath = path.join(BACKUPS_DIR, baseName);

  const client = await pool.connect();
  const gzip = createGzip({ level: 6 });
  const out = createWriteStream(filePath);

  const write = async (chunk) =>
    new Promise((resolve, reject) => {
      const ok = gzip.write(chunk, 'utf8');
      if (ok) resolve();
      else gzip.once('drain', resolve);
      gzip.once('error', reject);
    });

  const pipeDone = pipeline(gzip, out).catch((e) => {
    logger.error('backup', 'Falha ao gravar gzip', { error: e.message });
    throw e;
  });

  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

    opts.onProgress?.('Listando tabelas…');
    const tables = await listPublicTables(client);
    const sequences = await listSequences(client);

    await write(`-- Meridian / Vision Check — backup lógico (dados)\n`);
    await write(`-- Gerado em: ${new Date().toISOString()}\n`);
    await write(`-- Banco: ${dbName}\n`);
    await write(`-- Host: ${process.env.DB_HOST || ''}\n`);
    await write(`-- Tabelas: ${tables.length} | Sequences: ${sequences.length}\n`);
    await write(`-- Restauração: descompactar e aplicar em schema já migrado (TRUNCATE + INSERT).\n\n`);
    await write(`SET client_encoding = 'UTF8';\n`);
    await write(`SET session_replication_role = replica;\n\n`);

    if (tables.length) {
      await write(
        `TRUNCATE TABLE ${tables.map((t) => `public.${sqlIdent(t)}`).join(', ')} RESTART IDENTITY CASCADE;\n\n`,
      );
    }

    for (const table of tables) {
      opts.onProgress?.(`Exportando ${table}…`);
      const cols = await tableColumns(client, table);
      if (!cols.length) continue;
      const colList = cols.map(sqlIdent).join(', ');
      let offset = 0;
      let total = 0;
      for (;;) {
        const { rows } = await client.query(
          `SELECT * FROM public.${sqlIdent(table)} LIMIT $1 OFFSET $2`,
          [BATCH, offset],
        );
        if (!rows.length) break;
        for (const row of rows) {
          const values = cols.map((c) => sqlLiteral(row[c])).join(', ');
          await write(
            `INSERT INTO public.${sqlIdent(table)} (${colList}) VALUES (${values});\n`,
          );
        }
        total += rows.length;
        offset += rows.length;
        if (rows.length < BATCH) break;
      }
      await write(`-- ${table}: ${total} linha(s)\n\n`);
    }

    if (sequences.length) {
      await write(`-- Sequences\n`);
      for (const seq of sequences) {
        const n = Number(seq.last_value) || 1;
        await write(
          `SELECT setval('public.${String(seq.name).replace(/'/g, "''")}', ${n}, true);\n`,
        );
      }
      await write(`\n`);
    }

    await write(`SET session_replication_role = DEFAULT;\n`);
    await write(`-- Fim do backup\n`);

    await client.query('COMMIT');

    gzip.end();
    await pipeDone;

    const stat = fs.statSync(filePath);
    logger.info('backup', 'Dump gerado', { file: baseName, bytes: stat.size, tables: tables.length });
    return {
      fileName: baseName,
      filePath,
      sizeBytes: stat.size,
      dbName,
      tables: tables.length,
    };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    gzip.destroy();
    out.destroy();
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

export function listarBackupsLocais() {
  ensureBackupsDir();
  return fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.sql.gz') || f.endsWith('.sql'))
    .map((f) => {
      const full = path.join(BACKUPS_DIR, f);
      const st = fs.statSync(full);
      return {
        fileName: f,
        sizeBytes: st.size,
        createdAt: st.mtime.toISOString(),
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function caminhoBackupSeguro(fileName) {
  const safe = path.basename(String(fileName || ''));
  if (!safe || safe !== fileName || safe.includes('..')) return null;
  if (!safe.endsWith('.sql.gz') && !safe.endsWith('.sql')) return null;
  const full = path.join(BACKUPS_DIR, safe);
  if (!full.startsWith(BACKUPS_DIR)) return null;
  if (!fs.existsSync(full)) return null;
  return full;
}

export { BACKUPS_DIR };
