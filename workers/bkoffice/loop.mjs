/**
 * Loop 24h: sync BK Office → Postgres produção (PC gerência BR).
 * Round-robin em todas as lojas operacionais (ou lista em BKOFFICE_SYNC_ID_LOJAS).
 * Log: um arquivo por loja em Logs/lojas/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const logDir = path.join(root, 'Logs');
const logLojasDir = path.join(logDir, 'lojas');
fs.mkdirSync(logLojasDir, { recursive: true });

dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });
dotenv.config({ path: path.join(root, 'workers/bkoffice/.env'), override: true });

process.env.DB_NAME = process.env.DB_NAME_PROD || process.env.DB_NAME || 'vision_check';
if (process.env.BKOFFICE_USE_CHROME == null) process.env.BKOFFICE_USE_CHROME = '0';
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

function agoraBR() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

function slugNome(name) {
  const s = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/BURGER KING\s*-?\s*/gi, '')
    .replace(/POPYES\s*-?\s*/gi, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 36);
  return s || 'loja';
}

function bknLoja(loja) {
  const n = String(loja?.bk_number || '').replace(/\D/g, '');
  return n || `id${loja?.id_loja || 0}`;
}

function arquivoLogLoja(loja) {
  const ym = agoraBR().slice(0, 7);
  return path.join(logLojasDir, `${bknLoja(loja)}-${slugNome(loja?.name)}-${ym}.log`);
}

function append(file, line) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${line}\n`, 'utf8');
}

function logServico(...args) {
  const line = `${agoraBR()}  INFO  ${args.map(String).join(' ')}`;
  console.log(line);
  try {
    append(path.join(logDir, '_servico.log'), line);
  } catch {
    /* ignore */
  }
}

function logLoja(loja, nivel, msg) {
  const line = `${agoraBR()}  ${String(nivel).padEnd(4)}  ${msg}`;
  console.log(`${line}  [${bknLoja(loja)}]`);
  try {
    const file = arquivoLogLoja(loja);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
      append(
        file,
        `# Meridian BK Office — log exclusivo desta loja\n# BKN ${bknLoja(loja)}  |  ${loja?.name || '?'}  |  id_loja=${loja?.id_loja ?? '?'}\n`,
      );
    }
    append(file, line);
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
    logServico('pulando: sync anterior ainda em andamento');
    return;
  }
  rodando = true;
  const dia = hojeBR();
  let loja = null;
  try {
    const lojas = await listarLojasBkOfficeSync();
    if (!lojas.length) {
      logServico('ERRO: nenhuma loja com BKN para sync (BKOFFICE_SYNC_ID_LOJAS?)');
      return;
    }
    loja = lojas[rrIndex % lojas.length];
    rrIndex = (rrIndex + 1) % lojas.length;
    saveRrIndex(rrIndex);
    const pos = rrIndex === 0 ? lojas.length : rrIndex;

    logServico(`ciclo ${pos}/${lojas.length} → BKN ${bknLoja(loja)} ${loja.name}`);
    logLoja(loja, 'INFO', `sync dia=${dia} db=${process.env.DB_NAME}`);
    const r = await syncVendasBkOffice({
      id_loja: loja.id_loja,
      data_inicio: dia,
      data_fim: dia,
      termo_loja: loja.bk_number,
      processar: true,
    });
    logLoja(loja, 'OK', JSON.stringify(r?.status || r || 'ok'));
  } catch (e) {
    logServico('ERRO', e.message || e);
    if (loja) logLoja(loja, 'ERRO', e.message || String(e));
  } finally {
    rodando = false;
  }
}

const modo = parseIdsLojasBkOfficeEnv();
logServico(`iniciado intervalo=${INTERVAL}ms lojas=${JSON.stringify(modo)} db=${process.env.DB_NAME} rr=${rrIndex}`);
await tick();
setInterval(() => {
  void tick();
}, INTERVAL);
