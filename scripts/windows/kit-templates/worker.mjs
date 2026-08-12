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

function log(msg) {
  const line = `[bk-kit] ${new Date().toISOString()} ${msg}`;
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

/** Marca 01 → ontem do mês corrente como já feitos (histórico já no Meridian). */
function ensureHistoricoMarcado() {
  const hoje = hojeBR();
  const iniMes = `${hoje.slice(0, 8)}01`;
  const ontem = addDays(hoje, -1);
  const state = loadSynced();
  let changed = false;
  if (ontem >= iniMes) {
    for (let d = iniMes; d <= ontem; d = addDays(d, 1)) {
      if (!state.dias.includes(d)) {
        state.dias.push(d);
        changed = true;
      }
    }
  }
  if (changed) {
    state.dias.sort();
    saveSynced(state);
    log(`histórico marcado como OK: ${iniMes} → ${ontem} (não reimporta)`);
  }
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
    BKOFFICE_SERVER_SYNC: '0',
    BKOFFICE_SYNC_CRON_MS: '0',
    NODE_ENV: 'production',
    DB_HOST: '',
    DB_PASS: '',
  };
  log(`sync start loja=${idLoja} periodo=${ini}→${fim} via=${env.API_BASE || 'api'}`);
  const t0 = Date.now();
  return new Promise((resolve) => {
    const proc = spawn(
      node,
      [script, `--loja=${idLoja}`, `--inicio=${ini}`, `--fim=${fim}`],
      {
        cwd: path.join(root, 'app'),
        env: childEnv,
        windowsHide: true,
      },
    );
    let out = '';
    let err = '';
    proc.stdout.on('data', (b) => {
      out += b.toString();
    });
    proc.stderr.on('data', (b) => {
      err += b.toString();
    });
    proc.on('close', (code) => {
      const elapsed = Math.round((Date.now() - t0) / 1000);
      const tail = (out + '\n' + err)
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-40);
      for (const ln of tail) log(`out ${ln}`);
      if (code === 0) log(`sync OK em ${elapsed}s (${ini}→${fim})`);
      else log(`sync FALHOU exit=${code} em ${elapsed}s (${ini}→${fim})`);
      resolve(code === 0);
    });
  });
}

/** Só dias ainda não marcados + sempre re-sincroniza hoje. */
async function syncIncremental(env, idLoja) {
  const hoje = hojeBR();
  const iniMes = `${hoje.slice(0, 8)}01`;
  const state = loadSynced();
  const pendentes = [];
  for (let d = iniMes; d < hoje; d = addDays(d, 1)) {
    if (!state.dias.includes(d)) pendentes.push(d);
  }
  if (pendentes.length) {
    log(`faltam ${pendentes.length} dia(s) no marcador: ${pendentes[0]}…${pendentes[pendentes.length - 1]}`);
    for (const d of pendentes) {
      const ok = await runSync(env, idLoja, d, d);
      if (ok) markSynced(d);
    }
  } else {
    log('nenhum dia atrasado — só atualiza hoje');
  }
  const okHoje = await runSync(env, idLoja, hoje, hoje);
  if (okHoje) markSynced(hoje);
  return okHoje;
}

async function main() {
  const root = kitRoot();
  log(`boot pid=${process.pid} root=${root} exe=${process.execPath}`);

  let keyParts;
  try {
    const mod = await import('./key_parts.generated.mjs');
    keyParts = mod.KEY_PARTS;
  } catch (e) {
    log(`ERRO: chave do cofre ausente (${e.message}). Regenere o kit com GERAR-KIT.`);
    process.exit(1);
  }

  let secrets;
  try {
    secrets = loadVault(root, keyParts);
  } catch (e) {
    log(`ERRO ao abrir cofre: ${e.message}`);
    process.exit(1);
  }

  const idLoja = Number(secrets.BKOFFICE_SYNC_ID_LOJA || 21);
  const intervalMs = Math.max(60000, Number(secrets.SYNC_INTERVAL_MS || 900000));
  const intervalSec = Math.round(intervalMs / 1000);
  log(
    `iniciado intervalo=${intervalSec}s loja=${idLoja} api=${secrets.API_BASE || '?'} modo=kit-https-incremental`,
  );
  if (!secrets.BKOFFICE_USER || !secrets.BKOFFICE_PASS || !secrets.API_BASE || !secrets.BKOFFICE_KIT_TOKEN) {
    log('ERRO: cofre incompleto (precisa API_BASE + KIT_TOKEN + BKOFFICE_*)');
    process.exit(1);
  }

  // Já temos 01→11 no Meridian: não reprocessa o mês no próximo boot
  ensureHistoricoMarcado();

  const once = process.argv.includes('--once') || process.argv.includes('--uma-vez');
  const forceBackfill = process.argv.includes('--backfill') || secrets.BKOFFICE_FORCE_BACKFILL === '1';

  let ciclo = 0;
  for (;;) {
    ciclo += 1;
    log(`ciclo #${ciclo} — acordando`);
    try {
      const hoje = hojeBR();
      if (once) {
        log('modo --once: só hoje');
        const ok = await runSync(secrets, idLoja, hoje, hoje);
        if (ok) markSynced(hoje);
        log(ok ? 'TESTE OK' : 'TESTE FALHOU');
        process.exit(ok ? 0 : 1);
      }
      if (forceBackfill && ciclo === 1) {
        log('FORCE backfill 01→hoje (flag explícita)');
        const ini = `${hoje.slice(0, 8)}01`;
        for (let d = ini; d <= hoje; d = addDays(d, 1)) {
          const ok = await runSync(secrets, idLoja, d, d);
          if (ok) markSynced(d);
        }
      } else {
        await syncIncremental(secrets, idLoja);
      }
    } catch (e) {
      log(`ERRO ${e.message || e}`);
      if (once) process.exit(1);
    }
    if (once) break;
    log(`ciclo #${ciclo} — dormindo ${intervalSec}s`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((e) => {
  log(`FATAL ${e.message || e}`);
  process.exit(1);
});
