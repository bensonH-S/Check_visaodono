/**
 * Loop 24h: sync BK Office → Postgres produção (PC gerência BR).
 * Round-robin em todas as lojas operacionais (ou lista em BKOFFICE_SYNC_ID_LOJAS).
 *
 * Serviço Windows: scripts/windows/install-servico-bkoffice.ps1
 * Manual:        node workers/bkoffice/loop.mjs
 *
 * Env (workers/bkoffice/.env ou backend/.env):
 *   DB_HOST, DB_USER, DB_PASS, DB_NAME_PROD
 *   BKOFFICE_USER, BKOFFICE_PASS
 *   SYNC_INTERVAL_MS=90000 (mín. 60s) — uma loja por ciclo
 *   BKOFFICE_SYNC_ID_LOJAS=all          (padrão)
 *   BKOFFICE_SYNC_ID_LOJAS=21,15,8      (lista)
 *   BKOFFICE_SYNC_ID_LOJA=21            (legado: só uma)
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
if (process.env.BKOFFICE_USE_CHROME == null) process.env.BKOFFICE_USE_CHROME = '1';
if (process.env.BKOFFICE_HEADLESS == null) process.env.BKOFFICE_HEADLESS = '1';
process.env.BKOFFICE_SYNC_CRON_MS = '0';

const INTERVAL = Math.max(60000, Number(process.env.SYNC_INTERVAL_MS || 90000));
const rrStatePath = path.join(logDir, 'bkoffice-rr-index.json');

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

function loadRrIndex() {
  try {
    const j = JSON.parse(fs.readFileSync(rrStatePath, 'utf8'));
    return Number(j.index) || 0;
  } catch {
    return 0;
  }
}

function saveRrIndex(index) {
  try {
    fs.writeFileSync(rrStatePath, JSON.stringify({ index, em: new Date().toISOString() }), 'utf8');
  } catch {
    /* ignore */
  }
}

const {
  syncVendasBkOffice,
  listarLojasBkOfficeSync,
  parseIdsLojasBkOfficeEnv,
} = await import('../../backend/src/services/bkoffice/syncVendas.js');

let rodando = false;
let rrIndex = loadRrIndex();

async function tick() {
  if (rodando) {
    log('pulando: sync anterior ainda em andamento');
    return;
  }
  rodando = true;
  const dia = hojeBR();
  try {
    const lojas = await listarLojasBkOfficeSync();
    if (!lojas.length) {
      log('ERRO: nenhuma loja com BKN para sync (BKOFFICE_SYNC_ID_LOJAS?)');
      return;
    }
    const loja = lojas[rrIndex % lojas.length];
    rrIndex = (rrIndex + 1) % lojas.length;
    saveRrIndex(rrIndex);

    log(
      `sync loja=${loja.id_loja} bkn=${loja.bk_number} "${loja.name}" dia=${dia} ` +
        `(${(rrIndex === 0 ? lojas.length : rrIndex)}/${lojas.length} no rodízio) db=${process.env.DB_NAME}`,
    );
    const r = await syncVendasBkOffice({
      id_loja: loja.id_loja,
      data_inicio: dia,
      data_fim: dia,
      termo_loja: loja.bk_number,
      processar: true,
    });
    log('OK', JSON.stringify(r?.status || r || 'ok'));
  } catch (e) {
    log('ERRO', e.message || e);
  } finally {
    rodando = false;
  }
}

const modo = parseIdsLojasBkOfficeEnv();
log(
  `iniciado intervalo=${INTERVAL}ms lojas=${JSON.stringify(modo)} db=${process.env.DB_NAME} rr=${rrIndex}`,
);
await tick();
setInterval(() => {
  void tick();
}, INTERVAL);
