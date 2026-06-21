/**
 * Exibe o log do dia (formato legível).
 * Uso: npm run logs:hoje
 *      npm run logs:hoje -- 2026-06-21
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLogsDir } from '../backend/src/projectPaths.js';

const TZ = process.env.TZ || 'America/Sao_Paulo';
const dataArg = process.argv[2];
const data =
  dataArg ||
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

const logDir = getLogsDir();
const arquivo = path.join(logDir, `${data}.log`);

if (!fs.existsSync(arquivo)) {
  console.log(`Nenhum log em ${arquivo}`);
  process.exit(0);
}

const linhas = fs.readFileSync(arquivo, 'utf8').trim().split('\n').filter(Boolean);

console.log(`\n=== Log ${data} — ${logDir} (${linhas.length} entradas) ===\n`);

for (const linha of linhas) {
  try {
    const e = JSON.parse(linha);
    const hora = e.ts ? e.ts.replace('T', ' ').slice(0, 19) : '?';
    const meta = e.meta ? ` | ${JSON.stringify(e.meta)}` : '';
    console.log(`${hora} [${e.level}] [${e.category}] ${e.message}${meta}`);
  } catch {
    console.log(linha);
  }
}

const erros = linhas.filter((l) => l.includes('"level":"ERROR"')).length;
const avisos = linhas.filter((l) => l.includes('"level":"WARN"')).length;
console.log(`\n--- Resumo: ${erros} erro(s), ${avisos} aviso(s) ---\n`);
