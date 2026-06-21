/**
 * Exibe o log do dia (formato legível).
 * Uso: npm run logs:hoje
 *      npm run logs:hoje -- 2026-06-21
 */
import fs from 'fs';
import path from 'path';
import { getLogsDir } from '../backend/src/projectPaths.js';
import { parseLinhaLog } from '../backend/src/logger.js';

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
console.log('Legenda: ✓ sucesso | △ alerta | ✗ erro\n');

let erros = 0;
let avisos = 0;

for (const linha of linhas) {
  const e = parseLinhaLog(linha);
  if (!e) continue;

  if (e.level === 'ERROR') erros += 1;
  if (e.level === 'WARN') avisos += 1;

  if (e.data && e.hora) {
    console.log(`${e.data} ${e.hora} ${e.icone} [${e.category}] ${e.message}`);
  } else {
    console.log(e.raw);
  }
}

console.log(`\n--- Resumo: ${erros} erro(s) ✗, ${avisos} aviso(s) △ ---\n`);
