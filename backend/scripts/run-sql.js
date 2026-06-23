import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import dotenv from 'dotenv';
import pg from 'pg';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const file = process.argv[2];
const force = process.argv.includes('--force');

if (!file) {
  console.error('Uso: node scripts/run-sql.js migrations/NNN_arquivo.sql [--force]');
  console.error('');
  console.error('  --force  Obrigatório para scripts com TRUNCATE/DROP TABLE (apaga dados).');
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlPath = path.join(root, file);
const sql = fs.readFileSync(sqlPath, 'utf8');

const isDestructive =
  /\bTRUNCATE\b/i.test(sql) ||
  /\bDROP\s+TABLE\b/i.test(sql) ||
  /\bDELETE\s+FROM\s+(lojas|usuarios|visitas|respostas|manut_chamados)\b/i.test(sql);

async function confirmarDestrutivo() {
  if (force) return true;

  console.error('');
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error('║  ATENÇÃO: este SQL APAGA DADOS do banco                     ║');
  console.error(`║  Arquivo: ${file.padEnd(51)}║`);
  console.error('║  Rode de novo com --force se tiver certeza.                  ║');
  console.error('║  Ex.: node scripts/run-sql.js migrations/036_....sql --force ║');
  console.error('╚══════════════════════════════════════════════════════════════╝');
  console.error('');

  if (!process.stdin.isTTY) {
    console.error('Sem terminal interativo. Use --force para confirmar.');
    return false;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const resposta = await new Promise((resolve) => {
    rl.question('Digite APAGAR para continuar (ou Enter para cancelar): ', resolve);
  });
  rl.close();
  return resposta.trim().toUpperCase() === 'APAGAR';
}

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
});

try {
  if (isDestructive) {
    const ok = await confirmarDestrutivo();
    if (!ok) {
      console.error('Cancelado — nenhuma alteração no banco.');
      process.exit(1);
    }
    console.error(`[run-sql] Aplicando SQL DESTRUTIVO em ${process.env.DB_NAME}...`);
  }

  await client.connect();
  await client.query(sql);
  console.log('OK:', file);
} catch (err) {
  console.error('Falha:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
