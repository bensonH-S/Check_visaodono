/**
 * Sync BK Office → vendas (produção: VPS + Bright Data BR).
 *
 *   npm run estoque:sync-bkoffice -- --loja=21 --db=prod --dias=0
 *   npm run estoque:sync-bkoffice -- --loja=21 --db=prod --data=2026-08-28
 *
 * Env: BKOFFICE_USER/PASS, BKOFFICE_BRIGHTDATA=1, BRIGHTDATA_PROXY_PASSWORD
 * No VPS: BKOFFICE_USE_CHROME=0 (Chromium Playwright). Windows local: USE_CHROME=1 ok.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};

const idLoja = Number(getArg('--loja', '21'));
const todas = args.includes('--todas') || getArg('--todas', '') === '1';
const termoArg = getArg('--termo', '');
const dias = Number(getArg('--dias', '0')); // 0 = só hoje
const dataArg = getArg('--data', '');
const iniArg = getArg('--inicio', '');
const fimArg = getArg('--fim', '');
const dbFlag = getArg('--db', 'dev');

if (dbFlag === 'dev') {
  process.env.DB_NAME = process.env.DB_NAME_DEV || 'vision_check_dev';
}
if (dbFlag === 'prod') {
  process.env.NODE_ENV = 'production';
  process.env.DB_NAME = process.env.DB_NAME_PROD || process.env.DB_NAME || 'vision_check';
}

function hojeBR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDaysISO(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

let fim = fimArg || dataArg || hojeBR();
let ini = iniArg || dataArg || (dias > 0 ? addDaysISO(fim, -dias) : fim);
if (iniArg && !fimArg && !dataArg) fim = hojeBR();
if (ini > fim) {
  console.error(`data_inicio (${ini}) > data_fim (${fim})`);
  process.exit(1);
}

console.log({
  modo: todas ? 'todas' : 'loja',
  loja: todas ? 'all' : idLoja,
  db: process.env.DB_NAME,
  data_inicio: ini,
  data_fim: fim,
  user: process.env.BKOFFICE_USER ? `${process.env.BKOFFICE_USER.slice(0, 3)}***` : '(vazio)',
  chrome: process.env.BKOFFICE_USE_CHROME !== '0',
  headless: process.env.BKOFFICE_HEADLESS !== '0',
});

if (!process.env.BKOFFICE_USER || !process.env.BKOFFICE_PASS) {
  console.error('Defina BKOFFICE_USER e BKOFFICE_PASS no backend/.env');
  process.exit(1);
}

const { syncVendasBkOffice, syncVendasBkOfficeTodas } = await import(
  '../src/services/bkoffice/syncVendas.js'
);

try {
  const result = todas
    ? await syncVendasBkOfficeTodas({
        data_inicio: ini,
        data_fim: fim,
        processar: true,
      })
    : await syncVendasBkOffice({
        id_loja: idLoja,
        data_inicio: ini,
        data_fim: fim,
        termo_loja: termoArg || null,
        processar: true,
      });
  console.log('\n=== OK ===');
  console.log(result);
  if (todas && result.falhas > 0 && result.ok === 0) process.exit(1);
  if (todas && result.falhas > 0) process.exit(2);
  process.exit(0);
} catch (e) {
  console.error('\n=== ERRO ===');
  console.error(e.message || e);
  process.exit(1);
}
