/**
 * Loop 24h: sync BK Office → Postgres produção (PC gerência BR).
 *
 * Serviço Windows: scripts/windows/install-servico-bkoffice.ps1
 * Manual:        node workers/bkoffice/loop.mjs
 *
 * Env (workers/bkoffice/.env ou backend/.env):
 *   DB_HOST, DB_USER, DB_PASS, DB_NAME_PROD
 *   BKOFFICE_USER, BKOFFICE_PASS
 *   SYNC_INTERVAL_MS=60000 (mín. 60s)
 *   BKOFFICE_SYNC_ID_LOJA=21
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const logDir = path.join(root, 'Logs');
fs.mkdirSync(logDir, { recursive: true });

dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });
dotenv.config({ path: path.join(root, 'workers/bkoffice/.env'), override: true });

process.env.DB_NAME = process.env.DB_NAME_PROD || process.env.DB_NAME || 'vision_check';
// Serviço Windows: Chrome real no PC (Akamai bloqueia Chromium Playwright).
if (process.env.BKOFFICE_USE_CHROME == null) process.env.BKOFFICE_USE_CHROME = '1';
if (process.env.BKOFFICE_HEADLESS == null) process.env.BKOFFICE_HEADLESS = '1';
process.env.BKOFFICE_SYNC_CRON_MS = '0';

const ID_LOJA = Number(process.env.BKOFFICE_SYNC_ID_LOJA || process.env.ID_LOJA || 21);
const INTERVAL = Math.max(60000, Number(process.env.SYNC_INTERVAL_MS || 60000));

function hojeBR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function log(...args) {
  const line = `[worker-bk] ${new Date().toISOString()} ${args.map(String).join(' ')}`;
  console.log(line);
  try {
    fs.appendFileSync(path.join(logDir, 'bkoffice-service.log'), `${line}\n`, 'utf8');
  } catch {
    /* ignore */
  }
}

const { syncVendasBkOffice } = await import('../../backend/src/services/bkoffice/syncVendas.js');

let rodando = false;
async function tick() {
  if (rodando) {
    log('pulando: sync anterior ainda em andamento');
    return;
  }
  rodando = true;
  const dia = hojeBR();
  log(`sync loja=${ID_LOJA} dia=${dia} db=${process.env.DB_NAME}`);
  try {
    const r = await syncVendasBkOffice({
      id_loja: ID_LOJA,
      data_inicio: dia,
      data_fim: dia,
      processar: true,
    });
    log('OK', JSON.stringify(r?.status || r || 'ok'));
  } catch (e) {
    log('ERRO', e.message || e);
  } finally {
    rodando = false;
  }
}

log(`iniciado intervalo=${INTERVAL}ms loja=${ID_LOJA} db=${process.env.DB_NAME}`);
await tick();
setInterval(() => {
  void tick();
}, INTERVAL);
