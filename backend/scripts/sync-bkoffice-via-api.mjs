/**
 * Kit PC gerência: baixa Excel no Chrome local e envia via HTTPS (sem Postgres na loja).
 *
 *   node sync-bkoffice-via-api.mjs --loja=21 --inicio=2026-08-11 --fim=2026-08-11
 *
 * Env (cofre / process):
 *   API_BASE=https://grupoalvim.com.br/auditoria/api
 *   BKOFFICE_KIT_TOKEN=...
 *   BKOFFICE_USER / BKOFFICE_PASS / ...
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const getArg = (k, def) => {
  const hit = process.argv.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};

const quiet = process.argv.includes('--quiet') || process.env.BKOFFICE_KIT_QUIET === '1';
const log = (...a) => {
  if (!quiet) console.log(...a);
};
const logErr = (...a) => console.error(...a);

const idLoja = Number(getArg('--loja', process.env.BKOFFICE_SYNC_ID_LOJA || '21'));
const ini = getArg('--inicio', '');
const fim = getArg('--fim', ini);

function hojeBR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const dataInicio = ini || hojeBR();
const dataFim = fim || dataInicio;

const apiBase = String(process.env.API_BASE || process.env.MERIDIAN_API_BASE || '')
  .trim()
  .replace(/\/$/, '');
const kitToken = String(process.env.BKOFFICE_KIT_TOKEN || '').trim();

if (!apiBase) {
  console.error('Defina API_BASE (ex.: https://grupoalvim.com.br/auditoria/api)');
  process.exit(1);
}
if (!kitToken || kitToken.length < 16) {
  console.error('Defina BKOFFICE_KIT_TOKEN (mesmo valor do .env do servidor)');
  process.exit(1);
}
if (!process.env.BKOFFICE_USER || !process.env.BKOFFICE_PASS) {
  console.error('Faltam BKOFFICE_USER / BKOFFICE_PASS');
  process.exit(1);
}

log({
  modo: 'kit-https',
  loja: idLoja,
  api: apiBase,
  data_inicio: dataInicio,
  data_fim: dataFim,
  chrome: process.env.BKOFFICE_USE_CHROME !== '0',
});

// Sem Postgres na loja — termo da loja via env (bk_number) ou padrão Terraço
let termoLoja = process.env.BKOFFICE_TERMO_LOJA || process.env.BKOFFICE_BK_NUMBER || null;
if (!termoLoja) {
  termoLoja = idLoja === 21 ? '30797' : String(idLoja);
}

const downloadDir = path.join(os.tmpdir(), 'vision-check-bkoffice-kit', `${idLoja}-${Date.now()}`);
fs.mkdirSync(downloadDir, { recursive: true });

const { baixarExcelVendas } = await import('../src/services/bkoffice/syncVendas.js');

let filePath;
try {
  filePath = await baixarExcelVendas({
    dataInicio,
    dataFim,
    termoLoja,
    downloadDir,
    agruparPorDia: true,
  });
} catch (e) {
  logErr('KIT_RESULT:' + JSON.stringify({ ok: false, dia: dataInicio, erro: e.message || String(e) }));
  logErr('\n=== ERRO DOWNLOAD ===');
  logErr(e.message || e);
  process.exit(1);
}

const buf = fs.readFileSync(filePath);
const blob = new Blob([buf], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});
const form = new FormData();
form.append('arquivo', blob, path.basename(filePath));
form.append('id_loja', String(idLoja));
form.append('data_inicio', dataInicio);
form.append('data_fim', dataFim);
form.append('processar', '1');

const url = `${apiBase}/public/kit/estoque/vendas-import`;
log('upload', url, 'bytes', buf.length);

try {
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Meridian-Kit-Token': kitToken,
    },
    body: form,
  });
  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  if (!resp.ok) {
    const msg = json?.error || json?.message || `HTTP ${resp.status}`;
    logErr('KIT_RESULT:' + JSON.stringify({ ok: false, dia: dataInicio, erro: msg }));
    logErr('\n=== ERRO API ===', resp.status, json);
    process.exit(1);
  }
  const summary = {
    ok: true,
    loja: json.loja ?? idLoja,
    dia: dataInicio,
    linhas: json.linhas ?? 0,
    dias: json.dias ?? 1,
    de: json.de ?? dataInicio,
    ate: json.ate ?? dataFim,
    gravado_no_banco: true,
  };
  console.log('KIT_RESULT:' + JSON.stringify(summary));
  log('\n=== OK ===');
  log(json);
  process.exit(0);
} catch (e) {
  logErr('KIT_RESULT:' + JSON.stringify({ ok: false, dia: dataInicio, erro: e.message || String(e) }));
  logErr('\n=== ERRO REDE API ===');
  logErr(e.message || e);
  process.exit(1);
} finally {
  try {
    fs.rmSync(downloadDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
