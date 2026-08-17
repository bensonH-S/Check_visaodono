/**
 * Importa a planilha Escala de folga Gestores — AGOSTO 2026.
 * Uso:
 *   node backend/scripts/seed-escala-gestores-agosto-2026.mjs
 *   node backend/scripts/seed-escala-gestores-agosto-2026.mjs --db=vision_check
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import XLSX from 'xlsx';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const argDb = process.argv.find((a) => a.startsWith('--db='));
const DB_NAME = argDb ? argDb.slice(5) : process.env.DB_NAME || 'vision_check_dev';
const XLSX_PATH =
  process.argv.find((a) => a.startsWith('--xlsx='))?.slice(7) ||
  'f:/Users/Benson/Downloads/Escala de folga Gestores Agosto 2026  .xlsx';

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function tipoCelula(v) {
  const n = norm(v);
  if (!n) return null;
  if (n.includes('ferias')) return 'ferias';
  if (n === 'folga') return 'folga';
  if (n === 'falta') return 'falta';
  if (n.includes('ausencia')) return 'ausencia';
  return null;
}

function bkNum(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!s || s === '#REF!') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(Math.round(n));
}

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

if (!fs.existsSync(XLSX_PATH)) {
  console.error('Planilha não encontrada:', XLSX_PATH);
  process.exit(1);
}

const wb = XLSX.readFile(XLSX_PATH);
const horarioName = wb.SheetNames.find((n) => norm(n).includes('horario'));
const agostoName = wb.SheetNames.find((n) => norm(n).includes('agosto') && n.includes('2026'));
if (!agostoName) {
  console.error('Aba AGOSTO 2026 não encontrada. Abas:', wb.SheetNames);
  process.exit(1);
}

const folgaPadraoPorBk = new Map();
if (horarioName) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[horarioName], { header: 1, defval: '' });
  for (const row of rows) {
    const bk = bkNum(row[0]);
    const padrao = String(row[10] || '').trim();
    if (bk && padrao) folgaPadraoPorBk.set(bk, padrao);
  }
}

const agosto = XLSX.utils.sheet_to_json(wb.Sheets[agostoName], { header: 1, defval: '' });
const diasHeader = (agosto[3] || []).map((v) => Number(v));
// col 3 = dia 1 de agosto
const ANO = 2026;
const MES = 8;

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_gestores (
      id_gestor SERIAL PRIMARY KEY,
      id_loja INTEGER REFERENCES lojas(id_loja) ON DELETE SET NULL,
      bk_number TEXT,
      nome TEXT NOT NULL,
      grupo TEXT NOT NULL DEFAULT 'loja'
        CHECK (grupo IN ('loja', 'campo')),
      folga_padrao TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      ordem INTEGER NOT NULL DEFAULT 0
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_gestores_celula (
      id_celula SERIAL PRIMARY KEY,
      id_gestor INTEGER NOT NULL REFERENCES escala_gestores(id_gestor) ON DELETE CASCADE,
      data DATE NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('folga', 'ferias', 'falta', 'ausencia')),
      UNIQUE (id_gestor, data)
    )
  `);
  console.log(`DB: ${DB_NAME}`);

  const { rows: lojas } = await client.query(
    `SELECT id_loja, name, bk_number FROM lojas WHERE is_active = TRUE`,
  );
  const lojaPorBk = new Map(
    lojas.filter((l) => l.bk_number).map((l) => [String(l.bk_number).trim(), l]),
  );

  let grupoAtual = 'loja';
  let ordem = 0;
  let gestores = 0;
  let celulas = 0;
  const idsMes = [];

  for (let r = 4; r < agosto.length; r += 1) {
    const row = agosto[r] || [];
    const colA = String(row[0] || '').trim();
    const nome = String(row[1] || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!nome) continue;
    if (norm(nome) === 'time de campo' || norm(colA) === 'time de campo') {
      grupoAtual = 'campo';
      continue;
    }
    if (norm(nome) === 'gestores') continue;

    const bk = bkNum(colA);
    const loja = bk ? lojaPorBk.get(bk) : null;
    const folgaPadrao = bk ? folgaPadraoPorBk.get(bk) || null : null;
    ordem += 1;

    const { rows: existentes } = await client.query(
      `SELECT id_gestor FROM escala_gestores
       WHERE ativo = TRUE AND LOWER(BTRIM(nome)) = LOWER(BTRIM($1))
         AND COALESCE(bk_number, '') = COALESCE($2, '')
       LIMIT 1`,
      [nome, bk],
    );
    let idGestor = existentes[0]?.id_gestor;
    if (!idGestor) {
      const ins = await client.query(
        `INSERT INTO escala_gestores (id_loja, bk_number, nome, grupo, folga_padrao, ordem, ativo)
         VALUES ($1,$2,$3,$4,$5,$6, TRUE)
         RETURNING id_gestor`,
        [loja?.id_loja || null, bk, nome, grupoAtual, folgaPadrao, ordem],
      );
      idGestor = ins.rows[0].id_gestor;
    } else {
      await client.query(
        `UPDATE escala_gestores
         SET id_loja = COALESCE($2, id_loja),
             grupo = $3,
             folga_padrao = COALESCE($4, folga_padrao),
             ordem = $5,
             ativo = TRUE
         WHERE id_gestor = $1`,
        [idGestor, loja?.id_loja || null, grupoAtual, folgaPadrao, ordem],
      );
    }
    gestores += 1;
    idsMes.push(idGestor);

    await client.query(
      `DELETE FROM escala_gestores_celula
       WHERE id_gestor = $1 AND data >= $2::date AND data < $3::date`,
      [idGestor, `${ANO}-${String(MES).padStart(2, '0')}-01`, `${ANO}-${String(MES + 1).padStart(2, '0')}-01`],
    );

    for (let c = 3; c < row.length; c += 1) {
      const diaMes = Number(diasHeader[c]);
      if (!Number.isFinite(diaMes) || diaMes < 1 || diaMes > 31) continue;
      const tipo = tipoCelula(row[c]);
      if (!tipo) continue;
      const data = `${ANO}-${String(MES).padStart(2, '0')}-${String(diaMes).padStart(2, '0')}`;
      await client.query(
        `INSERT INTO escala_gestores_celula (id_gestor, data, tipo)
         VALUES ($1, $2::date, $3)
         ON CONFLICT (id_gestor, data) DO UPDATE SET tipo = EXCLUDED.tipo`,
        [idGestor, data, tipo],
      );
      celulas += 1;
    }
    if (bk && !loja) console.warn(`Loja BKN ${bk} não encontrada (${nome})`);
  }

  await client.query('COMMIT');
  console.log(`\nOK ${DB_NAME} agosto/${ANO}`);
  console.log(`  gestores: ${gestores}`);
  console.log(`  células: ${celulas}`);
} catch (e) {
  await client.query('ROLLBACK');
  console.error('Falha:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
