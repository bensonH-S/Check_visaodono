/**
 * Worker BK Office — cofre criptografado + sync via HTTPS.
 * NÃO reimporta o mês inteiro a cada boot: só o dia de hoje
 * (e dias que faltarem no marcador local data/synced-days.json).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { loadVault } from './vault_tools.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function kitRoot() {
  if (process.pkg) return path.dirname(process.execPath);
  return path.resolve(__dirname);
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

function log(msg) {
  const line = `[bk-kit] ${agoraBR()} ${msg}`;
  const roots = [
    path.join(kitRoot(), 'Logs'),
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'MeridianBkOffice', 'Logs'),
  ];
  for (const d of roots) {
    try {
      fs.mkdirSync(d, { recursive: true });
      fs.appendFileSync(path.join(d, 'bkoffice-python-service.log'), `${line}\n`, 'utf8');
    } catch {
      /* ignore */
    }
  }
  try {
    console.log(line);
  } catch {
    /* ignore */
  }
}

const statusPath = () => path.join(kitRoot(), 'data', 'status.json');
const statusTxtPath = () => path.join(kitRoot(), 'data', 'STATUS.txt');

function writeStatus(patch) {
  const root = kitRoot();
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(statusPath(), 'utf8'));
  } catch {
    /* ignore */
  }
  const next = {
    ...prev,
    ...patch,
    atualizado_em: new Date().toISOString(),
  };
  fs.writeFileSync(statusPath(), JSON.stringify(next, null, 2), 'utf8');

  const ult = next.ultimo_sync || {};
  const linhas = [
    '=== MERIDIAN BK OFFICE — STATUS ===',
    `Atualizado: ${agoraBR()}`,
    `Estado: ${next.estado || '?'}`,
    `Loja: ${next.loja ?? '?'}`,
    `Ciclo: #${next.ciclo ?? '?'}`,
    '',
    '--- Ultimo envio ---',
    ult.ok
      ? `OK ${ult.dia} — ${ult.linhas ?? '?'} produtos, R$ ${ult.venda_total ?? '?'} no Meridian (${ult.duracao_s ?? '?'}s)`
      : ult.dia
        ? `FALHOU ${ult.dia} — ${ult.erro || 'erro desconhecido'}`
        : '(nenhum envio ainda)',
    '',
    '--- Mes atual ---',
    `Dias OK: ${(next.dias_ok || []).length}`,
    next.pendentes?.length ? `Pendentes: ${next.pendentes.join(', ')}` : 'Pendentes: nenhum',
    next.proximo_ciclo ? `Proximo ciclo: ${next.proximo_ciclo}` : '',
    '',
    'Abra VERIFICAR.bat para mais detalhes.',
  ].filter(Boolean);
  fs.writeFileSync(statusTxtPath(), linhas.join('\n'), 'utf8');
}

function hojeBR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function syncedPath() {
  return path.join(kitRoot(), 'data', 'synced-days.json');
}

function loadSynced() {
  try {
    const p = syncedPath();
    if (!fs.existsSync(p)) return { dias: [] };
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { dias: Array.isArray(j.dias) ? j.dias.map(String) : [] };
  } catch {
    return { dias: [] };
  }
}

function saveSynced(state) {
  const dir = path.join(kitRoot(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  const uniq = [...new Set(state.dias)].sort();
  fs.writeFileSync(syncedPath(), JSON.stringify({ dias: uniq, atualizado_em: new Date().toISOString() }, null, 2));
}

function markSynced(dia) {
  const state = loadSynced();
  if (!state.dias.includes(dia)) state.dias.push(dia);
  saveSynced(state);
}

function findNode(root) {
  const bundled = path.join(root, 'runtime', 'node', 'node.exe');
  if (fs.existsSync(bundled)) return bundled;
  return 'node';
}

function parseSyncOutput(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const ln of lines) {
    if (ln.startsWith('KIT_RESULT:')) {
      try {
        return JSON.parse(ln.slice('KIT_RESULT:'.length));
      } catch {
        /* ignore */
      }
    }
  }
  const errLine = lines.find((l) => /=== ERRO|ETIMEDOUT|ECONNREFUSED|FATAL/i.test(l));
  if (errLine) return { ok: false, erro: errLine.replace(/^\[bkoffice\]\s*/, '').trim() };
  if (text.includes('=== OK ===')) return { ok: true, linhas: '?', gravado_no_banco: true };
  return { ok: false, erro: lines.slice(-3).join(' | ') || 'falha sem detalhe' };
}

function runSync(env, idLoja, ini, fim) {
  const root = kitRoot();
  const node = findNode(root);
  const script = path.join(root, 'app', 'backend', 'scripts', 'sync-bkoffice-via-api.mjs');
  if (!fs.existsSync(script)) {
    throw new Error(`Script ausente: ${script}`);
  }
  const childEnv = {
    ...process.env,
    ...env,
    PATH: `${path.join(root, 'runtime', 'node')}${path.delimiter}${process.env.PATH || ''}`,
    PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'runtime', 'ms-playwright'),
    BKOFFICE_USE_CHROME: env.BKOFFICE_USE_CHROME || '1',
    BKOFFICE_HEADLESS: env.BKOFFICE_HEADLESS || '1',
    BKOFFICE_KIT_QUIET: '1',
    BKOFFICE_SERVER_SYNC: '0',
    BKOFFICE_SYNC_CRON_MS: '0',
    NODE_ENV: 'production',
    DB_HOST: '',
    DB_PASS: '',
  };
  const timeoutMs = Math.max(180000, Number(env.BKOFFICE_TIMEOUT_MS || 120000) + 120000);
  log(`sync ${ini} — baixando Excel BK Office (timeout ${Math.round(timeoutMs / 1000)}s)...`);
  writeStatus({ estado: 'sincronizando', ultimo_sync: { dia: ini, ok: null } });
  const t0 = Date.now();
  return new Promise((resolve) => {
    const proc = spawn(
      node,
      [script, `--loja=${idLoja}`, `--inicio=${ini}`, `--fim=${fim}`, '--quiet'],
      {
        cwd: path.join(root, 'app'),
        env: childEnv,
        windowsHide: true,
      },
    );
    let out = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try {
        proc.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }, timeoutMs);
    proc.stdout.on('data', (b) => {
      out += b.toString();
    });
    proc.stderr.on('data', (b) => {
      out += b.toString();
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      const elapsed = Math.round((Date.now() - t0) / 1000);
      const parsed = parseSyncOutput(out);
      parsed.duracao_s = elapsed;
      parsed.dia = parsed.dia || ini;
      if (killed) {
        parsed.ok = false;
        parsed.erro = `timeout apos ${Math.round(timeoutMs / 1000)}s`;
        log(`FALHOU ${ini} — ${parsed.erro}`);
      } else if (code === 0 && parsed.ok !== false) {
        parsed.ok = true;
        const venda = parsed.venda_total != null ? ` R$ ${parsed.venda_total}` : '';
        log(`OK ${ini} — ${parsed.linhas ?? '?'} produtos${venda} gravados no Meridian (${elapsed}s)`);
      } else {
        parsed.ok = false;
        parsed.erro = parsed.erro || `exit ${code}`;
        log(`FALHOU ${ini} — ${parsed.erro} (${elapsed}s)`);
      }
      resolve(parsed);
    });
  });
}

async function syncIncremental(env, idLoja) {
  const hoje = hojeBR();
  const iniMes = `${hoje.slice(0, 8)}01`;
  const state = loadSynced();
  const pendentes = [];
  for (let d = iniMes; d < hoje; d = addDays(d, 1)) {
    if (!state.dias.includes(d)) pendentes.push(d);
  }

  writeStatus({
    estado: 'sincronizando',
    loja: idLoja,
    dias_ok: state.dias.filter((d) => d >= iniMes && d <= hoje),
    pendentes,
  });

  if (pendentes.length) {
    log(`faltam ${pendentes.length} dia(s): ${pendentes.join(', ')}`);
    for (const d of pendentes) {
      const r = await runSync(env, idLoja, d, d);
      writeStatus({ ultimo_sync: r });
      if (r.ok) markSynced(d);
      else return false;
    }
  } else {
    log(`mes OK ate ontem — so atualiza hoje (${hoje})`);
  }

  const rHoje = await runSync(env, idLoja, hoje, hoje);
  writeStatus({ ultimo_sync: rHoje });
  if (rHoje.ok) markSynced(hoje);
  return rHoje.ok;
}

async function main() {
  const root = kitRoot();
  log(`iniciando pid=${process.pid} pasta=${root}`);

  let keyParts;
  try {
    const mod = await import('./key_parts.generated.mjs');
    keyParts = mod.KEY_PARTS;
  } catch (e) {
    log(`ERRO: chave do cofre ausente (${e.message})`);
    writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message } });
    process.exit(1);
  }

  let secrets;
  try {
    secrets = loadVault(root, keyParts);
  } catch (e) {
    log(`ERRO ao abrir cofre: ${e.message}`);
    writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message } });
    process.exit(1);
  }

  const idLoja = Number(secrets.BKOFFICE_SYNC_ID_LOJA || 21);
  let intervalMs = Math.max(60000, Number(secrets.SYNC_INTERVAL_MS || 60000));
  if (intervalMs > 120000) intervalMs = 60000;
  const intervalSec = Math.round(intervalMs / 1000);
  log(`ativo loja=${idLoja} intervalo=${intervalSec}s modo=incremental (hoje a cada ${intervalSec}s)`);

  if (!secrets.BKOFFICE_USER || !secrets.BKOFFICE_PASS || !secrets.API_BASE || !secrets.BKOFFICE_KIT_TOKEN) {
    log('ERRO: cofre incompleto');
    writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: 'cofre incompleto' } });
    process.exit(1);
  }

  const once = process.argv.includes('--once') || process.argv.includes('--uma-vez');
  const forceBackfill = process.argv.includes('--backfill') || secrets.BKOFFICE_FORCE_BACKFILL === '1';

  let ciclo = 0;
  for (;;) {
    ciclo += 1;
    writeStatus({ estado: 'rodando', ciclo, loja: idLoja });
    log(`ciclo #${ciclo} iniciado`);

    let ok = false;
    try {
      const hoje = hojeBR();
      if (once) {
        log('modo teste — so hoje');
        const r = await runSync(secrets, idLoja, hoje, hoje);
        writeStatus({ ultimo_sync: r, estado: r.ok ? 'parado' : 'erro' });
        if (r.ok) markSynced(hoje);
        log(r.ok ? 'TESTE OK' : 'TESTE FALHOU');
        process.exit(r.ok ? 0 : 1);
      }
      if (forceBackfill && ciclo === 1) {
        log('AVISO: backfill forcado 01→hoje');
        const ini = `${hoje.slice(0, 8)}01`;
        for (let d = ini; d <= hoje; d = addDays(d, 1)) {
          const r = await runSync(secrets, idLoja, d, d);
          writeStatus({ ultimo_sync: r });
          if (r.ok) markSynced(d);
          else {
            ok = false;
            break;
          }
          ok = true;
        }
      } else {
        ok = await syncIncremental(secrets, idLoja);
      }
    } catch (e) {
      log(`ERRO ${e.message || e}`);
      writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message || String(e) } });
      if (once) process.exit(1);
    }

    if (once) break;

    const proximo = new Date(Date.now() + intervalMs);
    const proximoFmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(proximo);

    const st = loadSynced();
    writeStatus({
      estado: ok ? 'dormindo' : 'erro',
      ciclo,
      loja: idLoja,
      dias_ok: st.dias,
      pendentes: [],
      proximo_ciclo: proximoFmt,
    });
    log(ok ? `ciclo #${ciclo} OK — proximo em ${intervalSec}s (${proximoFmt})` : `ciclo #${ciclo} com falha — tenta de novo em ${intervalSec}s`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((e) => {
  log(`FATAL ${e.message || e}`);
  writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message || String(e) } });
  process.exit(1);
});
