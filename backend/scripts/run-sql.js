import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import dotenv from 'dotenv';
import pg from 'pg';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const DB_DEV = process.env.DB_NAME_DEV || 'vision_check_dev';
const DB_PROD = process.env.DB_NAME_PROD || 'vision_check';

const file = process.argv[2];
const force = process.argv.includes('--force');
const yesProd = process.argv.includes('--yes') || process.argv.includes('--force');

if (!file || file.startsWith('--')) {
  console.error('Uso: node scripts/run-sql.js migrations/NNN_arquivo.sql [--db=dev|prod|both] [--force] [--yes]');
  console.error('');
  console.error('  --db=dev|prod|both  Escolhe o banco sem perguntar (útil em CI/scripts).');
  console.error('  --force             Confirma SQL destrutivo (TRUNCATE/DROP).');
  console.error('  --yes               Confirma aplicação em produção sem digitar PRODUCAO.');
  console.error('');
  console.error('Sem --db, pergunta interativamente: desenvolvimento, produção ou ambos.');
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlPath = path.join(root, file);
if (!fs.existsSync(sqlPath)) {
  console.error('Arquivo não encontrado:', sqlPath);
  process.exit(1);
}
const sql = fs.readFileSync(sqlPath, 'utf8');

const isDestructive =
  /\bTRUNCATE\b/i.test(sql) ||
  /\bDROP\s+TABLE\b/i.test(sql) ||
  /\bDELETE\s+FROM\s+(lojas|usuarios|visitas|respostas|manut_chamados)\b/i.test(sql);

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function parseDbFlag() {
  const arg = process.argv.find((a) => a.startsWith('--db='));
  if (!arg) return null;
  const value = arg.slice('--db='.length).trim().toLowerCase();
  if (value === 'dev' || value === 'development' || value === DB_DEV.toLowerCase()) return 'dev';
  if (value === 'prod' || value === 'production' || value === DB_PROD.toLowerCase()) return 'prod';
  if (value === 'both' || value === 'ambos' || value === 'all') return 'both';
  console.error(`Valor inválido em --db=${value}. Use: dev | prod | both`);
  process.exit(1);
}

async function escolherAlvo() {
  const fromFlag = parseDbFlag();
  if (fromFlag) return fromFlag;

  if (!process.stdin.isTTY) {
    console.error('Sem terminal interativo. Informe o banco com --db=dev|prod|both');
    process.exit(1);
  }

  console.error('');
  console.error('Qual banco aplicar esta migration?');
  console.error(`  1) desenvolvimento (${DB_DEV})`);
  console.error(`  2) produção (${DB_PROD})`);
  console.error(`  3) ambos (dev + produção)`);
  console.error('');
  const resposta = (await ask('Escolha [1/2/3]: ')).trim();

  if (resposta === '1' || /^dev/i.test(resposta)) return 'dev';
  if (resposta === '2' || /^prod/i.test(resposta)) return 'prod';
  if (resposta === '3' || /^ambos|^both|^all/i.test(resposta)) return 'both';

  console.error('Opção inválida. Cancelado.');
  process.exit(1);
}

function bancosDoAlvo(alvo) {
  if (alvo === 'dev') return [DB_DEV];
  if (alvo === 'prod') return [DB_PROD];
  return [DB_DEV, DB_PROD];
}

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

  const resposta = await ask('Digite APAGAR para continuar (ou Enter para cancelar): ');
  return resposta.trim().toUpperCase() === 'APAGAR';
}

async function confirmarProducao(bancos) {
  const incluiProd = bancos.includes(DB_PROD);
  if (!incluiProd) return true;
  if (yesProd) return true;

  console.error('');
  console.error(`⚠  Vai alterar PRODUÇÃO: ${DB_PROD}`);
  if (!process.stdin.isTTY) {
    console.error('Sem terminal interativo. Use --yes (ou --force) para confirmar produção.');
    return false;
  }
  const resposta = await ask('Digite PRODUCAO para continuar (ou Enter para cancelar): ');
  return resposta.trim().toUpperCase() === 'PRODUCAO';
}

async function aplicarEm(dbName) {
  const client = new pg.Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: dbName,
    port: Number(process.env.DB_PORT || 5432),
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log(`OK: ${file} → ${dbName}`);
  } finally {
    await client.end();
  }
}

try {
  const alvo = await escolherAlvo();
  const bancos = bancosDoAlvo(alvo);

  if (isDestructive) {
    const ok = await confirmarDestrutivo();
    if (!ok) {
      console.error('Cancelado — nenhuma alteração no banco.');
      process.exit(1);
    }
  }

  const okProd = await confirmarProducao(bancos);
  if (!okProd) {
    console.error('Cancelado — nenhuma alteração no banco.');
    process.exit(1);
  }

  console.error(`[run-sql] Aplicando em: ${bancos.join(' + ')}`);
  for (const dbName of bancos) {
    await aplicarEm(dbName);
  }
} catch (err) {
  console.error('Falha:', err.message);
  process.exit(1);
}
