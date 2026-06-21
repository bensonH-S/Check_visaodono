/**
 * Filtra apenas ERROR e WARN do log do dia.
 * Uso: npm run logs:erros
 */
import fs from 'fs';
import path from 'path';
import { getLogsDir } from '../backend/src/projectPaths.js';
import { parseLinhaLog } from '../backend/src/logger.js';

const TZ = process.env.TZ || 'America/Sao_Paulo';
const data =
  process.argv[2] ||
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

const logDir = getLogsDir();
const arquivo = path.join(logDir, `${data}.log`);

if (!fs.existsSync(arquivo)) {
  console.log(`Nenhum log em ${arquivo}`);
  process.exit(0);
}

const linhas = fs.readFileSync(arquivo, 'utf8').trim().split('\n').filter(Boolean);
const filtradas = linhas.filter((linha) => {
  const e = parseLinhaLog(linha);
  return e?.level === 'ERROR' || e?.level === 'WARN';
});

console.log(`\n=== Erros e avisos — ${data} — ${logDir} (${filtradas.length}) ===\n`);

for (const linha of filtradas) {
  const e = parseLinhaLog(linha);
  if (e?.data && e.hora) {
    console.log(`${e.data} ${e.hora} ${e.icone} [${e.category}] ${e.message}\n`);
  } else {
    console.log(`${linha}\n`);
  }
}
