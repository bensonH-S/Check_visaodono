/**
 * Filtra apenas ERROR e WARN do log do dia.
 * Uso: npm run logs:erros
 */
import fs from 'fs';
import path from 'path';
import { getLogsDir } from '../backend/src/projectPaths.js';

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
const filtradas = linhas.filter(
  (l) => l.includes('"level":"ERROR"') || l.includes('"level":"WARN"'),
);

console.log(`\n=== Erros e avisos — ${data} — ${logDir} (${filtradas.length}) ===\n`);

for (const linha of filtradas) {
  try {
    const e = JSON.parse(linha);
    const hora = e.ts ? e.ts.replace('T', ' ').slice(0, 19) : '?';
    const meta = e.meta ? `\n    ${JSON.stringify(e.meta, null, 0)}` : '';
    console.log(`${hora} [${e.level}] [${e.category}] ${e.message}${meta}\n`);
  } catch {
    console.log(linha);
  }
}
