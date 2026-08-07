/**
 * Sync BK Office → vendas no banco (pensado para rodar NO BRASIL).
 * Servidor fora do BR leva 403 Akamai; use este CLI no PC Windows local.
 *
 *   npm run estoque:sync-bkoffice -- --loja=21 --db=prod
 *   npm run estoque:sync-bkoffice -- --loja=21 --db=dev --dias=0
 *   npm run estoque:sync-bkoffice -- --loja=21 --db=prod --data=2026-08-06
 *
 * Credenciais: BKOFFICE_USER / BKOFFICE_PASS no backend/.env
 * No Windows local: BKOFFICE_USE_CHROME=1 e BKOFFICE_HEADLESS=0 se precisar.
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
const dias = Number(getArg('--dias', '0')); // 0 = só hoje
const dataArg = getArg('--data', '');
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

const fim = dataArg || hojeBR();
const ini = dataArg || (dias > 0 ? addDaysISO(fim, -dias) : fim);

console.log({
  loja: idLoja,
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

const { syncVendasBkOffice } = await import('../src/services/bkoffice/syncVendas.js');

try {
  const result = await syncVendasBkOffice({
    id_loja: idLoja,
    data_inicio: ini,
    data_fim: fim,
    processar: true,
  });
  console.log('\n=== OK ===');
  console.log(result);
  process.exit(0);
} catch (e) {
  console.error('\n=== ERRO ===');
  console.error(e.message || e);
  process.exit(1);
}
